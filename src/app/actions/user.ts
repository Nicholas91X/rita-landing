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
                created_at,
                processed_at
            )
        `)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error fetching user subscriptions:', error)
        return []
    }

    // Map and fetch receipts from Stripe
    const subsWithDetailedInfo = await Promise.all(subs.map(async (sub) => {
        let documents: any[] = []
        let customerId = sub.stripe_customer_id

        // Fallback: If customer_id is missing but subscription_id exists, fetch it from Stripe
        if (!customerId && sub.stripe_subscription_id) {
            try {
                const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
                customerId = stripeSub.customer as string

                // Proactively update DB if we found it
                if (customerId) {
                    await supabase
                        .from('user_subscriptions')
                        .update({ stripe_customer_id: customerId })
                        .eq('id', sub.id)
                }
            } catch (err) {
                console.error('Error resolving customer from sub:', sub.stripe_subscription_id, err)
            }
        }

        // Second Fallback: Search by email
        if (!customerId) {
            try {
                const customers = await stripe.customers.list({ email: user.email, limit: 1 })
                if (customers.data.length > 0) {
                    customerId = customers.data[0].id
                }
            } catch (err) {
                console.error('Error resolving customer from email:', user.email, err)
            }
        }

        if (customerId) {
            try {
                // Fetch all invoices for this customer
                const invoices = await stripe.invoices.list({
                    customer: customerId,
                    limit: 15,
                })

                // Fetch all credit notes for this customer
                const creditNotes = await stripe.creditNotes.list({
                    customer: customerId,
                    limit: 15,
                })

                // Map invoices to documents
                const invoiceDocs = invoices.data.map((inv: any) => ({
                    id: inv.id,
                    type: 'invoice',
                    number: inv.number,
                    date: inv.created,
                    amount: inv.total / 100,
                    currency: inv.currency,
                    url: inv.receipt_url || inv.hosted_invoice_url,
                    status: inv.status
                }))

                // Map credit notes to documents
                const creditNoteDocs = creditNotes.data.map(cn => ({
                    id: cn.id,
                    type: 'credit_note',
                    number: cn.number,
                    date: cn.created,
                    amount: cn.amount / 100,
                    currency: cn.currency,
                    url: cn.pdf,
                    status: cn.status
                }))

                // Combine and sort by date descending
                documents = [...invoiceDocs, ...creditNoteDocs].sort((a, b) => b.date - a.date)

            } catch (err) {
                console.error('Error fetching documentation for customer:', sub.stripe_customer_id, err)
            }
        }

        return {
            ...sub,
            next_invoice: sub.current_period_end,
            amount: Number((sub.packages as any)?.price || 0),
            interval: 'mese',
            documents,
            receipt_url: documents.find(d => d.type === 'invoice')?.url // legacy support if needed
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
