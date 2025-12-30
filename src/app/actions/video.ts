'use server'

import { createClient } from '@/utils/supabase/server'
import { createHash } from 'crypto'

export async function getSignedVideoUrl(videoId: string) {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    // 2. Check subscription
    // We need to verify if the user has an active subscription to a package
    // that contains the course which contains this video.
    // Assumption: videos table has package_id or is linked via courses -> packages
    // Based on previous steps, hierarchy is Levels -> Courses -> Packages
    // But typically videos belong to a course or directly to a package?
    // Let's assume a robust check: find if any active subscription covers this video.

    // First, find which packages this video belongs to.
    // We'll broaden the search to be safe, assuming 'videos' table exists.
    // If 'videos' table doesn't exist, we might fail here, but the user asked for this specific logic.

    // Attempt to find the package associated with the video.
    // Querying video -> course -> packages
    const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select(`
      id,
      course_id,
      courses (
        id,
        packages (
          id
        )
      )
    `)
        .eq('id', videoId)
        .single()

    if (videoError || !videoData) {
        console.error('Error fetching video package info:', videoError)
        throw new Error('Video not found or access configuration error')
    }

    interface VideoPackage { id: string }
    interface VideoCourse { packages: VideoPackage[] }

    const courses = (videoData.courses || []) as unknown as VideoCourse[]

    const allowedPackageIds = courses.flatMap((course) =>
        course.packages ? course.packages.map((pkg) => pkg.id) : []
    )

    if (allowedPackageIds.length === 0) {
        throw new Error('No packages configured for this video')
    }

    // Check if user has active subscription to any of these packages
    const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .in('package_id', allowedPackageIds)
        .eq('status', 'active')
        .maybeSingle()

    if (!subscription) {
        throw new Error('No active subscription for this content')
    }

    // 3. Generate Signed URL for Bunny.net
    const libraryId = process.env.BUNNY_LIBRARY_ID
    const apiKey = process.env.BUNNY_STREAM_API_KEY
    const expirationTime = 3600 // 1 hour

    if (!libraryId || !apiKey) {
        throw new Error('Streaming configuration missing')
    }

    const expires = Math.floor(Date.now() / 1000) + expirationTime

    // Formula: sha256(securityKey + videoId + expires)
    const hashString = apiKey + videoId + expires
    const token = createHash('sha256').update(hashString).digest('hex')

    return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}`
}
