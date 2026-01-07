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

        if (userId && packageId) {
            // Create admin client to bypass RLS
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            const { error } = await supabaseAdmin
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    package_id: packageId,
                    status: 'active',
                    stripe_customer_id: session.customer as string,
                    stripe_subscription_id: session.subscription as string,
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                }, {
                    onConflict: 'user_id, package_id'
                })

            if (error) {
                console.error('Supabase error:', error)
                return new NextResponse('Error updating subscription', { status: 500 })
            }
        } else {
            console.warn('Missing metadata in checkout session')
        }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Map Stripe status to our schema
        // Stripe: active, past_due, unpaid, canceled, incomplete, incomplete_expired, trialing
        // DB: active, trialing, past_due, unpaid, canceled, refunded, incomplete

        const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
                status: subscription.status,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end
            })
            .eq('stripe_subscription_id', subscription.id)

        if (error) {
            console.error('Error updating subscription status:', error)
            return new NextResponse('Error syncing subscription', { status: 500 })
        }
        console.log(`Synced subscription ${subscription.id} to status: ${subscription.status}`)
    }

    return new NextResponse(null, { status: 200 })
}
