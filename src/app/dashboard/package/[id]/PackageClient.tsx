'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, PlayCircle, CheckCircle2, Clock, Loader2, Footprints, Plane, Stamp, Luggage } from 'lucide-react'
import VideoPlayer from '@/components/video/VideoPlayer'
import { getAllPackageProgress } from '@/app/actions/video'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'

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
    const [activeWeek, setActiveWeek] = useState(1)
    const [progressData, setProgressData] = useState<Record<string, WatchProgress>>({})
    const [loadingProgress, setLoadingProgress] = useState(true)
    const [showCelebration, setShowCelebration] = useState(false)
    const [celebrated, setCelebrated] = useState(false)
    const router = useRouter()

    const fetchProgress = useCallback(async () => {
        try {
            const data = await getAllPackageProgress(pkg.id)
            const map: Record<string, WatchProgress> = {}
            data.forEach((item: WatchProgress) => {
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

    // Celebration logic
    useEffect(() => {
        if (preciseCompletionRate >= 100 && !celebrated && !loadingProgress) {
            setShowCelebration(true)
            setCelebrated(true)
            // Trigger confetti
            const duration = 5 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval = setInterval(function () {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                // since particles fall down, start a bit higher than random
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);
        }
    }, [preciseCompletionRate, celebrated, loadingProgress])

    return (
        <>
            <main className="h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--foreground)] selection:bg-[var(--brand)]/10 overflow-x-hidden w-full max-w-full">
                {/* Header / Navigation - Part of the flex flow */}
                <header className="flex-none relative z-[100] bg-[#f3efec] border-b border-[#846047]/10 shadow-sm pt-[safe-area-inset-top]">
                    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 md:py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard?tab=library"
                                className="relative z-[110] flex items-center gap-2 px-4 py-2 rounded-full bg-[#846047]/10 border border-[#846047]/20 text-[#846047] hover:text-[#593e25] transition-all hover:bg-[#846047]/20 text-sm font-medium touch-manipulation"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                <span className="hidden md:inline">Esci dalla lezione</span>
                                <span className="md:hidden">Esci</span>
                            </Link>

                            <div className="flex flex-col">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand)] mb-0.5 leading-none">Corso in corso</h2>
                                <h1 className="text-sm md:text-base font-bold text-[#2a2e30] truncate max-w-[150px] sm:max-w-[200px] lg:max-w-md">
                                    {pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante') ? 'Destinazione Bali' : pkg.name}
                                </h1>
                            </div>
                        </div>


                    </div>
                </header>

                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden min-h-0">
                    {/* Main Content Area - Video Player */}
                    <div className="flex-none lg:flex-1 bg-[#fff8f3] flex flex-col pt-6 lg:pt-10 pb-8 lg:pb-12 lg:overflow-y-auto custom-scrollbar">
                        <div className="flex-none flex flex-col">
                            <div className="w-full max-w-6xl mx-auto px-4 lg:px-10 flex flex-col">
                                {/* Immersive Video Container */}
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight mb-10">
                                    <span className="text-[#846047]">MESE 1: </span>
                                    <span className="text-[#2a2e30]">BALI</span> <span className="font-black text-gray-500">(equilibrio & drenaggio)</span> 🌿
                                </h2>
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
                                            <span className="px-4 py-1.5 rounded-lg bg-[#7f554f] text-white text-[11px] font-black uppercase tracking-[0.1em] shadow-lg shadow-[#7f554f]/20">
                                                In riproduzione
                                            </span>
                                            {progressData[activeVideo.id]?.is_completed && (
                                                <span className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-[0.1em] flex items-center gap-1.5 shadow-lg shadow-emerald-600/20">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Completata
                                                </span>
                                            )}
                                        </div>
                                        <h1 className="text-3xl lg:text-5xl font-black text-[var(--foreground)] tracking-tight ts-white flex items-center gap-3 flex-wrap">
                                            <Footprints className="w-8 h-8 lg:w-12 lg:h-12 shrink-0" />
                                            <span className="break-words">
                                                Tappa {activeVideo.order_index ?? (videos.indexOf(activeVideo) + 1)}
                                            </span>
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
                                            {pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante') ? '🌸 Mese 1: Destinazione Bali (Equilibrio)' : pkg.description}
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
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--foreground)]/50">
                                    IL TUO ITINERARIO
                                </h2>
                                {/* Progress Bar Comp */}
                                <div className="bg-white/40 border border-[var(--brand)]/10 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm">
                                    <div className="h-1.5 w-20 xl:w-24 bg-[var(--brand)]/10 relative rounded-full overflow-hidden">
                                        <div className="absolute top-0 left-0 h-full bg-[var(--brand)] transition-all duration-1000 ease-out" style={{ width: `${preciseCompletionRate}%` }} />
                                    </div>
                                    <span className="text-[10px] font-black text-[var(--brand)]">{Math.round(preciseCompletionRate)}%</span>
                                </div>
                            </div>

                            {/* Month Selectors (Visual Only for now as per image style) */}
                            <div className="flex gap-2 mb-6">
                                <button className="flex-1 py-2.5 rounded-xl bg-[#846047] text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#846047]/20">
                                    Mese 1
                                </button>
                                <button className="flex-1 py-2.5 rounded-xl bg-[#846047]/10 text-[#846047]/40 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed">
                                    <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[8px]">🔒</span>
                                    Mese 2
                                </button>
                            </div>

                            {/* Week Tabs */}
                            <div className="flex border-b border-[var(--brand)]/10 relative">
                                {[1, 2, 3, 4].map((w) => (
                                    <button
                                        key={w}
                                        onClick={() => setActiveWeek(w)}
                                        className={`flex-1 pb-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeWeek === w
                                            ? 'text-[#846047]'
                                            : 'text-[#846047]/40 hover:text-[#846047]/70'
                                            }`}
                                    >
                                        Sett. {w}
                                        {activeWeek === w && (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#846047] rounded-t-full" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lesson Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 custom-scrollbar">
                            {/* Week Subtitle */}
                            <div className="text-center py-2">
                                {activeWeek === 1 && <p className="text-sm font-bold text-[#846047] italic">L&apos;Atterraggio 🛬</p>}
                                {activeWeek === 2 && <p className="text-sm font-bold text-[#846047] italic">L&apos;Esplorazione 🧭</p>}
                                {activeWeek === 3 && <p className="text-sm font-bold text-[#846047] italic">La Scoperta 🗺️</p>}
                                {activeWeek === 4 && <p className="text-sm font-bold text-[#846047] italic">Il Traguardo 🏆</p>}
                            </div>

                            <div className="space-y-3">
                                {videos.filter(v => {
                                    const index = v.order_index ?? (videos.indexOf(v) + 1);
                                    if (activeWeek === 1) return index >= 1 && index <= 3;
                                    if (activeWeek === 2) return index >= 4 && index <= 6;
                                    if (activeWeek === 3) return index >= 7 && index <= 9;
                                    if (activeWeek === 4) return index >= 10 && index <= 12;
                                    return false;
                                }).map((v, i, mappedArr) => {
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
                                            className={`relative p-4 transition-all duration-300 cursor-pointer group flex items-center gap-4 border-b border-[var(--brand)]/10 last:border-0 ${isActive
                                                ? 'bg-white/80'
                                                : 'hover:bg-white/40'
                                                }`}
                                        >
                                            {/* Status Indicator (Left) */}
                                            <div className="shrink-0">
                                                {isDone ? (
                                                    <div className="w-8 h-8 rounded-full bg-[#e8e2d9] flex items-center justify-center">
                                                        <CheckCircle2 className="w-5 h-5 text-[#846047]" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-[#846047] bg-[#846047]/10' : 'border-[#e8e2d9]'}`}>
                                                        {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[#846047]" />}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Thumbnail (Middle) */}
                                            <div className="relative shrink-0">
                                                <div className="relative h-16 w-24 rounded-lg overflow-hidden border border-black/5">
                                                    <div className="absolute inset-0 bg-neutral-100" />
                                                    <Image
                                                        src={`https://${process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME}/${v.bunny_video_id}/preview.webp`}
                                                        alt={v.title}
                                                        className={`w-full h-full object-cover transition-opacity duration-300 ${isDone ? 'opacity-80' : 'opacity-100'}`}
                                                        loading="lazy"
                                                        fill
                                                        sizes="96px"
                                                    />
                                                </div>
                                            </div>

                                            {/* Text Content (Right) */}
                                            <div className="flex-1 min-w-0 py-1">
                                                <span className="text-[12px] font-medium text-[#c49285] mb-0.5 block">
                                                    Tappa {globalIndex + 1}
                                                </span>
                                                <h4 className={`font-bold text-[15px] leading-tight line-clamp-2 mb-1 ${isActive ? 'text-[#2a2e30]' : 'text-[#2a2e30]'}`}>
                                                    {globalIndex === 0 ? "Tirta Empul 🛕" :
                                                        globalIndex === 1 ? "Le Risaie di Tegalalang 🌾" : v.title}
                                                </h4>
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-[12px] font-medium text-gray-500">31 minuti</span>
                                                </div>
                                            </div>
                                        </div>
                                    )

                                })}

                                {/* BONUS ITEM for Week 2 & 4 */}
                                {(activeWeek === 2 || activeWeek === 4) && (
                                    <div className="relative p-4 flex items-center gap-4 border-b border-[var(--brand)]/10 cursor-default opacity-80 hover:opacity-100 transition-opacity">
                                        {/* Status Indicator (Left) - Decorative for Bonus */}
                                        <div className="shrink-0">
                                            <div className="w-8 h-8 rounded-full border-2 border-amber-200 bg-amber-50 flex items-center justify-center">
                                                <span className="text-[10px]">✨</span>
                                            </div>
                                        </div>

                                        {/* Thumbnail (Middle) */}
                                        <div className="relative shrink-0">
                                            <div className="h-16 w-24 rounded-lg bg-amber-100/50 flex items-center justify-center shrink-0 border border-amber-200/50">
                                                <span className="text-2xl">🍹</span>
                                            </div>
                                        </div>

                                        {/* Text Content (Right) */}
                                        <div className="flex-1 min-w-0 py-1">
                                            <span className="text-[12px] font-medium text-amber-600 mb-0.5 block">
                                                Bonus
                                            </span>
                                            <h4 className="font-bold text-[15px] text-[#2a2e30] leading-tight mb-1">
                                                Ritmo Caraibico
                                            </h4>
                                            <p className="text-[12px] text-gray-500 leading-tight">
                                                Lezione extra per sciogliere il bacino
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
                <DialogContent className="bg-[#fdfbf7] border-none rounded-[40px] max-w-lg p-0 overflow-hidden shadow-2xl">
                    <div className="relative p-10 flex flex-col items-center text-center">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#846047 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                        <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 animate-bounce">
                            <Luggage className="w-12 h-12 text-emerald-600" />
                        </div>

                        <DialogHeader className="space-y-4">
                            <DialogTitle className="text-4xl font-serif font-bold text-[#593e25] tracking-tight leading-tight">
                                Valigia pronta! 🧳
                            </DialogTitle>
                            <DialogDescription className="text-lg text-neutral-600 font-medium">
                                Hai completato con successo il tuo viaggio a <span className="text-[#846047] font-bold">{pkg.name.toLowerCase().includes('bali') ? 'Bali' : (pkg.name.split(' ')[0] || 'questa destinazione')}</span>. Un nuovo timbro ti aspetta nel tuo passaporto!
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-10 w-full space-y-4">
                            <Button
                                onClick={() => {
                                    setShowCelebration(false)
                                    router.push('/dashboard?tab=profile&sub=badges')
                                }}
                                className="w-full bg-[#846047] text-white hover:bg-[#846047]/90 rounded-2xl h-14 text-lg font-bold shadow-lg shadow-[#846047]/20"
                            >
                                Guarda il Passaporto
                            </Button>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Repubblica delle Ritiane • Documento di Viaggio</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
