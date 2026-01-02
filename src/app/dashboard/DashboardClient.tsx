'use client'

import { useState } from 'react'
import { Level } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, PlayCircle, Dumbbell, Compass } from 'lucide-react'
import BuyButton from '@/components/BuyButton'
import Section from '@/components/Section'

// Mappa delle immagini per livello
const LEVEL_IMAGES: Record<string, string> = {
    'Pilates': '/images/dashboard/pilates-header.png',
    'Total Body': '/images/dashboard/total-body-header.png',
    'Intermedio': '/images/dashboard/intermediate-header.png'
}

type Tab = 'my-workouts' | 'discover'

export default function DashboardClient({ levels }: { levels: Level[] }) {
    const [activeTab, setActiveTab] = useState<Tab>('my-workouts')

    // Filter logic
    const filteredLevels = levels.map(level => {
        const filteredCourses = level.courses.map(course => {
            const filteredPackages = course.packages.filter(pkg => {
                if (activeTab === 'my-workouts') return pkg.isPurchased;
                return !pkg.isPurchased;
            });
            return { ...course, packages: filteredPackages };
        }).filter(course => course.packages.length > 0);

        return { ...level, courses: filteredCourses };
    }).filter(level => level.courses.length > 0);

    // Auto-switch to 'discover' if user has no purchases and is on 'my-workouts' initially?
    // Better to let them see the empty state so they know they need to buy.

    return (
        <div className="pb-20">
            {/* Tabs Navigation (Pills) */}
            <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-md py-4 border-b border-[var(--border)]">
                <div className="flex justify-center">
                    <div className="flex items-center p-1 bg-[var(--panel)] border border-[var(--border)] rounded-full shadow-sm">
                        <button
                            onClick={() => setActiveTab('my-workouts')}
                            className={`
                                px-6 py-2 rounded-full font-semibold text-sm md:text-base flex items-center gap-2 transition-all duration-300
                                ${activeTab === 'my-workouts'
                                    ? 'bg-[var(--brand)] text-white shadow-md transform scale-105'
                                    : 'text-[var(--foreground)] hover:bg-[var(--steel)]/10'
                                }
                            `}
                        >
                            <Dumbbell className="h-4 w-4" />
                            I Miei Allenamenti
                        </button>
                        <button
                            onClick={() => setActiveTab('discover')}
                            className={`
                                px-6 py-2 rounded-full font-semibold text-sm md:text-base flex items-center gap-2 transition-all duration-300
                                ${activeTab === 'discover'
                                    ? 'bg-[var(--brand)] text-white shadow-md transform scale-105'
                                    : 'text-[var(--foreground)] hover:bg-[var(--steel)]/10'
                                }
                            `}
                        >
                            <Compass className="h-4 w-4" />
                            Scopri Altri Corsi
                        </button>
                    </div>
                </div>
            </div>

            <Section className="py-12">
                {filteredLevels.length === 0 ? (
                    <div className="text-center py-24 border-2 border-dashed border-[var(--border)] rounded-3xl opacity-70 bg-[var(--panel)]">
                        {activeTab === 'my-workouts' ? (
                            <div className="max-w-md mx-auto space-y-6">
                                <div className="mx-auto w-16 h-16 bg-[var(--brand)]/10 text-[var(--brand)] rounded-full flex items-center justify-center">
                                    <Dumbbell className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-bold">Non hai ancora allenamenti attivi</h3>
                                <p className="text-[var(--muted-foreground)]">
                                    Inizia il tuo percorso scegliendo uno dei nostri pacchetti curati per te.
                                </p>
                                <Button
                                    onClick={() => setActiveTab('discover')}
                                    className="bg-[var(--brand)] text-white hover:opacity-90 rounded-full px-8 py-6 text-lg"
                                >
                                    Sfoglia il Catalogo
                                </Button>
                            </div>
                        ) : (
                            <div className="max-w-md mx-auto space-y-6">
                                <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-bold">Hai già tutto!</h3>
                                <p className="text-[var(--muted-foreground)]">
                                    Complimenti, hai accesso a tutti i nostri contenuti premium.
                                </p>
                                <Button
                                    onClick={() => setActiveTab('my-workouts')}
                                    variant="outline"
                                    className="rounded-full px-8 py-6 text-lg"
                                >
                                    Torna ai miei allenamenti
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    filteredLevels.map((level) => {
                        // Cerca un'immagine: controlla sia il nome del livello che i nomi dei corsi contenuti
                        const imageKey = Object.keys(LEVEL_IMAGES).find(k => {
                            const key = k.toLowerCase()
                            const levelMatch = level.name.toLowerCase().includes(key)
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const courseMatch = level.courses.some((c: any) => c.name.toLowerCase().includes(key))
                            return levelMatch || courseMatch
                        })
                        const bgImage = imageKey ? LEVEL_IMAGES[imageKey] : null

                        return (
                            <div key={level.id} className="mb-24 last:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Header Livello con Immagine */}
                                <div className="relative h-64 md:h-80 rounded-3xl overflow-hidden mb-10 shadow-2xl group">
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
                                        <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand)] to-[var(--steel)]" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40" /> {/* Overlay scuro */}
                                    <div className="absolute bottom-0 left-0 p-8 md:p-12">
                                        <h2 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-widest shadow-black drop-shadow-lg">
                                            {level.name}
                                        </h2>
                                    </div>
                                </div>

                                <div className="space-y-16 px-2">
                                    {level.courses.map((course) => (
                                        <div key={course.id}>
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="h-10 w-2 bg-[var(--brand)] rounded-full" />
                                                <h3 className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">
                                                    {course.name}
                                                </h3>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                {course.packages.map((pkg) => (
                                                    <Card key={pkg.id} className="group relative flex flex-col h-full border-0 bg-[var(--panel)] shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
                                                        {/* Badge per i pacchetti acquistati mostrati nel tab (nel caso serva distinction, ma qui filtriamo) */}
                                                        {activeTab === 'my-workouts' && (
                                                            <div className="absolute top-4 right-4 z-10 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                                                                <PlayCircle className="h-3 w-3" />
                                                                INIZIA
                                                            </div>
                                                        )}

                                                        {/* Stripe Decorativa */}
                                                        <div className={`h-2 w-full ${pkg.isPurchased ? 'bg-green-500' : 'bg-[var(--brand)]'}`} />

                                                        <CardHeader className="pb-4">
                                                            <div className="flex justify-between items-start gap-4">
                                                                <CardTitle className="text-2xl font-bold leading-tight">
                                                                    {pkg.name}
                                                                </CardTitle>
                                                            </div>
                                                            <CardDescription className="text-base font-medium text-[var(--foreground)]/70 mt-2 line-clamp-2">
                                                                {pkg.description}
                                                            </CardDescription>
                                                        </CardHeader>

                                                        <CardFooter className="mt-auto pt-6 pb-8 px-6">
                                                            {pkg.isPurchased ? (
                                                                <Button asChild className="w-full h-12 text-base rounded-xl bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 shadow-lg shadow-[var(--brand)]/20 group-hover:scale-[1.02] transition-transform">
                                                                    <Link href={`/dashboard/package/${pkg.id}`} className="flex items-center gap-2 justify-center">
                                                                        <PlayCircle className="h-5 w-5" />
                                                                        Guarda i Video
                                                                    </Link>
                                                                </Button>
                                                            ) : (
                                                                <BuyButton packageId={pkg.id} price={pkg.price} />
                                                            )}
                                                        </CardFooter>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                )}
            </Section>
        </div>
    )
}
