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
    order_index?: number
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

    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    useEffect(() => {
        const el = itemRefs.current.get(activeVideo.id)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [activeVideo.id])

    // Calculate a more precise completion rate that includes sub-lesson progress
    const preciseCompletionRate = videos.length > 0 ? (() => {
        const totalProgress = videos.reduce((acc, v) => {
            const p = progressData[v.id]
            if (!p) return acc
            if (p.is_completed) return acc + 1
            // Contribute partially based on percentage watched, but only if it's significant (>5%)
            const percent = p.progress_seconds / p.duration_seconds
            return acc + (percent > 0.05 ? percent : 0)
        }, 0)
        return (totalProgress / videos.length) * 100
    })() : 0

    return (
        <main className="h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--foreground)] selection:bg-[var(--brand)]/10">
            {/* Header / Navigation - Part of the flex flow */}
            <header className="flex-none relative z-[100] bg-[#B4A697] border-b border-white/10 shadow-xl pt-[safe-area-inset-top]">
                <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 md:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard?tab=library"
                            className="relative z-[110] flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all hover:bg-white/20 text-sm font-medium touch-manipulation"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden md:inline">Esci dalla lezione</span>
                            <span className="md:hidden">Esci</span>
                        </Link>

                        <div className="flex flex-col">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand)] mb-0.5 leading-none">Corso in corso</h2>
                            <h1 className="text-sm md:text-base font-bold text-white/90 truncate max-w-[150px] sm:max-w-[200px] lg:max-w-md">{pkg.name}</h1>
                        </div>
                    </div>

                    <div className="bg-white/10 border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center gap-3">
                        <div className="h-1.5 w-16 md:w-24 bg-black/20 rounded-full overflow-hidden hidden sm:block">
                            <div className="h-full bg-[var(--brand)] transition-all duration-1000 ease-out" style={{ width: `${preciseCompletionRate}%` }} />
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-white/80">{Math.round(preciseCompletionRate)}% <span className="hidden xs:inline">completato</span></span>
                    </div>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden min-h-0">
                {/* Main Content Area - Video Player */}
                <div className="flex-none lg:flex-1 bg-black/10 flex flex-col pt-6 lg:pt-10 pb-8 lg:pb-12 lg:overflow-y-auto custom-scrollbar">
                    <div className="flex-none flex flex-col">
                        <div className="w-full max-w-6xl mx-auto px-4 lg:px-10 flex flex-col">
                            {/* Immersive Video Container */}
                            <div className="relative group flex-none">
                                <div className="absolute -inset-4 bg-[var(--brand)]/20 blur-3xl rounded-full opacity-40 group-hover:opacity-60 transition-opacity duration-1000 hidden md:block" />
                                <div className="relative z-10 shadow-[0_20px_100px_rgba(0,0,0,0.6)] overflow-hidden rounded-2xl bg-black aspect-video w-full border border-white/5">
                                    {loadingProgress ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
                                        </div>
                                    ) : (
                                        <VideoPlayer
                                            videoId={activeVideo.id}
                                            initialTime={progressData[activeVideo.id]?.is_completed ? 0 : (progressData[activeVideo.id]?.progress_seconds || 0)}
                                            onProgressUpdate={fetchProgress}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Info Section below video */}
                            <div className="mt-8 lg:mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="px-4 py-1.5 rounded-lg bg-[var(--brand)] text-white text-[11px] font-black uppercase tracking-[0.1em] shadow-lg shadow-[var(--brand)]/20">
                                            In riproduzione
                                        </span>
                                        {progressData[activeVideo.id]?.is_completed && (
                                            <span className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-[0.1em] flex items-center gap-1.5 shadow-lg shadow-emerald-600/20">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Completata
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-3xl lg:text-5xl font-black text-[var(--foreground)] tracking-tight ts-white">
                                        {activeVideo.title}
                                    </h1>
                                    <div className="flex items-center gap-6 text-sm text-[var(--foreground)]/60 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[var(--brand)]" />
                                            <span>
                                                {progressData[activeVideo.id]?.last_watched_at
                                                    ? `Ultimo accesso: ${new Date(progressData[activeVideo.id].last_watched_at).toLocaleDateString('it-IT')}`
                                                    : 'Prima visualizzazione'}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-lg text-[var(--foreground)]/70 max-w-3xl leading-relaxed mt-4">
                                        {pkg.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar - Playlist with Glassmorphism */}
                <aside className="w-full lg:w-[400px] xl:w-[450px] bg-white/40 backdrop-blur-3xl lg:border-l border-white/20 flex flex-col h-auto min-h-[400px] lg:h-full relative z-30 shadow-2xl shrink-0">
                    {/* Progress Overview Header */}
                    <div className="p-6 lg:p-8 border-b border-[var(--brand)]/20">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--foreground)]/50">
                                Playlist Corso
                            </h2>
                            <span className="text-[10px] font-bold bg-white/10 px-2.5 py-1 rounded-full text-[var(--foreground)]">
                                {videos.filter(v => progressData[v.id]?.is_completed).length}/{videos.length} <span className="text-[var(--foreground)]/40 ml-1">Lezioni</span>
                            </span>
                        </div>
                    </div>

                    {/* Lesson Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-8 custom-scrollbar">
                        {[1, 2, 3, 4].map((weekNum) => {
                            const weekVideos = videos.filter(v => {
                                const index = v.order_index ?? (videos.indexOf(v) + 1);
                                if (weekNum === 1) return index >= 1 && index <= 3;
                                if (weekNum === 2) return index >= 4 && index <= 6;
                                if (weekNum === 3) return index >= 7 && index <= 9;
                                if (weekNum === 4) return index >= 10 && index <= 12;
                                return false;
                            });

                            if (weekVideos.length === 0) return null;

                            return (
                                <div key={`week-${weekNum}`} className="space-y-4">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className="h-px flex-1 bg-[var(--brand)]/20" />
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--brand)] whitespace-nowrap">
                                            Settimana {weekNum}
                                        </h3>
                                        <div className="h-px flex-1 bg-[var(--brand)]/20" />
                                    </div>

                                    <div className="space-y-3">
                                        {weekVideos.map((v) => {
                                            const globalIndex = videos.indexOf(v);
                                            const isActive = v.id === activeVideo.id
                                            const progress = progressData[v.id]
                                            const percent = progress ? (progress.progress_seconds / progress.duration_seconds) * 100 : 0
                                            const isDone = progress?.is_completed

                                            return (
                                                <div
                                                    key={v.id}
                                                    ref={(el) => {
                                                        if (el) itemRefs.current.set(v.id, el)
                                                        else itemRefs.current.delete(v.id)
                                                    }}
                                                    onClick={() => setActiveVideo(v)}
                                                    className={`relative p-4 rounded-2xl transition-all duration-300 cursor-pointer group flex flex-col gap-3 ${isActive
                                                        ? 'bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08)] scale-[1.02] ring-1 ring-[var(--brand)]/20'
                                                        : 'hover:bg-white/30 border border-transparent'
                                                        }`}
                                                >
                                                    {/* Active Glow Indicator */}
                                                    {isActive && (
                                                        <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--brand)] rounded-full shadow-[0_0_10px_rgba(244,101,48,0.5)]" />
                                                    )}

                                                    <div className="flex items-start gap-4">
                                                        {/* Thumbnail or Status Icon */}
                                                        <div className="relative shrink-0">
                                                            <div className={`h-16 w-24 rounded-lg overflow-hidden border border-white/5 relative ${isActive ? 'ring-2 ring-[var(--brand)]' : 'group-hover:ring-1 group-hover:ring-white/20'}`}>
                                                                <div className="absolute inset-0 bg-neutral-800" />
                                                                <img
                                                                    src={`https://${process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME}/${v.bunny_video_id}/preview.webp`}
                                                                    alt={v.title}
                                                                    className={`w-full h-full object-cover transition-opacity duration-300 ${isDone ? 'opacity-50' : 'opacity-100'}`}
                                                                    onError={(e) => {
                                                                        const target = e.currentTarget;
                                                                        if (target.src.includes('preview.webp')) {
                                                                            target.src = target.src.replace('preview.webp', 'thumbnail.jpg');
                                                                        } else {
                                                                            target.style.display = 'none';
                                                                            target.parentElement?.classList.add('fallback-icon-container');
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    {isDone ? (
                                                                        <CheckCircle2 className="h-6 w-6 text-emerald-500 bg-black/50 rounded-full p-1" />
                                                                    ) : isActive ? (
                                                                        <div className="bg-[var(--brand)]/80 rounded-full p-1.5 animate-pulse">
                                                                            <PlayCircle className="h-4 w-4 text-white fill-white" />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-white/50 bg-black/40 px-1.5 rounded backdrop-blur-sm">
                                                                            {String(globalIndex + 1).padStart(2, '0')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 min-w-0 py-1">
                                                            <h4 className={`font-bold text-sm leading-tight transition-colors line-clamp-2 ${isActive ? 'text-[var(--brand)]' : 'text-[var(--foreground)]'
                                                                }`}>
                                                                {v.title}
                                                            </h4>

                                                            {progress && !isDone && percent > 0 && (
                                                                <div className="mt-2 h-1 w-full bg-black/5 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-[var(--brand)] opacity-60 transition-all duration-500"
                                                                        style={{ width: `${percent}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </div>
        </main>
    )
}
