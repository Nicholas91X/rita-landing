'use server'

import { createClient } from '@/utils/supabase/server'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover',
})

export async function createCheckoutSession(packageId: string) {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // 2. Fetch stripe_price_id from Supabase
    const { data: pkg, error } = await supabase
        .from('packages')
        .select('stripe_price_id')
        .eq('id', packageId)
        .single()

    if (error || !pkg || !pkg.stripe_price_id) {
        throw new Error('Package not found or price not configured')
    }

    // 3. Create Stripe Checkout Session
    const origin = (await headers()).get('origin') || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        mode: 'subscription',
        line_items: [
            {
                price: pkg.stripe_price_id,
                quantity: 1,
            },
        ],
        metadata: {
            user_id: user.id,
            package_id: packageId,
        },
        success_url: `${origin}/dashboard?success=true`,
        cancel_url: `${origin}/dashboard?canceled=true`,
    })

    if (!session.url) {
        throw new Error('Failed to create checkout session')
    }

    return session.url
}

export async function createPortalSession() {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // 2. We need the Stripe Customer ID. We can get it from user_subscriptions or direct lookup
    // Since we store subscriptions, let's find the customer_id from any active or past subscription
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .filter('stripe_customer_id', 'not.is', null)
        .limit(1)
        .maybeSingle()

    if (!sub || !sub.stripe_customer_id) {
        throw new Error('No Stripe customer found for this user. Purchase a package first.')
    }

    const origin = (await headers()).get('origin') || 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${origin}/dashboard`,
    })

    if (!session.url) {
        throw new Error('Failed to create portal session')
    }

    return session.url
}
export async function requestRefund(subscriptionId: string, reason: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('refund_requests')
        .insert({
            user_id: user.id,
            subscription_id: subscriptionId,
            reason,
            status: 'pending'
        })

    if (error) throw new Error('Errore durante la richiesta di rimborso')

    return { success: true }
}

export async function cancelSubscription(subscriptionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Get subscription info
    const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id')
        .eq('id', subscriptionId)
        .single()

    if (subError || !sub?.stripe_subscription_id) throw new Error('Abbonamento non trovato')

    // 2. Cancel in Stripe (cancel at end of period)
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true
    })

    // 3. Update status in DB
    await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled' })
        .eq('id', subscriptionId)

    return { success: true }
}
