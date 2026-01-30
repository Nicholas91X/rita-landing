'use server'

import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import { revalidatePath, unstable_cache } from 'next/cache'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

interface DBPayment {
    id: string
    amount: number
    currency: string
    status: string
    created_at: string
    receipt_url: string | null
    card_brand: string | null
    card_last4: string | null
    profiles: { email: string } | null
}

export async function getAdminStats(userId?: string) {
    const isSuperAdmin = await isAdmin(userId)
    if (!isSuperAdmin) throw new Error('Unauthorized')

    return await cachedAdminStats()
}

const cachedAdminStats = unstable_cache(
    async () => {
        const supabase = await createServiceRoleClient()

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
    },
    ['admin-stats'],
    { tags: ['admin-stats'], revalidate: 600 }
)

export async function getStripeDashboardData() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createServiceRoleClient()

    try {
        const [balanceResult, dbResult, subResult] = await Promise.all([
            stripe.balance.retrieve(),
            supabase
                .from('stripe_payments')
                .select('*, profiles(email)')
                .order('created_at', { ascending: false })
                .limit(25),
            stripe.subscriptions.list({
                limit: 15,
                expand: ['data.customer'],
                status: 'all' // Trying to put it back as it might be needed to see everything
            })
        ])

        const dbPayments = (dbResult.data || []) as DBPayment[]
        const subscriptions = subResult.data || []

        return {
            balance: {
                available: balanceResult.available.reduce((acc, b) => acc + b.amount, 0) / 100,
                pending: balanceResult.pending.reduce((acc, b) => acc + b.amount, 0) / 100,
                currency: balanceResult.available[0]?.currency || 'eur'
            },
            payments: dbPayments.map((p) => ({
                id: p.id,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                email: p.profiles?.email || '',
                created: new Date(p.created_at).getTime() / 1000,
                refunded: p.status === 'refunded',
                receipt_url: p.receipt_url,
                card: {
                    brand: p.card_brand,
                    last4: p.card_last4
                }
            })),
            subscriptions: subscriptions.map(s => {
                const customer = s.customer as Stripe.Customer | Stripe.DeletedCustomer | string
                const price = s.items?.data?.[0]?.price
                return {
                    id: s.id,
                    status: s.status,
                    amount: price?.unit_amount ? price.unit_amount / 100 : 0,
                    interval: price?.recurring?.interval || 'month',
                    email: (typeof customer === 'object' && 'email' in customer) ? customer.email || '' : (typeof customer === 'string' ? customer : ''),
                    next_invoice: ('current_period_end' in s ? s.current_period_end : null) || s.ended_at || s.created
                }
            })
        }
    }
    catch (error) {
        console.error('Stripe Mirror Error:', error)
        return {
            balance: { available: 0, pending: 0, currency: 'eur' },
            payments: [],
            subscriptions: []
        }
    }
}

export async function syncStripePayments() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createServiceRoleClient()

    try {
        const charges = await stripe.charges.list({ limit: 100, expand: ['data.customer'] })

        // 1. Collect all stripe_customer_ids from charges to find corresponding user_ids
        const customerIds = Array.from(new Set(charges.data.map(c => typeof c.customer === 'string' ? c.customer : (c.customer as Stripe.Customer)?.id).filter(Boolean)))

        // 2. Fetch profiles to map customer_id -> user_id
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, stripe_customer_id')
            .in('stripe_customer_id', customerIds)

        const profileMap = new Map(profiles?.map(p => [p.stripe_customer_id, p.id]) || [])

        // 3. Upsert into stripe_payments
        const paymentsToUpsert = charges.data.map(charge => {
            const customerId = typeof charge.customer === 'string'
                ? charge.customer
                : (charge.customer as Stripe.Customer)?.id

            return {
                id: charge.id,
                user_id: customerId ? profileMap.get(customerId) || null : null,
                customer_id: customerId || null,
                amount: charge.amount / 100,
                currency: charge.currency,
                status: charge.refunded ? 'refunded' : (charge.status === 'succeeded' ? 'succeeded' : charge.status),
                receipt_url: charge.receipt_url,
                card_brand: charge.payment_method_details?.card?.brand || null,
                card_last4: charge.payment_method_details?.card?.last4 || null,
                created_at: new Date(charge.created * 1000).toISOString()
            }
        })

        if (paymentsToUpsert.length > 0) {
            const { error: upsertError } = await supabase.from('stripe_payments').upsert(paymentsToUpsert, { onConflict: 'id' })
            if (upsertError) {
                console.error('Upsert Error details:', upsertError)
                throw upsertError
            }
        }

        return { success: true, count: paymentsToUpsert.length }
    } catch (error) {
        console.error('Sync Error:', error)
        throw new Error('Failed to sync payments')
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
            ),
            one_time_purchases (
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
        request.one_time_purchases?.packages?.name ||
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
