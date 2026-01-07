'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-12-15.clover',
})

export async function getUserSubscriptionInfo() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select(`
            id, 
            status, 
            current_period_end,
            stripe_customer_id,
            stripe_subscription_id,
            packages ( 
                name, 
                description,
                price
            ),
            refund_requests (
                status,
                reason,
                created_at
            )
        `)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error fetching user subscriptions:', error)
        return []
    }

    // Map and fetch receipts from Stripe
    const subsWithDetailedInfo = await Promise.all(subs.map(async (sub) => {
        let receipt_url = null
        if (sub.stripe_subscription_id) {
            try {
                const invoices = await stripe.invoices.list({
                    subscription: sub.stripe_subscription_id,
                    limit: 1,
                })
                const lastInvoice = invoices.data[0] as any
                receipt_url = lastInvoice?.receipt_url || lastInvoice?.hosted_invoice_url
            } catch (err) {
                console.error('Error fetching invoice for sub:', sub.id, err)
            }
        }

        return {
            ...sub,
            next_invoice: sub.current_period_end,
            amount: Number((sub.packages as any)?.price || 0),
            interval: 'mese',
            receipt_url
        }
    }))

    return subsWithDetailedInfo
}

export async function getUserProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return {
        user,
        profile
    }
}
export async function signOutUser() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
export async function getUserNotifications() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: notifications, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching notifications:', error)
        return []
    }

    return notifications
}

export async function markUserNotificationAsRead(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false }

    const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error marking notification as read:', error)
        return { success: false }
    }

    return { success: true }
}
