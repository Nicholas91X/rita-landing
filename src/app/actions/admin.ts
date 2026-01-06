'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import Stripe from 'stripe'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as unknown as Stripe.LatestApiVersion,
})

export async function getAdminPackages() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: packages, error } = await supabase
        .from('packages')
        .select('*')
        .order('name')

    if (error) throw new Error(error.message)
    return packages
}

export async function createPackage(data: { name: string, description: string, price: number }) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    // 1. Create Product in Stripe
    const product = await stripe.products.create({
        name: data.name,
        description: data.description,
    })

    // 2. Create Price in Stripe
    const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(data.price * 100), // Convert to cents
        currency: 'eur',
        recurring: {
            interval: 'month',
        },
    })

    // 3. Save to DB
    const supabase = await createClient()
    const { error } = await supabase
        .from('packages')
        .insert({
            name: data.name,
            description: data.description,
            price: data.price,
            stripe_product_id: product.id,
            stripe_price_id: price.id
        })

    if (error) throw new Error(error.message)
    return { success: true }
}

export async function updatePackage(id: string, data: { name: string, description: string, price: number }) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    // Get current package to check if price changed
    const { data: currentPkg } = await supabase
        .from('packages')
        .select('stripe_product_id, price, stripe_price_id')
        .eq('id', id)
        .single()

    if (!currentPkg) throw new Error('Package not found')

    let newStripePriceId = currentPkg.stripe_price_id

    // 1. Update Stripe Product (Name/Description)
    if (currentPkg.stripe_product_id) {
        await stripe.products.update(currentPkg.stripe_product_id, {
            name: data.name,
            description: data.description
        })
    }

    // 2. Handle Price Change
    if (data.price !== currentPkg.price && currentPkg.stripe_product_id) {
        // Create NEW Price
        const price = await stripe.prices.create({
            product: currentPkg.stripe_product_id,
            unit_amount: Math.round(data.price * 100),
            currency: 'eur',
            recurring: {
                interval: 'month',
            },
        })
        newStripePriceId = price.id

        // Update Product Default Price
        await stripe.products.update(currentPkg.stripe_product_id, {
            default_price: price.id
        })
    }

    // 3. Update DB
    const { error } = await supabase
        .from('packages')
        .update({
            name: data.name,
            description: data.description,
            price: data.price,
            stripe_price_id: newStripePriceId
        })
        .eq('id', id)

    if (error) throw new Error(error.message)
    return { success: true }
}

export async function createBunnyVideo(title: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
    const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim()

    if (!libraryId || !apiKey) {
        throw new Error('Missing Bunny configuration')
    }

    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'POST',
        headers: {
            'AccessKey': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ title }),
    })

    if (!response.ok) {
        throw new Error(`Failed to create video in Bunny: ${response.statusText}`)
    }

    return await response.json()
}

export async function saveVideoToDb(videoData: { title: string, bunnyId: string, packageId: string }) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { data: maxOrder } = await supabase
        .from('videos')
        .select('order_index')
        .eq('package_id', videoData.packageId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single()

    const newIndex = (maxOrder?.order_index ?? 0) + 1

    const { error } = await supabase
        .from('videos')
        .insert({
            title: videoData.title,
            bunny_video_id: videoData.bunnyId,
            package_id: videoData.packageId,
            order_index: newIndex
        })

    if (error) throw new Error(error.message)
    return { success: true }
}

export async function getAdminVideos(packageId?: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    let query = supabase
        .from('videos')
        .select(`
            id, 
            title, 
            bunny_video_id, 
            package_id,
            packages (
                name
            )
        `)
        .limit(100)

    if (packageId) {
        query = query.eq('package_id', packageId)
    }

    const { data: videos, error } = await query

    if (error) throw new Error(error.message)
    return videos
}

export async function deleteVideo(videoId: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { data: video } = await supabase
        .from('videos')
        .select('bunny_video_id')
        .eq('id', videoId)
        .single()

    if (video?.bunny_video_id) {
        const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
        const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim()

        if (libraryId && apiKey) {
            try {
                await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${video.bunny_video_id}`, {
                    method: 'DELETE',
                    headers: {
                        'AccessKey': apiKey,
                        'Accept': 'application/json',
                    },
                })
            } catch (err) {
                console.error('Failed to delete from Bunny:', err)
            }
        }
    }

    const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId)

    if (error) throw new Error(error.message)
    return { success: true }
}

export async function updateVideo(videoId: string, data: { title: string, packageId: string }) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { error } = await supabase
        .from('videos')
        .update({
            title: data.title,
            package_id: data.packageId
        })
        .eq('id', videoId)

    if (error) throw new Error(error.message)
    return { success: true }
}

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

    let totalVideos = 0
    let totalViews = 0
    let bandwidthUsed = 0

    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
    const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim()

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
                refunded: c.refunded
            })),
            subscriptions: subscriptions.data.map(s => ({
                id: s.id,
                status: s.status,
                amount: s.items.data[0]?.price.unit_amount ? s.items.data[0].price.unit_amount / 100 : 0,
                interval: s.items.data[0]?.price.recurring?.interval || 'month',
                email: (s.customer as Stripe.Customer)?.email || '',
                next_invoice: (s as any).current_period_end || s.ended_at || s.created
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
