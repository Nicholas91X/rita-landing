'use client'

import { Level } from '@/app/actions/content'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
    // 1. Extract Personalized Packages first
    const personalizedPackages: any[] = []

    // 2. Filter standard levels (excluding personalized)
    const purchasedLevels = levels.map(level => {
        const coursesWithPurchased = level.courses.map(course => {
            // Check if this is a "Personalizzato" course
            const isPersonalized = course.name.toLowerCase().includes('personalizzato')

            const purchasedPackages = course.packages.filter(pkg => pkg.isPurchased)

            if (isPersonalized) {
                // Add to personalized list and exclude from main list
                if (purchasedPackages.length > 0) {
                    // Add extra info for display if needed
                    purchasedPackages.forEach(p => personalizedPackages.push(p))
                }
                return { ...course, packages: [] }
            }

            return { ...course, packages: purchasedPackages }
        }).filter(course => course.packages.length > 0)
        return { ...level, courses: coursesWithPurchased }
    }).filter(level => level.courses.length > 0)

    if (purchasedLevels.length === 0 && personalizedPackages.length === 0) {
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
            {/* Personalized Section */}
            {personalizedPackages.length > 0 && (
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-1.5 bg-[var(--brand)] rounded-full" />
                        <h2 className="text-3xl md:text-4xl font-black text-[#593e25] tracking-tight italic uppercase">
                            Il tuo percorso personalizzato
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {personalizedPackages.map((pkg) => (
                            <Card key={pkg.id} className="bg-white border-[#846047]/20 shadow-xl overflow-hidden group hover:shadow-2xl hover:border-[var(--brand)]/40 transition-all duration-300 rounded-[32px] flex flex-col">
                                <div className="h-48 w-full relative overflow-hidden">
                                    {pkg.image_url ? (
                                        <Image
                                            src={pkg.image_url}
                                            alt={pkg.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            fill
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-[#f3efec] flex items-center justify-center">
                                            <span className="text-4xl">✨</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-4 left-6">
                                        <h3 className="text-white text-xl font-black italic uppercase tracking-tight leading-none">{pkg.name}</h3>
                                    </div>
                                </div>
                                <CardFooter className="p-6 mt-auto">
                                    <Button asChild className="w-full h-12 bg-[#593e25] hover:bg-[#4a331f] text-white rounded-xl font-bold uppercase tracking-widest shadow-lg">
                                        <Link href={`/dashboard/package/${pkg.id}`} className="flex items-center gap-2 justify-center">
                                            Vai al Percorso
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {purchasedLevels.length > 0 && (
                <div className="space-y-12">
                    {personalizedPackages.length > 0 && <div className="w-full h-px bg-[#846047]/10" />}

                    <h2 className="text-3xl md:text-4xl font-black text-[#593e25] tracking-tight italic uppercase">
                        Pacchetti Acquistati
                    </h2>

                    {purchasedLevels.map((level) => (
                        <div key={level.id}>
                            <div className="space-y-16">
                                {level.courses.map((course) => (
                                    <div key={course.id} className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-1.5 bg-[var(--brand)] rounded-full" />
                                            <h3 className="text-2xl md:text-3xl font-bold text-[#593e25] tracking-tight">
                                                {course.name.toLowerCase().includes('pilates') && course.name.toLowerCase().includes('principiante') ? 'Destinazione Bali (Equilibrio)' : course.name}
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {course.packages.map((pkg) => {
                                                const pkgProgress = progress.find(p => p.packageId === pkg.id)
                                                const isStarted = pkgProgress && pkgProgress.completionPercentage > 0
                                                const isDone = pkgProgress?.isFullyCompleted

                                                return (
                                                    <Card key={pkg.id} className="bg-white border-[#846047]/20 shadow-xl overflow-hidden group hover:border-[var(--brand)]/40 transition-all duration-300 rounded-[32px] flex flex-col">
                                                        <div className="h-40 w-full relative overflow-hidden">
                                                            {pkg.image_url ? (
                                                                <Image
                                                                    src={pkg.image_url}
                                                                    alt={pkg.name}
                                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                                    fill
                                                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full bg-neutral-100 flex items-center justify-center opacity-80">
                                                                    <PlayCircle className="w-10 h-10 text-neutral-300" />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                                            <div className={`absolute top-0 left-0 w-full h-1.5 shadow-lg ${isDone ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-[var(--brand)] shadow-[var(--brand)]/30'}`} />
                                                        </div>

                                                        <CardHeader className="pb-4 pt-6 px-8 flex-1">
                                                            <CardTitle className="text-xl font-black text-[#2a2e30] line-clamp-2 min-h-[3.5rem] italic uppercase tracking-tighter group-hover:text-[var(--brand)] transition-colors">
                                                                {pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante') ? 'Destinazione Bali (equilibrio)' : pkg.name}
                                                            </CardTitle>

                                                            {pkgProgress && (
                                                                <div className="mt-4 space-y-3">
                                                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                                                        <span className={isDone ? 'text-emerald-500' : 'text-[var(--brand)]'}>
                                                                            {isDone ? 'Completato' : isStarted ? 'In corso' : 'Non iniziato'}
                                                                        </span>
                                                                        <span className="text-neutral-400">{Math.round(pkgProgress.completionPercentage)}%</span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full transition-all duration-1000 ${isDone ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-[var(--brand)] shadow-[0_0_10px_rgba(244,101,48,0.5)]'}`}
                                                                            style={{ width: `${pkgProgress.completionPercentage}%` }}
                                                                        />
                                                                    </div>

                                                                    {pkgProgress.resumeVideoTitle && !isDone && (
                                                                        <div className="flex items-center gap-2 text-[11px] text-neutral-600 font-medium bg-neutral-50 p-2 rounded-xl border border-neutral-100">
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
                    ))}
                </div>
            )}
        </div>
    )
}
