import { getContentHierarchy } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Section from '@/components/Section'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { CheckCircle2, Lock, PlayCircle } from 'lucide-react'
import BuyButton from '@/components/BuyButton'

// Mappa delle immagini per livello
const LEVEL_IMAGES: Record<string, string> = {
    'Pilates': '/images/dashboard/pilates-header.png',
    'Total Body': '/images/dashboard/total-body-header.png',
    'Intermedio': '/images/dashboard/intermediate-header.png'
}

export default async function DashboardPage() {
    const levels = await getContentHierarchy()
    console.log('DEBUG: User Levels:', levels.map(l => l.name))

    return (
        <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] pb-20">
            <div className="bg-[var(--steel)] text-white py-16 mb-12">
                <Section>
                    <h1 className="text-5xl font-bold mb-4 tracking-tight">Area Riservata</h1>
                    <p className="text-white/80 text-xl font-light">
                        Benvenuta nel tuo spazio di allenamento.
                    </p>
                </Section>
            </div>

            <Section>
                {levels.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-[var(--border)] rounded-3xl opacity-50">
                        <p className="text-xl">Nessun contenuto disponibile al momento.</p>
                    </div>
                ) : (
                    levels.map((level) => {
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
                            <div key={level.id} className="mb-24 last:mb-0">
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
                                                        {/* Stripe Decorativa */}
                                                        <div className={`h-2 w-full ${pkg.isPurchased ? 'bg-green-500' : 'bg-[var(--brand)]'}`} />

                                                        <CardHeader className="pb-4">
                                                            <div className="flex justify-between items-start gap-4">
                                                                <CardTitle className="text-2xl font-bold leading-tight">
                                                                    {pkg.name}
                                                                </CardTitle>
                                                                {pkg.isPurchased && (
                                                                    <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                                                                )}
                                                            </div>
                                                            <CardDescription className="text-base font-medium text-[var(--foreground)]/70 mt-2">
                                                                {/* Colore più scuro per leggibilità */}
                                                                {pkg.description}
                                                            </CardDescription>
                                                        </CardHeader>

                                                        <CardFooter className="mt-auto">
                                                            {pkg.isPurchased ? (
                                                                <Button asChild className="w-full bg-[var(--brand)] text-white hover:opacity-90">
                                                                    <Link href={`/dashboard/package/${pkg.id}`}>
                                                                        Guarda i Video
                                                                    </Link>
                                                                </Button>
                                                            ) : (
                                                                /* Usa il nuovo componente qui */
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
        </main>
    )
}