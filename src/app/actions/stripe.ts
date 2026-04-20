'use server'

import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { sendRefundRequestEmail } from '@/lib/email'
import { refundRequestSchema, cancelSubscriptionSchema } from './stripe.schemas'
import { validate, ValidationError } from '@/lib/security/validation'
import { enforceRateLimit, refundLimiter, RateLimitError } from '@/lib/security/ratelimit'
import type { ActionResult } from '@/lib/security/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

interface RefundInsertData {
    user_id: string
    reason: string
    status: string
    subscription_id?: string
    purchase_id?: string
}

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
    const origin = (await headers()).get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fitandsmile.it'

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
    if (isLoyaltyEligible && process.env.STRIPE_LOYALTY_COUPON_ID) {
        sessionParams.discounts = [
            { coupon: process.env.STRIPE_LOYALTY_COUPON_ID }
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

    const origin = (await headers()).get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fitandsmile.it'

    const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${origin}/dashboard`,
    })

    if (!session.url) {
        throw new Error('Failed to create portal session')
    }

    return session.url
}
export async function requestRefund(args: unknown): Promise<ActionResult<void>> {
    let parsed
    try {
        parsed = validate(refundRequestSchema, args)
    } catch (err) {
        if (err instanceof ValidationError) {
            return { ok: false, message: 'Dati non validi', fieldErrors: err.fieldErrors }
        }
        throw err
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'Non autorizzato' }

    try {
        await enforceRateLimit(refundLimiter(), `refund:${user.id}`)
    } catch (err) {
        if (err instanceof RateLimitError) {
            return {
                ok: false,
                message: `Hai raggiunto il limite di richieste di rimborso. Riprova tra ${err.retryAfter} secondi.`,
                retryAfter: err.retryAfter,
            }
        }
        // fail-open on Upstash outage
    }

    const { id, reason, type } = parsed
    let packageName = 'Pacchetto'
    let createdAt: number

    if (type === 'subscription') {
        const { data: subData } = await supabase
            .from('user_subscriptions')
            .select('created_at, packages(name)')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (!subData) return { ok: false, message: 'Abbonamento non trovato' }
        createdAt = new Date(subData.created_at).getTime()
        packageName = (subData.packages as unknown as { name: string })?.name || 'Pacchetto'
    } else {
        const { data: purchaseData } = await supabase
            .from('one_time_purchases')
            .select('created_at, packages(name)')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (!purchaseData) return { ok: false, message: 'Acquisto non trovato' }
        createdAt = new Date(purchaseData.created_at).getTime()
        packageName = (purchaseData.packages as unknown as { name: string })?.name || 'Pacchetto'
    }

    const now = new Date().getTime()
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24)

    if (diffDays > 14) {
        return { ok: false, message: "Non è possibile richiedere un rimborso dopo 14 giorni dall'acquisto." }
    }

    const insertData: RefundInsertData = {
        user_id: user.id,
        reason,
        status: 'pending'
    }

    if (type === 'subscription') {
        insertData.subscription_id = id
    } else {
        insertData.purchase_id = id
    }

    const { error } = await supabase
        .from('refund_requests')
        .insert(insertData)

    if (error) return { ok: false, message: 'Errore durante la richiesta di rimborso' }

    // Admin Notification via service role (migration 06 drops the user-scoped INSERT policy).
    const supabaseAdmin = await createServiceRoleClient()
    await supabaseAdmin.from('admin_notifications').insert({
        type: 'refund_request',
        user_id: user.id,
        data: {
            packageName,
            reason,
            [type === 'subscription' ? 'subscriptionId' : 'purchaseId']: id
        }
    })

    // Send confirmation email to user
    if (user.email) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        try {
            await sendRefundRequestEmail(user.email, profile?.full_name || '', packageName)
        } catch {
            // Email failure should not block refund request
        }
    }

    return { ok: true, data: undefined }
}

export async function cancelSubscription(args: unknown): Promise<ActionResult<void>> {
    let parsed
    try {
        parsed = validate(cancelSubscriptionSchema, args)
    } catch (err) {
        if (err instanceof ValidationError) {
            return { ok: false, message: 'ID non valido', fieldErrors: err.fieldErrors }
        }
        throw err
    }
    const { subscriptionId } = parsed

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'Non autorizzato' }

    // 1. Get subscription info (with ownership check)
    const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id, packages(name)')
        .eq('id', subscriptionId)
        .eq('user_id', user.id)
        .single()

    if (subError || !sub) return { ok: false, message: 'Abbonamento non trovato' }

    // 2. Cancel in Stripe (only if ID exists)
    if (sub.stripe_subscription_id) {
        try {
            await stripe.subscriptions.update(sub.stripe_subscription_id, {
                cancel_at_period_end: true
            })
        } catch (err) {
            console.error('Stripe error during cancellation:', err)
            return { ok: false, message: 'Errore durante la comunicazione con Stripe' }
        }
    }

    // 3. Update flag in DB (don't set status to 'canceled' yet, Stripe will tell us when it's truly over)
    await supabase
        .from('user_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', subscriptionId)

    // 4. Admin Notification via service role (migration 06 drops the user-scoped INSERT policy).
    const supabaseAdmin = await createServiceRoleClient()
    await supabaseAdmin.from('admin_notifications').insert({
        type: 'cancellation',
        user_id: user.id,
        data: {
            packageName: (sub.packages as unknown as { name: string })?.name || 'Pacchetto',
            subscriptionId,
            wasHeadless: !sub.stripe_subscription_id
        }
    })

    return { ok: true, data: undefined }
}
