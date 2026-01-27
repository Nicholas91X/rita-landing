'use client'

import { Level } from '@/app/actions/content'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { PlayCircle, Dumbbell, Clock, CheckCircle2, Calendar, Users, ArrowRight } from 'lucide-react'
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
                        <h2 className="text-xl md:text-2xl font-bold text-[#593e25] tracking-tight uppercase">
                            Il tuo percorso personalizzato
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {personalizedPackages.map((pkg) => (
                            <Card key={pkg.id} className="bg-white border-[#846047]/20 shadow-xl overflow-hidden group hover:shadow-2xl hover:border-[var(--brand)]/40 transition-all duration-300 rounded-[32px] flex flex-col">
                                <Link href={`/dashboard/package/${pkg.id}`} className="flex-1 flex flex-col">
                                    <div className="h-56 w-full relative overflow-hidden">
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
                                        <div className="absolute inset-0 bg-black/10" />
                                    </div>
                                    <CardContent className="p-6 space-y-4">
                                        <h3 className="text-[22px] font-bold text-[#2a2e30] leading-tight">
                                            {pkg.name}
                                        </h3>
                                        <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">
                                            {pkg.description || "Il tuo percorso personalizzato per il benessere fisico e mentale."}
                                        </p>

                                        <div className="flex flex-col gap-2 pt-2">
                                            <div className="flex items-center gap-2 text-neutral-400 text-sm">
                                                <Calendar className="w-4 h-4" />
                                                <span>Personalizzato</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-neutral-400 text-sm">
                                                <Dumbbell className="w-4 h-4" />
                                                <span>In base alle tue esigenze</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4">
                                            <div className="flex -space-x-2">
                                                <div className="w-8 h-8 rounded-full border-2 border-white bg-[#e5e7eb]" />
                                                <div className="w-8 h-8 rounded-full border-2 border-white bg-[#d1d5db]" />
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-[#f3efec] text-[10px] font-bold text-neutral-500">
                                                    +2k
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-neutral-400">Su Misura</span>
                                                <div className="w-6 h-6 rounded-full border-2 border-[#846047]/30 flex items-center justify-center">
                                                    <div className="w-3 h-3 bg-[#846047] rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Link>
                                <CardFooter className="p-6 pt-0 mt-auto">
                                    <Button asChild className="w-full h-11 bg-[#593e25] hover:bg-[#4a331f] text-white rounded-xl font-bold uppercase tracking-widest shadow-lg">
                                        <Link href={`/dashboard/package/${pkg.id}`} className="flex items-center gap-2 justify-center">
                                            VAI AL PERCORSO <ArrowRight className="w-4 h-4" />
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

                    <h2 className="text-xl md:text-2xl font-bold text-[#593e25] tracking-tight uppercase">
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
                                                    <Card key={pkg.id} className="bg-white border-[#846047]/10 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500 rounded-[32px] flex flex-col border-none">
                                                        <Link href={`/dashboard/package/${pkg.id}`} className="flex-1 flex flex-col">
                                                            <div className="h-56 w-full relative overflow-hidden">
                                                                {pkg.image_url ? (
                                                                    <Image
                                                                        src={pkg.image_url}
                                                                        alt={pkg.name}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                                        fill
                                                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center opacity-80">
                                                                        <PlayCircle className="w-12 h-12 text-neutral-300" />
                                                                    </div>
                                                                )}
                                                                <div className="absolute inset-0 bg-black/5" />
                                                                {isDone && (
                                                                    <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <CardContent className="p-8 space-y-4">
                                                                <h3 className="text-[22px] font-bold text-[#2a2e30] leading-tight">
                                                                    {pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante') ? 'Pilates Linfodrenante Principianti' : pkg.name}
                                                                </h3>
                                                                <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">
                                                                    {pkg.description || "Il Percorso di introduzione al Pilates Linfodrenante per ritrovare equilibrio e vitalità."}
                                                                </p>

                                                                <div className="flex flex-col gap-2.5 pt-2">
                                                                    <div className="flex items-center gap-2.5 text-neutral-400 text-sm">
                                                                        <Calendar className="w-4 h-4 opacity-70" />
                                                                        <span>2 Mesi</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2.5 text-neutral-400 text-sm">
                                                                        <Users className="w-4 h-4 opacity-70" />
                                                                        <span>Nessun attrezzo</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between pt-6">
                                                                    <div className="flex -space-x-2.5">
                                                                        <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-200" />
                                                                        <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-300" />
                                                                        <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-400" />
                                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-[#f3efec] text-[9px] font-black text-neutral-500">
                                                                            +9.683
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Facile</span>
                                                                        <div className="relative w-8 h-8">
                                                                            {/* Circular Progress */}
                                                                            <svg className="w-8 h-8 transform -rotate-90">
                                                                                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-neutral-100" />
                                                                                <circle
                                                                                    cx="16" cy="16" r="14"
                                                                                    stroke="currentColor" strokeWidth="3" fill="transparent"
                                                                                    strokeDasharray={2 * Math.PI * 14}
                                                                                    strokeDashoffset={2 * Math.PI * 14 * (1 - (pkgProgress?.completionPercentage || 0) / 100)}
                                                                                    className="text-[#846047] transition-all duration-1000"
                                                                                />
                                                                            </svg>
                                                                            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[#846047]">
                                                                                {Math.round(pkgProgress?.completionPercentage || 0)}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Link>

                                                        <CardFooter className="p-8 pt-0 mt-auto">
                                                            <Button asChild className={`w-full h-11 rounded-xl font-bold uppercase tracking-widest transition-all duration-300 shadow-lg ${isDone
                                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/10'
                                                                : 'bg-[#593e25] hover:bg-[#4a331f] text-white shadow-[#593e25]/20'
                                                                } hover:scale-[1.02] active:scale-[0.98]`}>
                                                                <Link href={`/dashboard/package/${pkg.id}`} className="flex items-center gap-3 justify-center">
                                                                    {isDone ? (
                                                                        <>
                                                                            <PlayCircle className="h-5 w-5 fill-current/10" />
                                                                            Rivedi Corso
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <PlayCircle className="h-5 w-5 fill-current/10" />
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
