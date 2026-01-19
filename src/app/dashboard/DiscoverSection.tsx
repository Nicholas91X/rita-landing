'use client'

import { Level } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import BuyButton from '@/components/BuyButton'
import { Compass } from 'lucide-react'
import Image from 'next/image'

interface DashboardProfile {
    user: {
        id: string;
        email?: string;
    };
    profile: {
        full_name: string | null;
        avatar_url: string | null;
        has_used_trial: boolean;
    } | null;
    activeSubscriptions: Array<{
        id: string;
        status: string;
    }>;
    badges: Array<{
        id: string;
        badge_type: string;
        packages: {
            name: string;
        };
    }>;
}

export default function DiscoverSection({
    levels,
    userProfile
}: {
    levels: Level[],
    userProfile?: DashboardProfile | null
}) {
    // Eligibility Logic
    const hasUsedTrial = userProfile?.profile?.has_used_trial || false
    const activeSubscriptions = userProfile?.activeSubscriptions || []
    const hasAnyActiveOrTrialing = activeSubscriptions.length > 0

    // Eligibility flags
    const isTrialEligible = !hasUsedTrial && activeSubscriptions.length === 0
    const isLoyaltyEligible = hasAnyActiveOrTrialing

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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-1">
                    <p className="text-neutral-300">Esplora la nostra collezione di allenamenti premium.</p>
                    {hasUsedTrial && (
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 animate-in fade-in slide-in-from-right-4 duration-1000">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-200">
                                Periodo di prova già usufruito
                            </span>
                        </div>
                    )}
                </div>
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
                                        <Card key={pkg.id} className="bg-white/10 border-white/10 backdrop-blur-md shadow-2xl overflow-hidden group hover:border-[var(--brand)]/40 transition-all duration-300 rounded-[32px] flex flex-col">
                                            <div className="h-48 w-full relative overflow-hidden">
                                                {pkg.image_url ? (
                                                    <Image
                                                        src={pkg.image_url}
                                                        alt={pkg.name}
                                                        fill
                                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center opacity-80">
                                                        <Compass className="w-12 h-12 text-white/10" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent" />
                                                <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--brand)] shadow-[var(--brand)]/30" />

                                                {/* Badge for Trial or Discount */}
                                                <div className="absolute bottom-4 left-4">
                                                    {isTrialEligible ? (
                                                        <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-emerald-400/50 animate-pulse">
                                                            Prova 7 Giorni Gratis
                                                        </div>
                                                    ) : isLoyaltyEligible ? (
                                                        <div className="bg-brand text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-orange-400/50">
                                                            Sconto Fedeltà Attivo
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <CardHeader className="pb-4 pt-6 px-8 flex-1">
                                                <CardTitle className="text-xl font-black text-white line-clamp-2 min-h-[3.5rem] italic uppercase tracking-tighter group-hover:text-[var(--brand)] transition-colors">
                                                    {pkg.name}
                                                </CardTitle>
                                                <CardDescription className="text-neutral-300 text-xs mt-2 line-clamp-3 leading-relaxed">
                                                    {pkg.description}
                                                </CardDescription>
                                            </CardHeader>

                                            <CardFooter className="pt-2 pb-10 px-6">
                                                <BuyButton
                                                    packageId={pkg.id}
                                                    packageName={pkg.name}
                                                    price={pkg.price}
                                                    isTrial={isTrialEligible}
                                                    isDiscounted={isLoyaltyEligible}
                                                    className="w-full bg-[var(--brand)] hover:bg-white hover:text-[var(--brand)] text-white rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] md:text-xs transition-all shadow-2xl shadow-[var(--brand)]/30 hover:scale-[1.02] active:scale-[0.98] px-2 text-center"
                                                />
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
