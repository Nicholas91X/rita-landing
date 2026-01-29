'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

export async function getAdminStats() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    const { count: activeSubscriptions } = await supabase
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

    const { count: totalOneTimePurchases } = await supabase
        .from('one_time_purchases')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'refunded')

    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
    const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim()

    let totalVideos = 0
    let totalViews = 0
    let bandwidthUsed = 0

    if (libraryId && apiKey) {
        try {
            const videoRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?itemsPerPage=1`, {
                headers: { 'AccessKey': apiKey }
            })
            if (videoRes.ok) {
                const videoData = await videoRes.json()
                totalVideos = videoData.totalItems || 0
            }

            const dateTo = new Date().toISOString().split('T')[0]
            const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            const statsRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
                headers: { 'AccessKey': apiKey }
            })

            if (statsRes.ok) {
                const statsData = await statsRes.json()
                totalViews = statsData.views || 0
                bandwidthUsed = statsData.bandwidthUsed || 0
            }
        } catch (e) {
            console.error('Failed to fetch Bunny stats:', e)
        }
    }

    return {
        supabase: {
            totalUsers: totalUsers || 0,
            activeSubscriptions: activeSubscriptions || 0,
            totalOneTimePurchases: totalOneTimePurchases || 0
        },
        bunny: {
            totalVideos,
            totalViews,
            bandwidthUsed
        }
    }
}

export async function getStripeDashboardData() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    try {
        const [balance, charges, subscriptions] = await Promise.all([
            stripe.balance.retrieve(),
            stripe.charges.list({ limit: 15, expand: ['data.customer'] }),
            stripe.subscriptions.list({ limit: 15, status: 'all', expand: ['data.customer'] })
        ])

        return {
            balance: {
                available: balance.available.reduce((acc, b) => acc + b.amount, 0) / 100,
                pending: balance.pending.reduce((acc, b) => acc + b.amount, 0) / 100,
                currency: balance.available[0]?.currency || 'eur'
            },
            payments: charges.data.map(c => ({
                id: c.id,
                amount: c.amount / 100,
                currency: c.currency,
                status: c.refunded ? 'refunded' : (c.status === 'succeeded' ? 'succeeded' : c.status),
                email: c.billing_details?.email || (c.customer && typeof c.customer !== 'string' ? (c.customer as Stripe.Customer).email : ''),
                created: c.created,
                refunded: c.refunded,
                receipt_url: c.receipt_url,
                card: c.payment_method_details?.card ? {
                    brand: c.payment_method_details.card.brand,
                    last4: c.payment_method_details.card.last4
                } : null
            })),
            subscriptions: (subscriptions.data as Stripe.Subscription[]).map(s => ({
                id: s.id,
                status: s.status,
                amount: s.items.data[0]?.price.unit_amount ? s.items.data[0].price.unit_amount / 100 : 0,
                interval: s.items.data[0]?.price.recurring?.interval || 'month',
                email: (s.customer as Stripe.Customer)?.email || '',
                next_invoice: (s as unknown as { current_period_end: number }).current_period_end || s.ended_at || s.created
            }))
        }
    } catch (error) {
        console.error('Stripe Error:', error)
        throw new Error('Failed to fetch Stripe data')
    }
}

export async function cancelSubscription(subscriptionId: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    try {
        await stripe.subscriptions.cancel(subscriptionId)
        return { success: true }
    } catch (error) {
        console.error('Stripe Cancellation Error:', error)
        throw new Error('Impossibile annullare l\'abbonamento')
    }
}

export async function refundPayment(chargeId: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    try {
        await stripe.refunds.create({
            charge: chargeId,
        })
        return { success: true }
    } catch (error) {
        console.error('Stripe Refund Error:', error)
        throw new Error('Errore durante l\'esecuzione del rimborso')
    }
}

export async function getRefundRequests(page: number = 1, pageSize: number = 6) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: requests, error, count } = await supabase
        .from('refund_requests')
        .select(`
            *,
            profiles ( full_name, email ),
            user_subscriptions (
                package_id,
                packages ( name )
            ),
            one_time_purchases (
                package_id,
                packages ( name )
            )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) {
        console.error('Error fetching refund requests:', error)
        return { data: [], totalCount: 0 }
    }

    return {
        data: requests || [],
        totalCount: count || 0
    }
}

export async function handleRefundRequest(requestId: string, status: 'approved' | 'rejected') {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { data: request, error: reqError } = await supabase
        .from('refund_requests')
        .select(`
            *,
            user_subscriptions (
                stripe_subscription_id,
                packages ( name )
            )
        `)
        .eq('id', requestId)
        .single()

    if (reqError || !request) throw new Error('Richiesta non trovata')

    if (status === 'approved') {
        try {
            if (request.subscription_id && request.user_subscriptions?.stripe_subscription_id) {
                const invoices = await stripe.invoices.list({
                    subscription: request.user_subscriptions.stripe_subscription_id,
                    limit: 1
                })

                const invoice = invoices.data[0] as unknown as { charge: string | Stripe.Charge | null }
                const charge = invoice.charge
                const chargeId = typeof charge === 'string' ? charge : (charge as Stripe.Charge)?.id
                if (chargeId) {
                    await stripe.refunds.create({ charge: chargeId })
                }

                await stripe.subscriptions.cancel(request.user_subscriptions.stripe_subscription_id)
            } else if (request.purchase_id) {
                const { data: purchase } = await supabase
                    .from('one_time_purchases')
                    .select('stripe_payment_intent_id')
                    .eq('id', request.purchase_id)
                    .single()

                if (purchase?.stripe_payment_intent_id) {
                    await stripe.refunds.create({
                        payment_intent: purchase.stripe_payment_intent_id
                    })
                }
            }
        } catch (err) {
            console.error('Stripe Refund error:', err)
            throw new Error('Errore durante il rimborso su Stripe')
        }
    }

    const { error: updateError } = await supabase
        .from('refund_requests')
        .update({
            status,
            processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

    if (updateError) throw new Error('Errore durante l\'aggiornamento della richiesta')

    if (status === 'approved') {
        if (request.subscription_id) {
            await supabase
                .from('user_subscriptions')
                .update({ status: 'refunded' })
                .eq('id', request.subscription_id)
        } else if (request.purchase_id) {
            await supabase
                .from('one_time_purchases')
                .update({ status: 'refunded' })
                .eq('id', request.purchase_id)
        }
    }

    const packageName = request.user_subscriptions?.packages?.name ||
        (request as any).one_time_purchases?.packages?.name ||
        'pacchetto'
    await supabase.from('user_notifications').insert({
        user_id: request.user_id,
        type: status === 'approved' ? 'refund_approved' : 'refund_rejected',
        title: status === 'approved' ? 'Rimborso Approvato' : 'Richiesta Rimborso Rifiutata',
        message: status === 'approved'
            ? `La tua richiesta di rimborso per "${packageName}" è stata approvata. Riceverai l'accredito tra pochi giorni.`
            : `Siamo spiacenti, ma la tua richiesta di rimborso per "${packageName}" non è stata approvata.`,
    })

    revalidatePath('/admin')
    revalidatePath('/dashboard')

    return { success: true }
}
