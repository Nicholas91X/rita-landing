'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, PlayCircle } from 'lucide-react'
import VideoPlayer from '@/components/video/VideoPlayer'
import Section from '@/components/Section'

type Video = {
    id: string
    title: string
    bunny_video_id: string
}

type Package = {
    name: string
    description: string
}

export default function PackageClient({ pkg, videos }: { pkg: Package, videos: Video[] }) {
    // Default to the first video
    const [activeVideo, setActiveVideo] = useState<Video>(videos[0])

    // Refs for auto-scrolling
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // Scroll active video into view when it changes
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
                    {/* Player Area */}
                    <div className="lg:col-span-2">
                        {/* Key changes to force re-render if needed, but usually props update is enough */}
                        <VideoPlayer videoId={activeVideo.id} />

                        <div className="mt-4 md:mt-6">
                            <h2 className="text-lg md:text-xl font-bold mb-2">{activeVideo.title}</h2>
                        </div>
                    </div>

                    {/* Playlist Area */}
                    <div className="space-y-3 md:space-y-4">
                        <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground px-2">
                            Lezioni nel pacchetto
                        </h3>
                        {/* Wrapper with max-height on mobile to enforce scroll */}
                        <div className="flex flex-col gap-2 max-h-[300px] md:max-h-[600px] overflow-y-auto pr-1 md:pr-2">
                            {videos.map((v) => {
                                const isActive = v.id === activeVideo.id
                                return (
                                    <div
                                        key={v.id}
                                        ref={(el) => {
                                            if (el) itemRefs.current.set(v.id, el)
                                            else itemRefs.current.delete(v.id)
                                        }}
                                        onClick={() => setActiveVideo(v)}
                                        className={`p-3 md:p-4 rounded-xl border transition-all cursor-pointer group flex items-center justify-between text-sm md:text-base flex-shrink-0 ${isActive
                                                ? 'border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]'
                                                : 'border-[var(--border)] hover:bg-[var(--panel)]'
                                            }`}
                                    >
                                        <p className="font-medium line-clamp-1">{v.title}</p>
                                        {isActive && <PlayCircle className="h-4 w-4 flex-shrink-0 ml-2" />}
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
