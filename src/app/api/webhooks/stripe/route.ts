import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover',
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

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const packageId = session.metadata?.package_id
        const isTrial = session.metadata?.is_trial === 'true'

        console.log(`Checkout completed: User ${userId}, Package ${packageId}, Trial: ${isTrial}`)

        if (userId && packageId) {
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            try {
                // Fetch actual subscription to get status and period end
                let subscriptionStatus = 'active'
                let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

                if (session.subscription) {
                    const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
                    subscriptionStatus = stripeSub.status
                    periodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString()
                    console.log(`Syncing subscription ${session.subscription}: Status ${subscriptionStatus}`)
                }

                const { error: upsertError } = await supabaseAdmin
                    .from('user_subscriptions')
                    .upsert({
                        user_id: userId,
                        package_id: packageId,
                        status: subscriptionStatus,
                        stripe_customer_id: session.customer as string,
                        stripe_subscription_id: session.subscription as string,
                        current_period_end: periodEnd,
                    }, {
                        onConflict: 'user_id, package_id'
                    })

                if (upsertError) throw upsertError

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

                console.log(`Successfully processed checkout for User ${userId}`)

            } catch (err: any) {
                console.error('Webhook processing error:', err.message || err)
                // Returning a non-200 here will make Stripe retry the webhook
                return new NextResponse(`Internal Error: ${err.message}`, { status: 500 })
            }
        } else {
            console.warn('Skipping webhook: Missing userId or packageId in session metadata')
            console.log('Session metadata found:', session.metadata)
        }
    }
    else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
                status: subscription.status,
                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
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
