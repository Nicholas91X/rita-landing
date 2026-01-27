'use server'

import { createClient } from '@/utils/supabase/server'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

export async function createCheckoutSession(packageId: string) {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // 2. Fetch package info and User eligibility
    const { data: pkg, error: pkgError } = await supabase
        .from('packages')
        .select('stripe_price_id, payment_mode')
        .eq('id', packageId)
        .single()

    if (pkgError || !pkg || !pkg.stripe_price_id) {
        throw new Error('Package not found or price not configured')
    }

    // Fetch profile and existing subscriptions for eligibility
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, has_used_trial')
        .eq('id', user.id)
        .single()

    const { data: existingSubs } = await supabase
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', user.id)

    // Eligibility Logic
    const hasActiveOrTrialingSub = existingSubs?.some(sub => sub.status === 'active' || sub.status === 'trialing')
    const hasUsedTrial = profile?.has_used_trial || existingSubs?.some(sub => sub.status === 'trialing')

    // Trial: Only if never used trial AND has no previous/existing subscriptions at all
    const isTrialEligible = !hasUsedTrial && (!existingSubs || existingSubs.length === 0)

    // Loyalty: If has at least one active/trialing subscription
    const isLoyaltyEligible = hasActiveOrTrialingSub

    // 3. Create Stripe Checkout Session
    const origin = (await headers()).get('origin') || 'http://localhost:3000'

    const isSubscription = pkg.payment_mode !== 'payment' // Default to subscription if null

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: isSubscription ? 'subscription' : 'payment',
        line_items: [
            {
                price: pkg.stripe_price_id,
                quantity: 1,
            },
        ],
        metadata: {
            user_id: user.id,
            package_id: packageId,
            is_trial: isTrialEligible ? 'true' : 'false'
        },
        success_url: `${origin}/dashboard?success=true`,
        cancel_url: `${origin}/dashboard?canceled=true`,
    }

    // Apply Trial (Only for Subscriptions)
    if (isTrialEligible && isSubscription) {
        sessionParams.subscription_data = {
            trial_period_days: 7
        }
    }

    // Apply Loyalty Discount (Coupon ID should be provided by user or created in Stripe)
    // Placeholder: 'LOYALTY_PROMO' - User needs to create this in Stripe or provide real ID
    if (isLoyaltyEligible) {
        sessionParams.discounts = [
            { coupon: process.env.STRIPE_LOYALTY_COUPON_ID || 'LOYALTY_PROMO' }
        ]
    }

    // Reuse Customer ID if exists
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
        .select('created_at, packages(name)')
        .eq('id', subscriptionId)
        .single()

    if (!subData) throw new Error('Abbonamento non trovato')

    // 4 days limit logic (4 * 24 * 60 * 60 * 1000 = 345600000 ms)
    const createdAt = new Date(subData.created_at).getTime()
    const now = new Date().getTime()
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24)

    if (diffDays > 4) {
        throw new Error('Non è possibile richiedere un rimborso dopo 4 giorni dalla sottoscrizione.')
    }

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
            packageName: (subData?.packages as unknown as { name: string })?.name || 'Pacchetto',
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
            packageName: (sub.packages as unknown as { name: string })?.name || 'Pacchetto',
            subscriptionId: subscriptionId,
            wasHeadless: !sub.stripe_subscription_id
        }
    })

    return { success: true }
}
