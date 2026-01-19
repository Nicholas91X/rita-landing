'use server'

import { createClient } from '@/utils/supabase/server'
import { createHash } from 'crypto'

export async function getSignedVideoUrl(videoUuid: string) {
    const supabase = await createClient()

    // 1. Autenticazione utente
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autorizzato')

    // 2. Recupera info video e verifica permessi
    // Usiamo il tuo schema reale: videos -> package_id
    const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('bunny_video_id, package_id')
        .eq('id', videoUuid)
        .single()

    if (videoError || !videoData) {
        console.error('Video non trovato nel DB:', videoError)
        throw new Error('Video non trovato')
    }

    // 3. Verifica se l'utente ha sbloccato QUEL pacchetto specifico
    const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('package_id', videoData.package_id)
        .eq('status', 'active')
        .maybeSingle()

    if (!subscription) {
        throw new Error('Abbonamento non attivo per questo pacchetto')
    }

    // 4. Generazione URL firmato per Bunny.net
    // Assicurati che queste variabili siano nel tuo .env.local
    const libraryId = process.env.BUNNY_LIBRARY_ID
    const securityKey = process.env.BUNNY_STREAM_API_KEY
    const expirationTime = 3600 // 1 ora

    if (!libraryId || !securityKey) {
        throw new Error('Configurazione streaming mancante nel file .env')
    }

    const expires = Math.floor(Date.now() / 1000) + expirationTime
    const bunnyId = videoData.bunny_video_id

    // Formula corretta Bunny.net: sha256(securityKey + videoId + expires)
    const hashString = securityKey + bunnyId + expires
    const token = createHash('sha256').update(hashString).digest('hex')

    return `https://iframe.mediadelivery.net/embed/${libraryId}/${bunnyId}?token=${token}&expires=${expires}`
}

export async function saveVideoProgress(videoId: string, progressSeconds: number, durationSeconds: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Non autorizzato')

    const isCompleted = progressSeconds >= (durationSeconds * 0.95) // 95% is considered completed

    const { error: upsertError } = await supabase
        .from('video_watch_progress')
        .upsert({
            user_id: user.id,
            video_id: videoId,
            progress_seconds: Math.floor(progressSeconds),
            duration_seconds: Math.floor(durationSeconds),
            is_completed: isCompleted,
            last_watched_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,video_id'
        })

    if (upsertError) {
        console.error('Error saving video progress:', upsertError)
        throw new Error('Errore durante il salvataggio del progresso: ' + upsertError.message)
    }

    // If video was just completed, check for package completion
    if (isCompleted) {
        await checkAndAwardPackageBadge(user.id, videoId)
    }

    return { success: true }
}

async function checkAndAwardPackageBadge(userId: string, videoId: string) {
    const supabase = await createClient()

    // 1. Find the package this video belongs to
    const { data: videoData } = await supabase
        .from('videos')
        .select('package_id')
        .eq('id', videoId)
        .single()

    if (!videoData) return

    const packageId = videoData.package_id

    // 2. Get all videos in this package
    const { data: pkgVideos } = await supabase
        .from('videos')
        .select('id')
        .eq('package_id', packageId)

    if (!pkgVideos || pkgVideos.length === 0) return

    // 3. Get completed videos for this user in this package
    const videoIds = pkgVideos.map(v => v.id)
    const { data: completedProgress } = await supabase
        .from('video_watch_progress')
        .select('video_id')
        .eq('user_id', userId)
        .in('video_id', videoIds)
        .eq('is_completed', true)

    const completedCount = completedProgress?.length || 0

    // 4. If all videos are completed, award badge
    if (completedCount === pkgVideos.length) {
        // Get package badge_type
        const { data: pkg } = await supabase
            .from('packages')
            .select('name, badge_type')
            .eq('id', packageId)
            .single()

        if (!pkg || !pkg.badge_type) return

        // Insert badge (protected by unique constraint user_id, package_id)
        const { error: badgeError } = await supabase
            .from('user_badges')
            .upsert({
                user_id: userId,
                package_id: packageId,
                badge_type: pkg.badge_type
            }, {
                onConflict: 'user_id,package_id'
            })

        // 5. Send Notification if badge was newly earned
        if (!badgeError) {
            await supabase.from('user_notifications').insert({
                user_id: userId,
                title: '🎉 Nuovo Badge Sbloccato!',
                message: `Complimenti! Hai completato tutti i video di "${pkg.name}" e hai ottenuto il badge ${pkg.badge_type.toUpperCase()}.`,
                type: 'achievement'
            })
        }
    }
}

