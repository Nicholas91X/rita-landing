'use client'

import { useEffect, useState, useRef } from 'react'
import { getSignedVideoUrl, saveVideoProgress } from '@/app/actions/video'
import { AlertCircle, Loader2 } from 'lucide-react'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { useVideoPlaybackLock } from '@/hooks/useVideoPlaybackLock'
import { PlaybackBlockedDialog } from './PlaybackBlockedDialog'

interface VideoPlayerProps {
    videoId: string
    initialTime?: number
    onProgressUpdate?: () => void
    isAdmin?: boolean
}

export default function VideoPlayer({ videoId, initialTime = 0, onProgressUpdate, isAdmin = false }: VideoPlayerProps) {
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [iframeLoaded, setIframeLoaded] = useState(false)
    const [status, setStatus] = useState<'idle' | 'connected' | 'saving' | 'error'>('idle')
    const [loadingLabel, setLoadingLabel] = useState('Caricamento video...')
    const durationRef = useRef<number>(0)
    const lastSavedTime = useRef<number>(0)
    const lastLoadedVideoId = useRef<string | null>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const lock = useVideoPlaybackLock(videoId, isAdmin)

    useEffect(() => {
        // Prevent re-fetching when only initialTime changes for the SAME video
        if (lastLoadedVideoId.current === videoId && url) return

        let mounted = true

        async function fetchUrl() {
            try {
                setLoading(true)
                setError(null)
                setLoadingLabel('Caricamento video...')
                const labelTimer = setTimeout(() => setLoadingLabel('Connessione al server...'), 3000)
                let signedUrl = await getSignedVideoUrl(videoId)
                clearTimeout(labelTimer)

                // Add api=true to enable Player.js communication
                const separator = signedUrl.includes('?') ? '&' : '?'
                signedUrl += `${separator}api=true`

                // Add initial time if requested
                if (initialTime > 0) {
                    signedUrl += `&t=${Math.floor(initialTime)}`
                }

                if (mounted) {
                    setUrl(signedUrl)
                    lastLoadedVideoId.current = videoId
                }
            } catch (_err) {
                if (mounted) {
                    logger.error('Failed to get signed URL:', _err)
                    setError('Errore di caricamento video.')
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        fetchUrl()
        lastSavedTime.current = initialTime // Start from where we loaded
        durationRef.current = 0

        return () => {
            mounted = false
        }
    }, [videoId, initialTime, url])

    const onProgressUpdateRef = useRef(onProgressUpdate)
    useEffect(() => {
        onProgressUpdateRef.current = onProgressUpdate
    }, [onProgressUpdate])

    // Sub-4: react to lock state changes. For BOTH 'blocked' (second device
    // attempting to play while another device holds the lock) AND 'taken-over'
    // (this device lost its lock to another), we must force-pause the Bunny
    // iframe — otherwise the dialog is cosmetic and the user can dismiss it
    // while the video keeps playing, defeating the whole anti-sharing feature.
    useEffect(() => {
        if (lock.state === "blocked" || lock.state === "taken-over") {
            const msg = { context: "player.js", method: "pause" }
            iframeRef.current?.contentWindow?.postMessage(msg, "*")
            iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), "*")
            if (lock.state === "taken-over") {
                toast.info("Video messo in pausa: in riproduzione su un altro tuo dispositivo.")
            }
        }
        if (lock.state === "error" && lock.retryAfterSec) {
            toast.error(`Troppi tentativi. Riprova fra ${lock.retryAfterSec}s.`)
            lock.dismissError()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lock.state, lock.retryAfterSec])

    // Listen to messages from Bunny.net player
    useEffect(() => {
        let subscriptionCount = 0
        const isConnected = false

        const subscribeToEvents = () => {
            if (!iframeRef.current?.contentWindow || isConnected || subscriptionCount > 10) return
            const events = ['timeupdate', 'ended', 'ready', 'play', 'pause']
            subscriptionCount++

            events.forEach(event => {
                const msg = {
                    context: 'player.js',
                    method: 'addEventListener',
                    value: event
                }
                iframeRef.current?.contentWindow?.postMessage(msg, '*')
                iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*')
            })
        }

        const handleMessage = async (event: MessageEvent) => {
            const origin = event.origin.toLowerCase()
            const isBunny = origin.includes('mediadelivery.net') ||
                origin.includes('bunnycdn.com') ||
                origin.includes('bunny.net') ||
                origin.includes('mediadelivery')

            if (!isBunny) return

            if (status === 'idle') {
                setStatus('connected')
            }

            try {
                let data = event.data
                if (typeof data === 'string' && (data.includes('{') || data.includes('player.js'))) {
                    try {
                        data = JSON.parse(data)
                    } catch {
                        return
                    }
                }

                // Standardize fields
                const eventName = (data.event || data.eventName || data.method || (typeof data === 'string' ? data : '')).toString().toLowerCase()
                const value = data.value || data.data || data

                if (eventName.includes('ready')) {
                    subscribeToEvents()
                }

                // Sub-4: playback lock — claim on play, release on end, stop heartbeat on pause.
                // Must be BEFORE the existing progress-tracking logic so the lock is always
                // up-to-date before progress is saved.
                //
                // Use exact match (not includes) to avoid double-triggering on events whose
                // name contains "play" as substring (e.g. "playing" / "playback" if Bunny
                // starts emitting them in the future). Spurious onPlay calls while already
                // in 'owned' state cause a redundant claim that could race with heartbeats.
                const isPlayEvent = eventName === "play"
                const isPauseEvent = eventName === "pause"
                const isEndedForLock = eventName === "ended" || eventName === "complete" || eventName === "finish"

                if (isPlayEvent) {
                    void lock.onPlay()
                }
                if (isPauseEvent) {
                    lock.onPause()
                }
                if (isEndedForLock) {
                    lock.onEnded()
                }

                // Duration capture
                let msgDuration = 0
                if (typeof value === 'object' && value !== null) {
                    msgDuration = value.duration || value.totalTime || (Array.isArray(value) && value[0]?.duration) || 0
                } else if (typeof data === 'object' && data !== null) {
                    msgDuration = data.duration || data.totalTime || 0
                }

                if (msgDuration > 0 && !durationRef.current) {
                    durationRef.current = Math.floor(msgDuration)
                }

                // Progress tracking
                const isTimeUpdate = eventName.includes('time') || eventName.includes('progress')
                const isPaused = eventName.includes('pause')

                if (isTimeUpdate || isPaused) {
                    let seconds = -1
                    if (typeof value === 'object' && value !== null) {
                        seconds = value.seconds ?? value.currentTime ?? (Array.isArray(value) && value[0]?.seconds) ?? -1
                    } else if (typeof value === 'number') {
                        seconds = value
                    }

                    if (seconds >= 0) {
                        const currentTime = Math.floor(seconds)
                        const currentDuration = Math.floor(msgDuration || durationRef.current || 0)

                        // Save every 10 seconds, OR immediately if the video is paused
                        const timeDiff = Math.abs(currentTime - lastSavedTime.current)
                        const shouldSave = currentDuration > 0 && (timeDiff >= 10 || (isPaused && timeDiff > 0))

                        if (shouldSave) {
                            lastSavedTime.current = currentTime
                            try {
                                setStatus('saving')
                                const result = await saveVideoProgress({
                                    video_id: videoId,
                                    progress_seconds: Math.floor(currentTime),
                                    duration_seconds: Math.floor(currentDuration),
                                })
                                if (!result.ok) {
                                    logger.error('Save failed:', result.message)
                                    setStatus('error')
                                } else {
                                    setStatus('connected')
                                    onProgressUpdateRef.current?.()
                                }
                            } catch (saveErr) {
                                logger.error('Save failed:', saveErr)
                                setStatus('error')
                            }
                        }
                    }
                }

                // Completion tracking - Very high priority for short videos
                const isEnded = eventName.includes('ended') ||
                    eventName.includes('complete') ||
                    eventName.includes('finish')

                if (isEnded) {
                    const finalDuration = Math.floor(msgDuration || durationRef.current || 0)
                    if (finalDuration > 0) {
                        try {
                            setStatus('saving')
                            const result = await saveVideoProgress({
                                video_id: videoId,
                                progress_seconds: finalDuration,
                                duration_seconds: finalDuration,
                            })
                            if (!result.ok) {
                                setStatus('error')
                            } else {
                                setStatus('connected')
                                onProgressUpdateRef.current?.()
                            }
                        } catch {
                            setStatus('error')
                        }
                    }
                }
            } catch (outerErr) {
                logger.error('Video message handler error:', outerErr)
            }
        }

        window.addEventListener('message', handleMessage)

        // Try to subscribe every 3 seconds, stop after success or 10 tries
        const timer = setInterval(() => {
            if (isConnected || subscriptionCount > 10) {
                clearInterval(timer)
            } else {
                subscribeToEvents()
            }
        }, 3000)

        const iframe = iframeRef.current
        if (iframe) {
            iframe.addEventListener('load', subscribeToEvents)
        }

        return () => {
            window.removeEventListener('message', handleMessage)
            clearInterval(timer)
            if (iframe) {
                iframe.removeEventListener('load', subscribeToEvents)
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, status])

    if (error) {
        return (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                <div className="flex flex-col items-center gap-2 text-center p-4">
                    <AlertCircle className="h-8 w-8" />
                    <p className="font-medium">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl">
            {/* Status Indicator */}
            <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-20 transition-colors duration-500 ${status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                status === 'saving' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)] animate-pulse' :
                    status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-white/20'
                }`} title={
                    status === 'connected' ? 'Video Tracker Attivo' :
                        status === 'saving' ? 'Salvataggio in corso...' :
                            status === 'error' ? 'Errore di salvataggio!' : 'In attesa del segnale video...'
                } />
            {/* Loading State (Initial Fetch or Iframe Loading) */}
            {(loading || !url || !iframeLoaded) && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10 transition-opacity duration-500">
                    <div className="flex flex-col items-center gap-3">
                        {/* Skeleton-like pulse effect */}
                        <Loader2 className="h-10 w-10 animate-spin text-white/50" />
                        <p className="text-sm text-white/50 font-light tracking-wide">{loadingLabel}</p>
                    </div>
                </div>
            )}

            {/* Video Iframe */}
            {url && (
                <iframe
                    ref={iframeRef}
                    src={url}
                    referrerPolicy="origin"
                    className={`h-full w-full transition-opacity duration-700 ease-in-out ${iframeLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    loading="lazy"
                    onLoad={() => setIframeLoaded(true)}
                    title="Video content"
                />
            )}
            <PlaybackBlockedDialog
                open={lock.state === "blocked" || lock.state === "taken-over"}
                byDeviceLabel={lock.blockedBy?.deviceLabel ?? null}
                onTakeover={() => { void lock.takeover() }}
                onDismiss={() => { lock.dismissError() }}
            />
        </div>
    )
}
