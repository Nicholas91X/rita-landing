'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, PlayCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import VideoPlayer from '@/components/video/VideoPlayer'
import Section from '@/components/Section'
import { getAllPackageProgress } from '@/app/actions/video'

type Video = {
    id: string
    title: string
    bunny_video_id: string
}

type Package = {
    id: string
    name: string
    description: string
}

type WatchProgress = {
    video_id: string
    progress_seconds: number
    duration_seconds: number
    is_completed: boolean
    last_watched_at: string
}

export default function PackageClient({ pkg, videos }: { pkg: Package, videos: Video[] }) {
    const [activeVideo, setActiveVideo] = useState<Video>(videos[0])
    const [progressData, setProgressData] = useState<Record<string, WatchProgress>>({})
    const [loadingProgress, setLoadingProgress] = useState(true)

    const fetchProgress = useCallback(async () => {
        try {
            const data = await getAllPackageProgress(pkg.id)
            const map: Record<string, WatchProgress> = {}
            data.forEach((item: any) => {
                map[item.video_id] = item
            })
            setProgressData(map)
        } catch (error) {
            console.error('Failed to fetch progress:', error)
        } finally {
            setLoadingProgress(false)
        }
    }, [pkg.id])

    useEffect(() => {
        fetchProgress()
    }, [fetchProgress])

    // Refs for auto-scrolling
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // Scroll active video into view
    useEffect(() => {
        const el = itemRefs.current.get(activeVideo.id)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [activeVideo.id])

    return (
        <main className="min-h-screen bg-background pb-20">
            <Section className="py-4 md:py-8">
                <Link href="/dashboard" className="flex items-center text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors mb-4 md:mb-6">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Torna alla Dashboard
                </Link>

                <h1 className="h2 text-[var(--foreground)] mb-1 md:mb-2 text-2xl md:text-4xl">{pkg.name}</h1>
                <p className="text-[var(--muted-foreground)] mb-4 md:mb-8 text-sm md:text-base line-clamp-2 md:line-clamp-none">{pkg.description}</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
                    <div className="lg:col-span-2">
                        {loadingProgress ? (
                            <div className="aspect-video w-full flex items-center justify-center bg-white/5 rounded-xl animate-pulse">
                                <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
                            </div>
                        ) : (
                            <VideoPlayer
                                videoId={activeVideo.id}
                                initialTime={progressData[activeVideo.id]?.is_completed ? 0 : (progressData[activeVideo.id]?.progress_seconds || 0)}
                                onProgressUpdate={fetchProgress}
                            />
                        )}

                        <div className="mt-4 md:mt-6">
                            <h2 className="text-lg md:text-xl font-bold mb-2">{activeVideo.title}</h2>
                            {progressData[activeVideo.id]?.last_watched_at && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                    <Clock className="w-3 h-3" />
                                    Ultima visualizzazione: {new Date(progressData[activeVideo.id].last_watched_at).toLocaleDateString('it-IT')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                        <h3 className="font-semibold uppercase text-[10px] tracking-[0.2em] text-muted-foreground px-2 flex justify-between items-center">
                            Playlist lezioni
                            <span className="text-[9px] bg-[var(--brand-muted)] text-[var(--brand)] px-2 py-0.5 rounded-full font-bold">
                                {Object.values(progressData).filter(p => p.is_completed).length}/{videos.length} completate
                            </span>
                        </h3>
                        <div className="flex flex-col gap-2 max-h-[400px] md:max-h-[600px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                            {videos.map((v) => {
                                const isActive = v.id === activeVideo.id
                                const progress = progressData[v.id]
                                const percent = progress ? (progress.progress_seconds / progress.duration_seconds) * 100 : 0

                                return (
                                    <div
                                        key={v.id}
                                        ref={(el) => {
                                            if (el) itemRefs.current.set(v.id, el)
                                            else itemRefs.current.delete(v.id)
                                        }}
                                        onClick={() => setActiveVideo(v)}
                                        className={`p-3 md:p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden flex flex-col gap-2 ${isActive
                                            ? 'border-[var(--brand)] bg-[var(--brand-muted)]/30 text-[var(--brand)] ring-1 ring-[var(--brand)]'
                                            : 'border-white/5 bg-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {progress?.is_completed ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                                ) : isActive ? (
                                                    <PlayCircle className="h-4 w-4 animate-pulse shrink-0" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                                                )}
                                                <p className="font-bold text-sm md:text-base line-clamp-1">{v.title}</p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        {progress && !progress.is_completed && percent > 0 && (
                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                                                <div
                                                    className="h-full bg-[var(--brand)] transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        )}

                                        {progress?.last_watched_at && (
                                            <div className="text-[9px] text-muted-foreground/60 font-medium flex items-center gap-1">
                                                Visto il {new Date(progress.last_watched_at).toLocaleDateString('it-IT')}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </Section>
        </main>
    )
}