export async function getVideoProgress(videoId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('video_watch_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle()

    if (error) {
        console.error('Error fetching video progress:', error)
        return null
    }

    return data
}

export async function getAllPackageProgress(packageId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .eq('package_id', packageId)

    if (!videos) return []

    const videoIds = videos.map(v => v.id)

    const { data, error } = await supabase
        .from('video_watch_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('video_id', videoIds)

    if (error) {
        console.error('Error fetching all package progress:', error)
        return []
    }

    return data
}

export type LibraryProgress = {
    packageId: string;
    resumeVideoTitle?: string;
    resumeVideoId?: string;
    completionPercentage: number;
    isFullyCompleted: boolean;
}

export async function getLibraryProgress() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    // 1. Get all purchased packages
    const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('package_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])

    if (!subs || subs.length === 0) return []
    const packageIds = subs.map(s => s.package_id)

    // 2. Get all videos for these packages
    const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, title, package_id, order_index')
        .in('package_id', packageIds)
        .order('order_index', { ascending: true })

    if (videosError || !videos) return []

    // 3. Get all progress for these videos
    const { data: progress, error: progressError } = await supabase
        .from('video_watch_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('video_id', videos.map(v => v.id))

    if (progressError) return []

    // 4. Calculate progress per package
    const progressMap = new Map(progress?.map(p => [p.video_id, p]))
    const libraryProgress: LibraryProgress[] = packageIds.map(pkgId => {
        const pkgVideos = videos.filter(v => v.package_id === pkgId)
        if (pkgVideos.length === 0) return { packageId: pkgId, completionPercentage: 0, isFullyCompleted: false }

        let completedVideos = 0
        let totalProgressPoints = 0
        let lastWatchedVideo = null
        let nextUncompletedVideo = null

        for (const v of pkgVideos) {
            const p = progressMap.get(v.id)
            if (p) {
                if (p.is_completed) {
                    completedVideos++
                    totalProgressPoints += 1
                } else {
                    const percent = p.progress_seconds / p.duration_seconds
                    totalProgressPoints += percent
                    if (!lastWatchedVideo || new Date(p.last_watched_at) > new Date(lastWatchedVideo.last_watched_at)) {
                        lastWatchedVideo = { ...v, last_watched_at: p.last_watched_at }
                    }
                }
            } else if (!nextUncompletedVideo) {
                nextUncompletedVideo = v
            }
        }

        const isFullyCompleted = completedVideos === pkgVideos.length
        const completionPercentage = (totalProgressPoints / pkgVideos.length) * 100

        // Resume point:
        // 1. If currently watching something (last watched and not completed)
        // 2. Else first uncompleted video
        // 3. Else first video
        const resumeVideo = (!isFullyCompleted && lastWatchedVideo)
            ? lastWatchedVideo
            : (nextUncompletedVideo || pkgVideos[0])

        return {
            packageId: pkgId,
            resumeVideoTitle: resumeVideo?.title,
            resumeVideoId: resumeVideo?.id,
            completionPercentage,
            isFullyCompleted
        }
    })

    return libraryProgress
}

export async function reconcileUserBadges(userId: string) {
    const supabase = await createClient()

    // 1. Get all active packages for the user
    const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('package_id')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])

    if (!subs || subs.length === 0) return

    const packageIds = subs.map(s => s.package_id)

    // 2. Get already earned badges
    const { data: existingBadges } = await supabase
        .from('user_badges')
        .select('package_id')
        .eq('user_id', userId)

    const earnedPackageIds = new Set(existingBadges?.map(b => b.package_id) || [])

    // 3. Check unearned packages
    const unearnedPackageIds = packageIds.filter(id => !earnedPackageIds.has(id))

    for (const pkgId of unearnedPackageIds) {
        // Find if all videos are completed
        const { data: pkgVideos } = await supabase
            .from('videos')
            .select('id')
            .eq('package_id', pkgId)

        if (!pkgVideos || pkgVideos.length === 0) continue

        const videoIds = pkgVideos.map(v => v.id)
        const { data: completedProgress } = await supabase
            .from('video_watch_progress')
            .select('video_id')
            .eq('user_id', userId)
            .in('video_id', videoIds)
            .eq('is_completed', true)

        if (completedProgress?.length === pkgVideos.length) {
            // Award badge (borrow logic from checkAndAwardPackageBadge)
            const { data: pkg } = await supabase
                .from('packages')
                .select('name, badge_type')
                .eq('id', pkgId)
                .single()

            if (pkg && pkg.badge_type) {
                await supabase.from('user_badges').upsert({
                    user_id: userId,
                    package_id: pkgId,
                    badge_type: pkg.badge_type
                }, { onConflict: 'user_id,package_id' })

                await supabase.from('user_notifications').insert({
                    user_id: userId,
                    title: '🎉 Nuovo Badge Sbloccato!',
                    message: `Complimenti! Hai completato tutti i video di "${pkg.name}" e hai ottenuto il badge ${pkg.badge_type.toUpperCase()}.`,
                    type: 'achievement'
                })
            }
        }
    }
}
