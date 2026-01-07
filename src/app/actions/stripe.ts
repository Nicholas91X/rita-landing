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

    // 2. Fetch package info and User's Stripe Customer ID
    const { data: pkg, error: pkgError } = await supabase
        .from('packages')
        .select('stripe_price_id')
        .eq('id', packageId)
        .single()

    if (pkgError || !pkg || !pkg.stripe_price_id) {
        throw new Error('Package not found or price not configured')
    }

    // Check for existing Stripe Customer ID in profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()

    // 3. Create Stripe Checkout Session
    const origin = (await headers()).get('origin') || 'http://localhost:3000'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
    }

    // Reuse Customer ID if exists, otherwise let Stripe create one (and we catch it in webhook)
    if (profile?.stripe_customer_id) {
        sessionParams.customer = profile.stripe_customer_id
    } else {
        sessionParams.customer_email = user.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

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

    const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('packages(name)')
        .eq('id', subscriptionId)
        .single()

    const { error } = await supabase
        .from('refund_requests')
        .insert({
            user_id: user.id,
            subscription_id: subscriptionId,
            reason,
            status: 'pending'
        })

    if (error) throw new Error('Errore durante la richiesta di rimborso')

    // Create Admin Notification
    await supabase.from('admin_notifications').insert({
        type: 'refund_request',
        user_id: user.id,
        data: {
            packageName: (subData?.packages as any)?.name || 'Pacchetto',
            reason: reason,
            subscriptionId: subscriptionId
        }
    })

    return { success: true }
}

export async function cancelSubscription(subscriptionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Get subscription info
    const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id, packages(name)')
        .eq('id', subscriptionId)
        .single()

    if (subError || !sub) throw new Error('Abbonamento non trovato')

    // 2. Cancel in Stripe (only if ID exists)
    if (sub.stripe_subscription_id) {
        try {
            await stripe.subscriptions.update(sub.stripe_subscription_id, {
                cancel_at_period_end: true
            })
        } catch (err) {
            console.error('Stripe error during cancellation:', err)
            // Continue to update DB anyway to keep things in sync if possible, 
            // or throw if you want to be strict. Let's throw for Stripe errors.
            throw new Error('Errore durante la comunicazione con Stripe')
        }
    }

    // 3. Update status in DB
    await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled' })
        .eq('id', subscriptionId)

    // 4. Create Admin Notification
    await supabase.from('admin_notifications').insert({
        type: 'cancellation',
        user_id: user.id,
        data: {
            packageName: (sub.packages as any)?.name || 'Pacchetto',
            subscriptionId: subscriptionId,
            wasHeadless: !sub.stripe_subscription_id
        }
    })

    return { success: true }
}
