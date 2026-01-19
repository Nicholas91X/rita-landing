'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { reconcileUserBadges } from './video'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-12-15.clover',
})

interface UserDocument {
    id: string
    type: 'invoice' | 'credit_note'
    number: string
    date: number
    amount: number
    currency: string
    url: string | null
    status: string | null
}

interface ProfileUpdates {
    updated_at: string
    full_name?: string
    avatar_url?: string
}

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
            created_at,
            stripe_customer_id,
            stripe_subscription_id,
            packages ( 
                name, 
                description,
                price,
                image_url
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

    const typedSubs = (subs as unknown) as Array<{
        id: string;
        status: string;
        current_period_end: string;
        created_at: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        packages: unknown;
        refund_requests: unknown;
    }>;

    // Map and fetch receipts from Stripe
    const subsWithDetailedInfo = await Promise.all(typedSubs.map(async (sub) => {
        let documents: UserDocument[] = []
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
                // Fetch invoices for this specific subscription if available
                const invoiceFetchOptions: Stripe.InvoiceListParams = {
                    customer: customerId,
                    limit: 20,
                }

                if (sub.stripe_subscription_id) {
                    invoiceFetchOptions.subscription = sub.stripe_subscription_id
                }

                const invoices = await stripe.invoices.list(invoiceFetchOptions)

                // Fetch all credit notes for this customer (Stripe doesn't support direct subscription filter)
                const creditNotes = await stripe.creditNotes.list({
                    customer: customerId,
                    limit: 20,
                })

                const invoiceIds = invoices.data.map(i => i.id)

                // Map invoices to documents
                const invoiceDocs: UserDocument[] = invoices.data.map((inv) => ({
                    id: inv.id,
                    type: 'invoice' as const,
                    number: inv.number || '',
                    date: inv.created,
                    amount: inv.total / 100,
                    currency: inv.currency,
                    url: inv.hosted_invoice_url || inv.invoice_pdf || null,
                    status: inv.status
                }))

                // Map credit notes to documents, filtering those that belong to the relevant invoices
                // or have the same subscription metadata if applicable (usually CNs are tied to invoices)
                const creditNoteDocs: UserDocument[] = creditNotes.data
                    .filter(cn => cn.invoice && invoiceIds.includes(cn.invoice as string))
                    .map(cn => ({
                        id: cn.id,
                        type: 'credit_note' as const,
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

        const pkg = (Array.isArray(sub.packages) ? sub.packages[0] : sub.packages) as { name: string; description: string; price: number; image_url: string | null } | null
        const refunds = Array.isArray(sub.refund_requests) ? sub.refund_requests : (sub.refund_requests ? [sub.refund_requests] : [])

        return {
            ...sub,
            packages: pkg,
            refund_requests: refunds,
            next_invoice: sub.current_period_end,
            amount: Number(pkg?.price || 0),
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

    // Self-healing: Ensure badges are up to date with progress
    await reconcileUserBadges(user.id)

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, has_used_trial')
        .eq('id', user.id)
        .single()

    const { data: activeSubs } = await supabase
        .from('user_subscriptions')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])

    const { data: badges } = await supabase
        .from('user_badges')
        .select('*, packages(name)')
        .eq('user_id', user.id)

    return {
        user,
        profile,
        activeSubscriptions: activeSubs || [],
        badges: badges || []
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

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const fullName = formData.get('fullName') as string
    const avatarFile = formData.get('avatar') as File

    const updates: ProfileUpdates = {
        updated_at: new Date().toISOString(),
    }

    if (fullName) {
        updates.full_name = fullName
    }

    if (avatarFile && avatarFile.size > 0) {
        // 1. Cleanup old avatar if exists
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single()

        if (currentProfile?.avatar_url) {
            try {
                // Extract filename from URL 
                // URL format: .../avatars/filename
                const oldUrl = currentProfile.avatar_url
                const oldFileName = oldUrl.split('/').pop()
                if (oldFileName) {
                    await supabase.storage
                        .from('avatars')
                        .remove([oldFileName])
                }
            } catch (err) {
                console.error('Error deleting old avatar:', err)
                // Continue even if delete fails
            }
        }

        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile)

        if (uploadError) {
            console.error('Error uploading avatar:', uploadError)
            throw new Error('Errore durante il caricamento della foto')
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)

        updates.avatar_url = publicUrl
    }

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

    if (error) {
        console.error('Error updating profile:', error)
        throw new Error('Errore durante l\'aggiornamento del profilo')
    }

    return { success: true }
}

export async function updateEmail(email: string) {
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
    )

    if (error) {
        console.error('Error updating email:', error)
        throw new Error(error.message)
    }

    return { success: true }
}

export async function updatePassword(password: string) {
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
        console.error('Error updating password:', error)
        throw new Error(error.message)
    }

    return { success: true }
}
