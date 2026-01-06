'use client'

import { Level } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { PlayCircle, Dumbbell } from 'lucide-react'

// Mappa delle immagini per livello (copiata da DashboardClient per ora, ma centralizzabile)
const LEVEL_IMAGES: Record<string, string> = {
    'Pilates': '/images/dashboard/pilates-header.png',
    'Total Body': '/images/dashboard/total-body-header.png',
    'Intermedio': '/images/dashboard/intermediate-header.png'
}

export default function LibrarySection({ levels, onShowDiscover }: { levels: Level[], onShowDiscover: () => void }) {
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
                    <div className="mx-auto w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center">
                        <Dumbbell className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Non hai ancora corsi attivi</h3>
                    <p className="text-neutral-400 leading-relaxed">
                        Inizia il tuo percorso scegliendo uno dei nostri pacchetti curati per te nel catalogo.
                    </p>
                    <Button
                        onClick={onShowDiscover}
                        className="bg-brand hover:bg-brand/90 text-white rounded-2xl px-10 py-6 text-lg font-bold shadow-2xl shadow-brand/20 transition-all hover:scale-105"
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
                                <span className="text-brand text-xs font-black uppercase tracking-[0.3em] mb-2 block">Livello di Allenamento</span>
                                <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter italic">
                                    {level.name}
                                </h2>
                            </div>
                        </div>

                        <div className="space-y-16">
                            {level.courses.map((course) => (
                                <div key={course.id} className="space-y-8">
                                    <div className="flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-brand rounded-full" />
                                        <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                                            {course.name}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {course.packages.map((pkg) => (
                                            <Card key={pkg.id} className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl overflow-hidden group hover:border-brand/40 transition-all duration-300 rounded-[32px]">
                                                <div className="h-2 w-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                                                <CardHeader className="pb-4 pt-8 px-8">
                                                    <CardTitle className="text-xl font-black text-white line-clamp-2 min-h-[3.5rem] italic uppercase tracking-tighter group-hover:text-brand transition-colors">
                                                        {pkg.name}
                                                    </CardTitle>
                                                    <CardDescription className="text-neutral-400 text-xs mt-1 line-clamp-2">
                                                        {pkg.description}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardFooter className="pt-2 pb-8 px-6">
                                                    <Button asChild className="w-full h-12 rounded-xl bg-brand font-bold text-white hover:bg-brand/90 shadow-lg shadow-brand/20 group-hover:scale-[1.02] transition-transform">
                                                        <Link href={`/dashboard/package/${pkg.id}`} className="flex items-center gap-2 justify-center">
                                                            <PlayCircle className="h-5 w-5" />
                                                            Inizia Allenamento
                                                        </Link>
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))}
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
