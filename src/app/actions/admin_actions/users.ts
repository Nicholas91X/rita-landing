'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

interface SubscriptionRecord {
    id: string
    status: string
    created_at: string
    packages: { name: string; price: number } | null
}

interface PurchaseRecord {
    id: string
    created_at: string
    item_type?: string
}

interface RefundRecord {
    id: string
    status: string
    created_at: string
    packages: { packages: { name: string } | null } | null
}

interface PurchaseUpdateResult {
    user_id: string
    package_id: string
    packages: { name: string; badge_type: string | null } | { name: string; badge_type: string | null }[] | null
}

export async function getAdminUsers(page: number = 1, pageSize: number = 10, search: string = '') {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
        .from('profiles')
        .select(`
            *,
            user_subscriptions ( id ),
            one_time_purchases ( id )
        `, { count: 'exact' })

    if (search) {
        if (search.includes('@') || search.length > 3 && !search.includes(' ')) {
            // Optimize for email or unambiguous single-word search (prefix matching)
            query = query.or(`email.ilike.${search}%,full_name.ilike.${search}%`)
        } else {
            // Fallback to broad search
            query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        }
    }

    const { data: users, error, count } = await query
        .order('full_name', { ascending: true })
        .range(from, to)

    if (error) {
        console.error('Error fetching admin users:', error)
        throw new Error('Errore durante il recupero della lista utenti')
    }

    const formattedUsers = (users || []).map(user => ({
        ...user,
        total_operations: (user.user_subscriptions?.length || 0) + (user.one_time_purchases?.length || 0)
    }))

    return {
        data: formattedUsers,
        totalCount: count || 0
    }
}

export async function getUserHistory(userId: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const [
        { data: subscriptions },
        { data: purchases },
        { data: refunds }
    ] = await Promise.all([
        supabase.from('user_subscriptions').select('*, packages(name, price)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('one_time_purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('refund_requests').select('*, packages:user_subscriptions(packages(name))').eq('user_id', userId).order('created_at', { ascending: false })
    ])

    const history = [
        ...((subscriptions || []) as SubscriptionRecord[]).map((s) => ({
            id: s.id,
            type: 'subscription',
            title: `Abbonamento: ${s.packages?.name || 'N/A'}`,
            status: s.status,
            date: s.created_at,
            amount: s.status === 'trialing' ? 0 : s.packages?.price || 0
        })),
        ...((purchases || []) as PurchaseRecord[]).map((p) => ({
            id: p.id,
            type: 'purchase',
            title: `Acquisto Singolo: ${p.item_type || 'Pacchetto'}`,
            status: 'completed',
            date: p.created_at,
            amount: 0
        })),
        ...((refunds || []) as RefundRecord[]).map((r) => ({
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

export async function uploadClientDocument(formData: FormData) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const file = formData.get('file') as File
    const clientId = formData.get('clientId') as string

    if (!file || !clientId) throw new Error('Missing file or client ID')

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceRoleKey || !supabaseUrl) {
        throw new Error('Server configuration error: Missing Service Role Key')
    }

    const sudo = createSupabaseClient(supabaseUrl, serviceRoleKey)

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
    if (uploadError) throw new Error('Errore durante l\'upload')

    const { data: { publicUrl } } = sudo.storage.from('client-documents').getPublicUrl(fileName)

    const supabase = await createClient()
    await supabase.from('one_time_purchases').update({ document_url: publicUrl }).eq('id', clientId)

    revalidatePath('/admin')
    return { success: true, url: publicUrl }
}

export async function getAdminNotifications(page: number = 1, pageSize: number = 6) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: notifications, error, count } = await supabase
        .from('admin_notifications')
        .select(`
            *,
            profiles ( full_name, email )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) return { data: [], totalCount: 0 }

    return {
        data: notifications || [],
        totalCount: count || 0
    }
}

export async function markNotificationAsRead(id: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id)
}

export async function sendBroadcastNotification(title: string, message: string, audience: 'all' | 'subscribers' | 'one-time') {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    let userIds: string[] = []

    if (audience === 'all') {
        const { data } = await supabase.from('profiles').select('id')
        userIds = (data || []).map(u => u.id)
    } else if (audience === 'subscribers') {
        const { data } = await supabase.from('user_subscriptions').select('user_id').in('status', ['active', 'trialing'])
        userIds = Array.from(new Set((data || []).map(u => u.user_id)))
    } else if (audience === 'one-time') {
        const { data } = await supabase.from('one_time_purchases').select('user_id').neq('status', 'refunded')
        userIds = Array.from(new Set((data || []).map(u => u.user_id)))
    }

    if (userIds.length === 0) return { success: true, count: 0 }

    const notifications = userIds.map(id => ({
        user_id: id,
        title,
        message,
        type: 'broadcast',
        is_read: false
    }))

    const chunkSize = 1000
    for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize)
        await supabase.from('user_notifications').insert(chunk)
    }

    revalidatePath('/dashboard')
    return { success: true, count: userIds.length }
}

export async function updateOneTimePurchaseStatus(id: string, newStatus: string) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    const { data: purchaseData, error } = await supabase
        .from('one_time_purchases')
        .update({ status: newStatus })
        .eq('id', id)
        .select('user_id, package_id, packages(name, badge_type)')
        .single()

    if (error) throw new Error('Errore durante l\'aggiornamento')

    const purchase = purchaseData as PurchaseUpdateResult
    const pkg = Array.isArray(purchase.packages) ? purchase.packages[0] : purchase.packages

    if (newStatus === 'delivered' && pkg?.badge_type) {
        const { error: badgeError } = await supabase
            .from('user_badges')
            .upsert({ user_id: purchase.user_id, package_id: purchase.package_id, badge_type: pkg.badge_type }, { onConflict: 'user_id,package_id' })

        if (!badgeError) {
            await supabase.from('user_notifications').insert({
                user_id: purchase.user_id,
                title: '🎉 Nuovo Badge Sbloccato!',
                message: `Complimenti! Il tuo percorso "${pkg.name}" è pronto e hai ottenuto il badge ${pkg.badge_type.toUpperCase()}.`,
                type: 'achievement'
            })
        }
    } else {
        const statusMap: Record<string, string> = {
            'ordered': 'Preso in carico',
            'shipped': 'In spedizione / In preparazione',
            'delivered': 'Consegnato',
            'paid': 'Pagato',
            'canceled': 'Annullato'
        }
        const friendlyStatus = statusMap[newStatus] || newStatus

        await supabase.from('user_notifications').insert({
            user_id: purchase.user_id,
            title: '📦 Aggiornamento Ordine',
            message: `Lo stato del tuo pacchetto "${pkg.name}" è ora: ${friendlyStatus}.`,
            type: 'status_update'
        })
    }

    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true }
}
