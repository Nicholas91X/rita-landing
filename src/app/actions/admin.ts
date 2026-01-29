'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

export async function getAdminPackages() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: packages, error } = await supabase
        .from('packages')
        .select(`
            *,
            title,
            payment_mode,
            courses (
                name
            )
        `)
        .order('name')

    if (error) throw new Error(error.message)
    return packages
}

export async function getAdminCourses() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: courses, error } = await supabase
        .from('courses')
        .select(`
            id,
            name,
            levels (
                name
            )
        `)
        .order('name')

    if (error) throw new Error(error.message)
    return courses
}

export async function createPackage(formData: FormData) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const name = formData.get('name') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priceAmount = parseFloat(formData.get('price') as string)
    const courseId = formData.get('course_id') as string
    const badgeType = formData.get('badge_type') as string
    const paymentMode = formData.get('payment_mode') as 'subscription' | 'payment' || 'subscription'
    const imageFile = formData.get('image') as File

    // 1. Create Product in Stripe
    const product = await stripe.products.create({
        name: name,
        description: description,
    })

    // 2. Create Price in Stripe
    const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(priceAmount * 100), // Convert to cents
        currency: 'eur',
        recurring: paymentMode === 'subscription' ? {
            interval: 'month',
        } : undefined,
    })

    const supabase = await createClient()
    let imageUrl = null

    // 3. Handle Image Upload
    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage
            .from('package-images')
            .upload(fileName, imageFile)

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
                .from('package-images')
                .getPublicUrl(fileName)
            imageUrl = publicUrl
        }
    }

    // 4. Save to DB
    const { error } = await supabase
        .from('packages')
        .insert({
            name: name,
            title: title || null,
            description: description,
            price: priceAmount,
            course_id: courseId,
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            badge_type: badgeType,
            payment_mode: paymentMode,
            image_url: imageUrl
        })

    if (error) throw new Error(error.message)
    return { success: true }
}

