'use client'

import { useEffect, useState } from 'react'
import { getSignedVideoUrl } from '@/app/actions/video'
import { AlertCircle, Loader2 } from 'lucide-react'

interface VideoPlayerProps {
    videoId: string
}

export default function VideoPlayer({ videoId }: VideoPlayerProps) {
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [iframeLoaded, setIframeLoaded] = useState(false)

    useEffect(() => {
        let mounted = true

        async function fetchUrl() {
            try {
                setLoading(true)
                setError(null)
                const signedUrl = await getSignedVideoUrl(videoId)

                if (mounted) {
                    setUrl(signedUrl)
                }
            } catch (err) {
                if (mounted) {
                    console.error('Failed to get signed URL:', err)
                    setError('Abbonamento richiesto per questo contenuto.')
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        fetchUrl()

        return () => {
            mounted = false
        }
    }, [videoId])

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
            {/* Loading State (Initial Fetch or Iframe Loading) */}
            {(loading || !url || !iframeLoaded) && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10 transition-opacity duration-500">
                    <div className="flex flex-col items-center gap-3">
                        {/* Skeleton-like pulse effect */}
                        <Loader2 className="h-10 w-10 animate-spin text-white/50" />
                        <p className="text-sm text-white/50 font-light tracking-wide">Caricamento video...</p>
                    </div>
                </div>
            )}

            {/* Video Iframe */}
            {url && (
                <iframe
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
        </div>
    )
}
