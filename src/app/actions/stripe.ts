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
