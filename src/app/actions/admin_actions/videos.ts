'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'

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
