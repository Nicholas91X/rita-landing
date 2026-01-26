'use client'

import { Level } from '@/app/actions/content'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomeSection({ levels, onShowLibrary, userName }: { levels: Level[], onShowLibrary: () => void, userName?: string }) {
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
                <div className="relative overflow-hidden rounded-[32px] bg-[#ffffff] border-2 border-[#846047] shadow-2xl flex flex-col md:flex-row">
                    {/* Main Ticket Section */}
                    <div className="flex-1 p-8 md:p-12 relative border-b-2 md:border-b-0 md:border-r-2 border-dashed border-[#846047]">
                        {/* Cutouts for ticket effect */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047]" />
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047] md:block hidden" />

                        <div className="space-y-6">
                            <div className="flex justify-between items-start">
                                <span className="text-[#846047] text-xs font-black uppercase tracking-[0.3em]">
                                    {userName ? `BOARDING PASS: ${userName}` : 'BOARDING PASS'}
                                </span>
                                <div className="text-[#846047] font-mono text-xs opacity-60">
                                    FLIGHT RW-2026
                                </div>
                            </div>

                            <div>
                                <h3 className="text-3xl md:text-4xl font-black text-[#2a2e30] leading-tight italic uppercase tracking-tighter mb-2">
                                    Pronta per la tua prossima tappa?
                                </h3>
                                <p className="text-[var(--secondary)]/70 text-lg font-medium">
                                    <span className="font-bold">🌸 Mese 1:</span><br />
                                    Destinazione Bali (Equilibrio)
                                </p>
                            </div>

                            <div className="flex gap-8 text-xs font-mono text-[#846047]/80">
                                <div>
                                    <span className="block opacity-50 text-[10px]">GATE</span>
                                    <span className="font-bold text-lg">01</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 text-[10px]">SEAT</span>
                                    <span className="font-bold text-lg">1A</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 text-[10px]">CLASS</span>
                                    <span className="font-bold text-lg">VIP</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stub / Action Section */}
                    <div className="w-full md:w-64 bg-[#ffffff] p-8 md:p-12 flex flex-col justify-center items-center gap-4 relative">
                        {/* Cutout for right side of stub */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047] md:block hidden" />
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047]" />

                        {/* Barcode decoration */}
                        <div className="w-full h-8 flex justify-between items-end opacity-20 mb-2">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="bg-[#2a2e30]" style={{
                                    width: Math.random() > 0.5 ? '2px' : '4px',
                                    height: Math.random() > 0.5 ? '100%' : '70%'
                                }} />
                            ))}
                        </div>

                        <Button asChild size="lg" className="w-full bg-[#e1d5c6] hover:bg-[#e1d5c6]/80 text-[#593e25] font-black py-6 rounded-xl shadow-lg shadow-black/5 group transition-all">
                            <Link href={`/dashboard/package/${recentPackage.id}`} className="flex items-center justify-center gap-2">
                                PARTI ORA <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[32px] p-8 md:p-12 space-y-8 text-[var(--secondary)] shadow-sm border border-[var(--secondary)]/5">
                <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-[var(--secondary)] tracking-tight">Le tue precedenti destinazioni</h4>
                    <button onClick={onShowLibrary} className="text-brand font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                        VEDI TUTTE <ArrowRight className="w-4 h-4" />
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
                            <div key={level.id} className="p-6 bg-white border border-[#7f554f] rounded-2xl hover:shadow-lg transition-all cursor-pointer group" onClick={onShowLibrary}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h5 className="text-[var(--secondary)] font-bold">{level.name === 'Principiante' ? '🌸 Bali' : level.name}</h5>
                                        <p className="text-[var(--secondary)]/60 text-xs mt-1 uppercase tracking-widest font-bold">
                                            {purchasedCount} {purchasedCount === 1 ? 'Corso disponibile' : 'Corsi disponibili'}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-[#f3efec] flex items-center justify-center group-hover:bg-[#f3efec]/80 transition-colors">
                                        <ArrowRight className="w-5 h-5 text-[#7f554f] group-hover:scale-105 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
