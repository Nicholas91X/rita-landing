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

    const { error } = await supabase
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

    if (error) {
        console.error('Error saving video progress:', error)
        throw new Error('Errore durante il salvataggio del progresso: ' + error.message)
    }

    return { success: true }
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
