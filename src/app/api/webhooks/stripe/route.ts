import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { sendPurchaseConfirmationEmail } from '@/lib/email'
import { claimWebhookEvent } from '@/lib/security/idempotency'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get('stripe-signature') as string

    let event: Stripe.Event

    try {
        if (!signature || !webhookSecret) {
            throw new Error('Missing signature or secret')
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Webhook Error: ${errorMessage}`)
        return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 })
    }

    // Idempotency: claim the event by its Stripe ID. If the same event_id was
    // already processed (Stripe retries, at-least-once semantics), skip and 200.
    // Uses service-role client because stripe_webhook_events has RLS on.
    const idempotencyAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    try {
        const { alreadyProcessed } = await claimWebhookEvent(idempotencyAdmin, event)
        if (alreadyProcessed) {
            return new NextResponse('Event already processed', { status: 200 })
        }
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('Idempotency claim failed:', errorMessage)
        // Return 500 so Stripe retries — better to reprocess than silently drop.
        return new NextResponse(`Idempotency error: ${errorMessage}`, { status: 500 })
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const packageId = session.metadata?.package_id
        const isTrial = session.metadata?.is_trial === 'true'

        console.log(`Checkout completed: User ${userId}, Package ${packageId}, Trial: ${isTrial}`)

        if (userId && packageId) {
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
                process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
            )

            try {
                // Verify that the metadata user_id matches the Stripe customer
                // This prevents metadata tampering attacks
                if (session.customer) {
                    const { data: profileByCustomer } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', session.customer as string)
                        .maybeSingle()

                    if (profileByCustomer && profileByCustomer.id !== userId) {
                        console.error(`SECURITY: Metadata user_id (${userId}) does not match Stripe customer profile (${profileByCustomer.id})`)
                        return new NextResponse('User mismatch', { status: 400 })
                    }
                }
                // Fetch actual subscription to get status and period end
                const mode = session.mode
                let subscriptionStatus = 'active'
                let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

                if (mode === 'payment') {
                    // One-Time Purchase Logic
                    subscriptionStatus = 'active'
                    periodEnd = null as unknown as string

                    console.log(`Processing One-Time Purchase: User=${userId}, Pkg=${packageId}, Amount=${session.amount_total}`)

                    // Log purchase
                    const { error: oneTimeError } = await supabaseAdmin.from('one_time_purchases').insert({
                        user_id: userId,
                        package_id: packageId,
                        item_type: 'package',
                        amount: session.amount_total,
                        stripe_payment_intent_id: session.payment_intent as string,
                        status: 'paid'
                    })

                    if (oneTimeError) {
                        console.error('CRITICAL: Error inserting one_time_purchase:', oneTimeError)
                        throw oneTimeError
                    }

                    // Mirror to stripe_payments (for mirroring/dashboard speed)
                    if (session.payment_intent) {
                        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
                            expand: ['latest_charge']
                        })
                        const charge = pi.latest_charge as Stripe.Charge
                        if (charge) {
                            await supabaseAdmin.from('stripe_payments').upsert({
                                id: charge.id,
                                user_id: userId,
                                customer_id: session.customer as string,
                                amount: (session.amount_total || 0) / 100,
                                currency: session.currency || 'eur',
                                status: 'succeeded',
                                receipt_url: charge.receipt_url,
                                card_brand: charge.payment_method_details?.card?.brand,
                                card_last4: charge.payment_method_details?.card?.last4,
                                created_at: new Date(charge.created * 1000).toISOString()
                            })
                        }
                    }
                    console.log('Successfully inserted one_time_purchase record')
                } else if (session.subscription) {
                    // Subscription Logic
                    const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
                    subscriptionStatus = stripeSub.status
                    // NOTE: In the Stripe Node SDK, `current_period_end` lives in
                    // `items.data[0].current_period_end`, NOT at the subscription root level.
                    // For trialing subscriptions, `trial_end` is also available at root.
                    // We fallback gracefully to avoid `new Date(NaN)` → "Invalid time value" crashes.
                    const rawPeriodEnd = (stripeSub.items?.data?.[0] as unknown as Record<string, number>)?.current_period_end
                        ?? (stripeSub as unknown as Record<string, number>).trial_end
                        ?? null
                    periodEnd = rawPeriodEnd
                        ? new Date(rawPeriodEnd * 1000).toISOString()
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    console.log(`Syncing subscription ${session.subscription}: Status ${subscriptionStatus}, PeriodEnd ${periodEnd}`)

                    const { error: upsertError } = await supabaseAdmin
                        .from('user_subscriptions')
                        .upsert({
                            user_id: userId,
                            package_id: packageId,
                            status: subscriptionStatus,
                            amount: session.amount_total,
                            stripe_customer_id: session.customer as string,
                            stripe_subscription_id: session.subscription as string,
                            current_period_end: periodEnd,
                        }, {
                            onConflict: 'user_id, package_id'
                        })

                    if (upsertError) throw upsertError
                }

                // Mark trial as used if applicable
                if (isTrial) {
                    const { error: trialError } = await supabaseAdmin
                        .from('profiles')
                        .update({ has_used_trial: true })
                        .eq('id', userId)
                    if (trialError) console.error('Error marking trial as used:', trialError)
                }

                // Sync Stripe Customer ID to profiles
                if (session.customer) {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ stripe_customer_id: session.customer as string })
                        .eq('id', userId)
                }

                // Create Admin Notification
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', userId)
                    .single()

                const { data: pkg } = await supabaseAdmin
                    .from('packages')
                    .select('name')
                    .eq('id', packageId)
                    .single()

                await supabaseAdmin.from('admin_notifications').insert({
                    type: isTrial ? 'trial_start' : 'package_purchase',
                    user_id: userId,
                    data: {
                        packageName: pkg?.name || 'Pacchetto',
                        customerName: profile?.full_name || profile?.email || 'Utente',
                        amount: isTrial ? 0 : (session.amount_total || 0) / 100,
                        isTrial
                    }
                })

                // Create User Notification for Confirmation
                const confirmationTitle = isTrial ? '✨ Prova Gratuita Attivata!' : '🛍️ Conferma di Acquisto'
                const confirmationMessage = isTrial
                    ? `Benvenuta! La tua prova per "${pkg?.name || 'il pacchetto'}" è ora attiva.`
                    : `Grazie per il tuo acquisto! "${pkg?.name || 'il pacchetto'}" è stato aggiunto al tuo account.`

                await supabaseAdmin.from('user_notifications').insert({
                    user_id: userId,
                    title: confirmationTitle,
                    message: confirmationMessage,
                    type: isTrial ? 'trial_start' : 'purchase_confirmation'
                })

                // Send confirmation email
                if (profile?.email) {
                    try {
                        await sendPurchaseConfirmationEmail(
                            profile.email,
                            profile.full_name || '',
                            pkg?.name || 'Pacchetto',
                            session.amount_total || 0,
                            isTrial
                        )
                    } catch (emailErr) {
                        console.error('Failed to send purchase confirmation email:', emailErr)
                    }
                }

                revalidateTag('admin-stats')

                console.log(`Successfully processed checkout for User ${userId}`)

            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error'
                console.error('Webhook processing error:', errorMessage)
                // Returning a non-200 here will make Stripe retry the webhook
                return new NextResponse(`Internal Error: ${errorMessage}`, { status: 500 })
            }
        } else {
            console.warn('Skipping webhook: Missing userId or packageId in session metadata')
            console.log('Session metadata found:', session.metadata)
        }
    }
    else if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object as Stripe.Invoice & { charge: string | Stripe.Charge | null }
        if (invoice.charge) {
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            // Find user_id from profiles using stripe_customer_id
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', invoice.customer as string)
                .single()

            const charge = await stripe.charges.retrieve(invoice.charge as string)

            await supabaseAdmin.from('stripe_payments').upsert({
                id: charge.id,
                user_id: profile?.id || null,
                customer_id: invoice.customer as string,
                amount: invoice.amount_paid / 100,
                currency: invoice.currency,
                status: 'succeeded',
                receipt_url: charge.receipt_url,
                card_brand: charge.payment_method_details?.card?.brand,
                card_last4: charge.payment_method_details?.card?.last4,
                created_at: new Date(charge.created * 1000).toISOString()
            })

            revalidateTag('admin-stats')
        }
    }
    else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
        )

        const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
                status: subscription.status,
                current_period_end: (() => {
                    const rawEnd = (subscription.items?.data?.[0] as unknown as Record<string, number>)?.current_period_end
                        ?? (subscription as unknown as Record<string, number>).trial_end
                        ?? null
                    return rawEnd
                        ? new Date(rawEnd * 1000).toISOString()
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                })(),
                cancel_at_period_end: subscription.cancel_at_period_end
            })
            .eq('stripe_subscription_id', subscription.id)

        if (error) {
            console.error('Error updating subscription status:', error)
            return new NextResponse('Error syncing subscription', { status: 500 })
        }
    }

    return new NextResponse(null, { status: 200 })
}