export async function updatePackage(id: string, formData: FormData) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const name = formData.get('name') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priceAmount = parseFloat(formData.get('price') as string)
    const courseId = formData.get('course_id') as string
    const badgeType = formData.get('badge_type') as string
    const paymentMode = formData.get('payment_mode') as 'subscription' | 'payment' || 'subscription'
    const imageFile = formData.get('image') as File
    const removeImage = formData.get('removeImage') === 'true'

    const supabase = await createClient()

    // Get current package
    const { data: currentPkg } = await supabase
        .from('packages')
        .select('stripe_product_id, price, stripe_price_id, image_url')
        .eq('id', id)
        .single()

    if (!currentPkg) throw new Error('Package not found')

    let newStripePriceId = currentPkg.stripe_price_id
    let newImageUrl = currentPkg.image_url

    // 1. Update Stripe Product
    if (currentPkg.stripe_product_id) {
        await stripe.products.update(currentPkg.stripe_product_id, {
            name: name,
            description: description
        })
    }

    // 2. Handle Price Change
    if (priceAmount !== currentPkg.price && currentPkg.stripe_product_id) {
        const price = await stripe.prices.create({
            product: currentPkg.stripe_product_id,
            unit_amount: Math.round(priceAmount * 100),
            currency: 'eur',
            recurring: paymentMode === 'subscription' ? {
                interval: 'month',
            } : undefined,
        })
        newStripePriceId = price.id
        await stripe.products.update(currentPkg.stripe_product_id, {
            default_price: price.id
        })
    }

    // 3. Handle External Image Changes
    if (removeImage || (imageFile && imageFile.size > 0)) {
        // Cleanup old image
        if (currentPkg.image_url) {
            const oldFileName = currentPkg.image_url.split('/').pop()
            if (oldFileName) {
                await supabase.storage.from('package-images').remove([oldFileName])
            }
        }
        newImageUrl = null
    }

    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage
            .from('package-images')
            .upload(fileName, imageFile)

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
                .from('package-images')
                .getPublicUrl(fileName)
            newImageUrl = publicUrl
        }
    }

    // 4. Update DB
    const { error } = await supabase
        .from('packages')
        .update({
            name: name,
            title: title || null,
            description: description,
            price: priceAmount,
            course_id: courseId,
            stripe_price_id: newStripePriceId,
            badge_type: badgeType,
            payment_mode: paymentMode,
            image_url: newImageUrl
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

export async function saveVideoToDb(videoData: {
    title: string,
    bunnyId: string,
    packageId: string,
    tappa?: string,
    videoType?: string,
    duration?: number
}) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { data: maxOrder } = await supabase
        .from('videos')
        .select('order_index')
        .eq('package_id', videoData.packageId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()

    const newIndex = (maxOrder?.order_index ?? 0) + 1

    const { error } = await supabase
        .from('videos')
        .insert({
            title: videoData.title,
            bunny_video_id: videoData.bunnyId,
            package_id: videoData.packageId,
            order_index: newIndex,
            tappa: videoData.tappa || null,
            video_type: videoData.videoType || null,
            duration_minutes: videoData.duration || null
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
            order_index,
            tappa,
            video_type,
            duration_minutes,
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

export async function updateVideo(videoId: string, data: {
    title: string,
    packageId: string,
    tappa?: string,
    videoType?: string,
    duration?: number,
    orderIndex?: number
}) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { error } = await supabase
        .from('videos')
        .update({
            title: data.title,
            package_id: data.packageId,
            tappa: data.tappa,
            video_type: data.videoType,
            duration_minutes: data.duration,
            order_index: data.orderIndex
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

    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
    const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim()

    let totalVideos = 0
    let totalViews = 0
    let bandwidthUsed = 0

    if (libraryId && apiKey) {
        try {
            // General Info
            const videoRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?itemsPerPage=1`, {
                headers: { 'AccessKey': apiKey }
            })
            if (videoRes.ok) {
                const videoData = await videoRes.json()
                totalVideos = videoData.totalItems || 0
            }

            // Stats Logic: Bunny stats can be delayed. 
            // We fetch the last 30 days but prioritize showing that there IS activity.
            const dateTo = new Date().toISOString().split('T')[0]
            const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            const statsRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
                headers: { 'AccessKey': apiKey }
            })

            if (statsRes.ok) {
                const statsData = await statsRes.json()
                // Bunny returns an object with views and bandwidthUsed
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

export async function getAdminNotifications() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: notifications, error } = await supabase
        .from('admin_notifications')
        .select(`
            *,
            profiles ( full_name, email )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching admin notifications:', error)
        return []
    }

    return notifications
}

export async function markNotificationAsRead(id: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', id)

    if (error) console.error('Error marking notification as read:', error)
}

export async function getRefundRequests() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: requests, error } = await supabase
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
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching refund requests:', error)
        return []
    }

    return requests
}

export async function handleRefundRequest(requestId: string, status: 'approved' | 'rejected') {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    // 1. Get request details
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

    // 2. If approved, try to refund on Stripe
    if (status === 'approved') {
        try {
            if (request.subscription_id && request.user_subscriptions?.stripe_subscription_id) {
                // Find the latest charge for this subscription
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

                // Cancel subscription immediately if it was a refund of the current period
                await stripe.subscriptions.cancel(request.user_subscriptions.stripe_subscription_id)
            } else if (request.purchase_id) {
                // Handle one-time purchase refund
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

    // 3. Update request status
    const { error: updateError } = await supabase
        .from('refund_requests')
        .update({
            status,
            processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

    if (updateError) throw new Error('Errore durante l\'aggiornamento della richiesta')

    // 4. Update status if approved
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

    // 5. Notify User
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
    // 6. Revalidate
    revalidatePath('/admin')
    revalidatePath('/dashboard')

    return { success: true }
}

export async function getAdminUsers() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: users, error } = await supabase
        .from('profiles')
        .select(`
            *,
            user_subscriptions ( id ),
            one_time_purchases ( id )
        `)
        .order('full_name', { ascending: true })

    if (error) {
        console.error('Error fetching admin users:', error)
        throw new Error('Errore durante il recupero della lista utenti')
    }

    return (users || []).map(user => ({
        ...user,
        total_operations: (user.user_subscriptions?.length || 0) + (user.one_time_purchases?.length || 0)
    }))
}

export async function getUserHistory(userId: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    // Fetch all related data
    const [
        { data: subscriptions },
        { data: purchases },
        { data: refunds }
    ] = await Promise.all([
        supabase.from('user_subscriptions').select('*, packages(name, price)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('one_time_purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('refund_requests').select('*, packages:user_subscriptions(packages(name))').eq('user_id', userId).order('created_at', { ascending: false })
    ])

    interface SubscriptionWithPackage {
        id: string
        status: string
        created_at: string
        packages: { name: string; price: number } | null
    }

    interface RefundWithPackage {
        id: string
        status: string
        created_at: string
        packages: { packages: { name: string } | null } | null
    }

    // Combine and label operations
    const history = [
        ...(subscriptions as unknown as SubscriptionWithPackage[] || []).map(s => ({
            id: s.id,
            type: 'subscription',
            title: `Abbonamento: ${s.packages?.name || 'N/A'}`,
            status: s.status,
            date: s.created_at,
            amount: s.status === 'trialing' ? 0 : s.packages?.price || 0
        })),
        ...(purchases || []).map(p => ({
            id: p.id,
            type: 'purchase',
            title: `Acquisto Singolo: ${p.item_type}`,
            status: 'completed',
            date: p.created_at,
            amount: 0 // We don't store price in one_time_purchases yet, but we could add it if needed
        })),
        ...(refunds as unknown as RefundWithPackage[] || []).map(r => ({
            id: r.id,
            type: 'refund_request',
            title: `Richiesta Rimborso: ${r.packages?.packages?.name || 'Percorso'}`,
            status: r.status,
            date: r.created_at,
            amount: 0
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return history
}


// Import for Supabase Admin (Service Role)
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function uploadClientDocument(formData: FormData) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const file = formData.get('file') as File
    const clientId = formData.get('clientId') as string

    if (!file || !clientId) throw new Error('Missing file or client ID')

    // Use Service Role Client for Storage to bypass RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceRoleKey || !supabaseUrl) {
        throw new Error('Server configuration error: Missing Service Role Key')
    }

    const sudo = createSupabaseClient(supabaseUrl, serviceRoleKey)

    // 1. Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${clientId}-${Date.now()}.${fileExt}`

    const uploadWithRetry = async (attemptCreate = true): Promise<{ error: unknown }> => {
        const { error } = await sudo.storage
            .from('client-documents')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: true
            })

        if (error && attemptCreate && (typeof error === 'object' && ('error' in error || 'message' in error))) {
            const err = error as { error?: string; message?: string };
            if (err.error === 'Bucket not found' || err.message?.includes('Bucket not found')) {
                console.log('Bucket not found, creating...')
                await sudo.storage.createBucket('client-documents', {
                    public: true,
                    fileSizeLimit: 10485760,
                    allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                })
                return uploadWithRetry(false)
            }
        }

        return { error }
    }

    const { error: uploadError } = await uploadWithRetry()

    if (uploadError) {
        console.error('Upload Error:', uploadError)
        const message = (uploadError && typeof uploadError === 'object' && 'message' in uploadError)
            ? (uploadError as { message: string }).message
            : 'Errore sconosciuto during upload'
        throw new Error(`Errore upload: ${message}`)
    }

    // 2. Get Public URL
    const { data: { publicUrl } } = sudo.storage
        .from('client-documents')
        .getPublicUrl(fileName)

    // 3. Update DB (Use standard client for DB)
    const supabase = await createClient()
    const { error: dbError } = await supabase
        .from('one_time_purchases')
        .update({ document_url: publicUrl })
        .eq('id', clientId)

    if (dbError) throw new Error('Errore durante l\'aggiornamento del database')

    revalidatePath('/admin')
    return { success: true, url: publicUrl }
}
