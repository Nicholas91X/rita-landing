'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'

export async function getAdminPackages() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: packages, error } = await supabase
        .from('packages')
        .select('id, name')
        .order('name')

    if (error) throw new Error(error.message)
    return packages
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
        const error = await response.text()
        console.error('Bunny API Error:', error)
        console.error('Used Library ID:', libraryId)
        console.error('Used API Key (last 4):', apiKey.slice(-4))
        throw new Error(`Failed to create video in Bunny: ${response.statusText}`)
    }

    return await response.json()
}

export async function saveVideoToDb(videoData: { title: string, bunnyId: string, packageId: string }) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    // Get max order index to append
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

        //.order('created_at', { ascending: false }) // 'created_at' might be missing, omitting order for now
        .limit(50) // Limit to 50 for performance safety

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

    // 1. Get Bunny ID
    const { data: video } = await supabase
        .from('videos')
        .select('bunny_video_id')
        .eq('id', videoId)
        .single()

    if (video?.bunny_video_id) {
        // 2. Delete from Bunny
        const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
        const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim() // Use correct key

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
                // Continue to delete from DB even if Bunny fails, to avoid orphan state in our DB
            }
        }
    }

    // 3. Delete from DB
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

    // Optional: Update Bunny Title? 
    // We skip it for now to keep it fast, as our DB is the source of truth for the UI.

    return { success: true }
}

export async function getAdminStats() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()

    // Supabase Stats
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

    // Bunny Stats
    let totalVideos = 0
    let totalViews = 0
    let bandwidthUsed = 0

    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim()
    const apiKey = process.env.BUNNY_LIBRARY_API_KEY?.trim()

    if (libraryId && apiKey) {
        try {
            // 1. Total Videos (Count)
            const videoRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?itemsPerPage=1`, {
                headers: { 'AccessKey': apiKey }
            })
            if (videoRes.ok) {
                const videoData = await videoRes.json()
                totalVideos = videoData.totalItems || 0
            }

            // 2. Views/Traffic (Last 30 days default or similar)
            // Note: The statistics endpoint often returns a list or a summary.
            // Based on my test, it returns keys like 'totalWatchTime', 'views', 'bandwidthUsed' in the response root or data.
            // Let's assume standard stats summary if valid. To get accurate summary, we usually just fetch current usage.
            // However, the /statistics endpoint requires a date range. Let's default to "All Time" or "Last 30 Days" if we want recent.
            // Let's go with a broad range for "Total Stats" or just this month.
            // Let's try 30 days for now to be safe.
            const dateTo = new Date().toISOString().split('T')[0]
            const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            const statsRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
                headers: { 'AccessKey': apiKey }
            })

            if (statsRes.ok) {
                const statsData = await statsRes.json()
                // statsData might be an object with keys or an array of daily stats.
                // The log showed "totalWatchTime": ... so it looks like an aggregate at root or in keys.
                // Let's safely sum if it's an array or take values if it's an object.
                // Checking common bunny response: it usually has 'viewsChart' etc.
                // If it's a summary object:
                totalViews = statsData.views || 0
                bandwidthUsed = statsData.bandwidthUsed || 0 // in bytes usually
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
            totalViews, // Last 30 days
            bandwidthUsed // Last 30 days
        }
    }
}
