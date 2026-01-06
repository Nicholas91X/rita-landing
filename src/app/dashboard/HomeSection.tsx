'use client'

import { Level } from '@/app/actions/content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayCircle, Award, Clock, Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomeSection({ levels, onShowLibrary }: { levels: Level[], onShowLibrary: () => void }) {
    // Get purchased packages count
    const purchasedCount = levels.reduce((acc, level) => {
        return acc + level.courses.reduce((cAcc, course) => {
            return cAcc + course.packages.filter(pkg => pkg.isPurchased).length
        }, 0)
    }, 0)

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-brand to-brand-2 border-none shadow-[0_20px_40px_rgba(244,101,48,0.3)] p-8 flex flex-col justify-between min-h-[180px] rounded-[32px] group hover:scale-[1.02] transition-transform">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm">
                        <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="text-5xl font-black text-white tracking-tighter">--</div>
                        <div className="text-white/80 text-xs font-black uppercase tracking-[0.2em] mt-1">Livello Attuale</div>
                    </div>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl p-8 flex flex-col justify-between min-h-[180px] rounded-[32px] hover:border-brand/40 transition-colors group">
                    <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
                        <Clock className="w-6 h-6 text-brand" />
                    </div>
                    <div>
                        <div className="text-5xl font-black text-white tracking-tighter">--</div>
                        <div className="text-neutral-500 text-xs font-black uppercase tracking-[0.2em] mt-1">Minuti Quest'Anno</div>
                    </div>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl p-8 flex flex-col justify-between min-h-[180px] rounded-[32px] hover:border-accent/40 transition-colors group">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                        <Star className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <div className="text-5xl font-black text-white tracking-tighter">0</div>
                        <div className="text-neutral-500 text-xs font-black uppercase tracking-[0.2em] mt-1">Obiettivi Raggiunti</div>
                    </div>
                </Card>
            </div>

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
                {levels.slice(0, 2).map((level) => (
                    <div key={level.id} className="p-6 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group" onClick={onShowLibrary}>
                        <div className="flex justify-between items-center">
                            <div>
                                <h5 className="text-white font-bold">{level.name}</h5>
                                <p className="text-neutral-500 text-xs mt-1 uppercase tracking-widest font-bold">{level.courses.length} Corsi disponibili</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand/20 transition-colors">
                                <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-brand" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
