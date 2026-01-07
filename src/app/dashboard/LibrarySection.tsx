'use client'

import { Level } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { PlayCircle, Dumbbell, Clock, CheckCircle2 } from 'lucide-react'
import { LibraryProgress } from '@/app/actions/video'

// Mappa delle immagini per livello (copiata da DashboardClient per ora, ma centralizzabile)
const LEVEL_IMAGES: Record<string, string> = {
    'Pilates': '/images/dashboard/pilates-header.png',
    'Total Body': '/images/dashboard/total-body-header.png',
    'Intermedio': '/images/dashboard/intermediate-header.png'
}

export default function LibrarySection({
    levels,
    progress = [],
    onShowDiscover
}: {
    levels: Level[],
    progress?: LibraryProgress[],
    onShowDiscover: () => void,
    userName?: string
}) {
    // Filter only purchased packages
    const purchasedLevels = levels.map(level => {
        const coursesWithPurchased = level.courses.map(course => {
            const purchasedPackages = course.packages.filter(pkg => pkg.isPurchased)
            return { ...course, packages: purchasedPackages }
        }).filter(course => course.packages.length > 0)
        return { ...level, courses: coursesWithPurchased }
    }).filter(level => level.courses.length > 0)

    if (purchasedLevels.length === 0) {
        return (
            <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-3xl bg-neutral-900/50 animate-in fade-in duration-700">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="mx-auto w-16 h-16 bg-[var(--brand)]/10 text-[var(--brand)] rounded-full flex items-center justify-center">
                        <Dumbbell className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Non hai ancora corsi attivi</h3>
                    <p className="text-neutral-400 leading-relaxed">
                        Inizia il tuo percorso scegliendo uno dei nostri pacchetti curati per te nel catalogo.
                    </p>
                    <Button
                        onClick={onShowDiscover}
                        className="bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white rounded-2xl px-10 py-6 text-lg font-bold shadow-2xl shadow-[var(--brand)]/20 transition-all hover:scale-105"
                    >
                        Sfoglia il Catalogo
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {purchasedLevels.map((level) => {
                const imageKey = Object.keys(LEVEL_IMAGES).find(k =>
                    level.name.toLowerCase().includes(k.toLowerCase()) ||
                    level.courses.some(c => c.name.toLowerCase().includes(k.toLowerCase()))
                )
                const bgImage = imageKey ? LEVEL_IMAGES[imageKey] : null

                return (
                    <div key={level.id}>
                        {/* Level Header Card */}
                        <div className="relative h-64 md:h-80 rounded-[32px] overflow-hidden mb-12 shadow-2xl group border border-white/5">
                            {bgImage ? (
                                <Image
                                    src={bgImage}
                                    alt={level.name}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    sizes="(max-width: 768px) 100vw, 1200px"
                                    quality={90}
                                />
                            ) : (
                                <div className="absolute inset-0 bg-neutral-800" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 p-8 md:p-12">
                                <span className="text-[var(--brand)] text-xs font-black uppercase tracking-[0.3em] mb-2 block">Livello di Allenamento</span>
                                <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter italic">
                                    {level.name}
                                </h2>
                            </div>
                        </div>

                        <div className="space-y-16">
                            {level.courses.map((course) => (
                                <div key={course.id} className="space-y-8">
                                    <div className="flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-[var(--brand)] rounded-full" />
                                        <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                                            {course.name}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {course.packages.map((pkg) => {
                                            const pkgProgress = progress.find(p => p.packageId === pkg.id)
                                            const isStarted = pkgProgress && pkgProgress.completionPercentage > 0
                                            const isDone = pkgProgress?.isFullyCompleted

                                            return (
                                                <Card key={pkg.id} className="bg-white/10 border-white/10 backdrop-blur-md shadow-2xl overflow-hidden group hover:border-[var(--brand)]/40 transition-all duration-300 rounded-[32px] flex flex-col">
                                                    <div className="h-40 w-full relative overflow-hidden">
                                                        {pkg.image_url ? (
                                                            <img
                                                                src={pkg.image_url}
                                                                alt={pkg.name}
                                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-neutral-800 flex items-center justify-center opacity-80">
                                                                <PlayCircle className="w-10 h-10 text-white/10" />
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent" />
                                                        <div className={`absolute top-0 left-0 w-full h-1.5 shadow-lg ${isDone ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-[var(--brand)] shadow-[var(--brand)]/30'}`} />
                                                    </div>

                                                    <CardHeader className="pb-4 pt-6 px-8 flex-1">
                                                        <CardTitle className="text-xl font-black text-white line-clamp-2 min-h-[3.5rem] italic uppercase tracking-tighter group-hover:text-[var(--brand)] transition-colors">
                                                            {pkg.name}
                                                        </CardTitle>

                                                        {pkgProgress && (
                                                            <div className="mt-4 space-y-3">
                                                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                                                    <span className={isDone ? 'text-emerald-500' : 'text-[var(--brand)]'}>
                                                                        {isDone ? 'Completato' : isStarted ? 'In corso' : 'Non iniziato'}
                                                                    </span>
                                                                    <span className="text-white/40">{Math.round(pkgProgress.completionPercentage)}%</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-1000 ${isDone ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-[var(--brand)] shadow-[0_0_10px_rgba(244,101,48,0.5)]'}`}
                                                                        style={{ width: `${pkgProgress.completionPercentage}%` }}
                                                                    />
                                                                </div>

                                                                {pkgProgress.resumeVideoTitle && !isDone && (
                                                                    <div className="flex items-center gap-2 text-[11px] text-white/60 font-medium bg-white/5 p-2 rounded-xl border border-white/5">
                                                                        <Clock className="h-3 w-3 text-[var(--brand)]" />
                                                                        <span className="truncate">
                                                                            {isStarted ? 'Riprendi: ' : 'Inizia: '} {pkgProgress.resumeVideoTitle}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {isDone && (
                                                                    <div className="flex items-center gap-2 text-[11px] text-emerald-500/80 font-medium bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                                                                        <CheckCircle2 className="h-3 w-3" />
                                                                        <span>Allenamento completato!</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </CardHeader>

                                                    <CardFooter className="pt-2 pb-8 px-6">
                                                        <Button asChild className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 shadow-2xl ${isDone
                                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                                                            : 'bg-[var(--brand)] hover:bg-white hover:text-[var(--brand)] text-white shadow-[var(--brand)]/30'
                                                            } hover:scale-[1.02] active:scale-[0.98]`}>
                                                            <Link href={`/dashboard/package/${pkg.id}`} className="flex items-center gap-3 justify-center">
                                                                {isDone ? (
                                                                    <>
                                                                        <PlayCircle className="h-5 w-5 fill-current/20" />
                                                                        Rivedi Corso
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <PlayCircle className="h-5 w-5 fill-current/20" />
                                                                        {isStarted ? 'Continua Training' : 'Inizia Allenamento'}
                                                                    </>
                                                                )}
                                                            </Link>
                                                        </Button>
                                                    </CardFooter>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
