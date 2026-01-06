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
