'use client'

import { Level } from '@/app/actions/content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomeSection({ levels, onShowLibrary }: { levels: Level[], onShowLibrary: () => void }) {
    // Find the first purchased package as "Recent" (simplified logic)
    let recentPackage = null
    for (const level of levels) {
        for (const course of level.courses) {
            for (const pkg of course.packages) {
                if (pkg.isPurchased) {
                    recentPackage = pkg
                    break
                }
            }
            if (recentPackage) break
        }
        if (recentPackage) break
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {recentPackage && (
                <div className="relative overflow-hidden p-8 md:p-12 rounded-[32px] bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand/20 blur-[100px] -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="max-w-xl space-y-4">
                            <span className="text-brand text-xs font-black uppercase tracking-[0.3em]">Bentornata nella tua Area</span>
                            <h3 className="text-3xl md:text-4xl font-black text-white leading-tight italic uppercase tracking-tighter">
                                Pronta per la tua prossima sfida?
                            </h3>
                            <p className="text-neutral-400 text-lg">
                                Esplora i contenuti di <span className="text-white font-bold">{recentPackage.name}</span>.
                            </p>
                        </div>
                        <Button asChild size="lg" className="bg-white hover:bg-neutral-200 text-black font-black px-8 py-8 rounded-[24px] shadow-2xl shadow-white/10 group transition-all">
                            <Link href={`/dashboard/package/${recentPackage.id}`} className="flex items-center gap-3">
                                VAI AL CORSO <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h4 className="text-xl font-bold text-white tracking-tight">I tuoi Corsi Recenti</h4>
                <button onClick={onShowLibrary} className="text-brand font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                    VEDI TUTTI <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {levels.map((level) => {
                    const purchasedCount = level.courses.reduce((acc, course) => {
                        return acc + course.packages.filter(p => p.isPurchased).length
                    }, 0)

                    // Only show levels that have purchased content or if we want to show all but with 0 count? 
                    // The user said "shows 0 available" which implies they saw the 0. 
                    // But usually for "Recent" we want to filter empty ones? 
                    // Let's assume we show levels that exist, but with correct count. 
                    // BUT, if levels.slice(0, 2) was hiding others, we should probably map all relevant ones.
                    // Let's filter levels to only those with content for a cleaner "Home" experience?
                    // User complained "Intermedio 0" while having 3 courses total. If they have 1 in Intermedio, it should show 1.

                    if (purchasedCount === 0) return null

                    return (
                        <div key={level.id} className="p-6 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group" onClick={onShowLibrary}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <h5 className="text-white font-bold">{level.name}</h5>
                                    <p className="text-neutral-500 text-xs mt-1 uppercase tracking-widest font-bold">
                                        {purchasedCount} {purchasedCount === 1 ? 'Corso disponibile' : 'Corsi disponibili'}
                                    </p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--brand)]/20 transition-colors">
                                    <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-[var(--brand)]" />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
