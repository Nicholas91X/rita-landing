'use client'

import { Level } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import BuyButton from '@/components/BuyButton'
import { Search, Compass } from 'lucide-react'

export default function DiscoverSection({ levels }: { levels: Level[] }) {
    // Filter only non-purchased packages
    const discoverLevels = (levels || []).map(level => {
        const coursesWithAvailable = (level.courses || []).map(course => {
            const availablePackages = (course.packages || []).filter(pkg => !pkg.isPurchased)
            return { ...course, packages: availablePackages }
        }).filter(course => course.packages.length > 0)
        return { ...level, courses: coursesWithAvailable }
    }).filter(level => level.courses.length > 0)

    if (discoverLevels.length === 0) {
        return (
            <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-3xl bg-neutral-900/50 animate-in fade-in duration-700">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="mx-auto w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center">
                        <Compass className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Hai già tutto!</h3>
                    <p className="text-neutral-400 leading-relaxed">
                        Complimenti! Hai accesso a tutti i nostri percorsi di allenamento. Resta sintonizzata per nuovi contenuti in arrivo.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Scopri Nuovi Percorsi</h2>
                <p className="text-neutral-400 mt-1">Esplora la nostra collezione di allenamenti premium.</p>
            </div>

            {discoverLevels.map((level) => (
                <div key={level.id} className="space-y-10">
                    <div className="flex items-center gap-4">
                        <span className="text-neutral-500 font-black uppercase tracking-[0.2em] text-xs">Categoria: {level.name}</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    <div className="space-y-16">
                        {level.courses.map((course) => (
                            <div key={course.id} className="space-y-8">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-brand" />
                                    {course.name}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {course.packages.map((pkg) => (
                                        <Card key={pkg.id} className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl overflow-hidden group hover:border-brand/50 transition-all duration-300 rounded-[32px]">
                                            <div className="h-2 w-full bg-brand/50 group-hover:bg-brand transition-all shadow-[0_0_15px_rgba(244,101,48,0.2)] group-hover:shadow-[0_0_25px_rgba(244,101,48,0.4)]" />
                                            <CardHeader className="pb-4 pt-8 px-8">
                                                <CardTitle className="text-xl font-black text-white line-clamp-2 min-h-[3.5rem] italic uppercase tracking-tighter group-hover:text-brand transition-colors">
                                                    {pkg.name}
                                                </CardTitle>
                                                <CardDescription className="text-neutral-400 text-xs mt-1 line-clamp-2">
                                                    {pkg.description}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardFooter className="pt-2 pb-8 px-6">
                                                <BuyButton packageId={pkg.id} price={pkg.price} />
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
