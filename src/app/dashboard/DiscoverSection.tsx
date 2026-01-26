'use client'

import { useState } from 'react'
import { Level } from '@/app/actions/content'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import BuyButton from '@/components/BuyButton'
import { Compass, Eye, Map, Check, Star, Calendar, Clock, Trophy, Leaf } from 'lucide-react'
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
    const [selectedPkg, setSelectedPkg] = useState<any>(null)

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
            <div className="bg-white p-8 rounded-3xl shadow-sm">
                <div className="inline-block bg-pink-50 px-6 py-3 rounded-2xl mb-6">
                    <h2 className="text-3xl font-bold text-[#001f3d] tracking-tight flex items-center gap-3">
                        Il Tuo Passaporto Fit & Smile <Map className="w-8 h-8 text-[#001f3d]" />
                    </h2>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
                    <div className="text-[#001f3d]/70 text-base font-medium max-w-2xl leading-relaxed space-y-2">
                        <p>Prepara i bagagli (e il tappetino), si parte!</p>
                        <p>Qui trovi tutte le tappe del tuo viaggio di rinascita.</p>
                        <p>Scegli la tua prossima destinazione e inizia a collezionare i timbri!</p>
                    </div>
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
                        <span className="text-neutral-500 font-black uppercase tracking-[0.2em] text-xs flex items-center gap-2">
                            <span className="text-[#001f3d] text-base">|</span> {level.name.toLowerCase().includes('principiante') ? 'PRIMA TAPPA CONSIGLIATA: BALI (MESE 1)' : `CATEGORIA: ${level.name}`}
                        </span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    <div className="space-y-16">
                        {level.courses.map((course) => (
                            <div key={course.id} className="space-y-8">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-brand" />
                                    {course.name.toLowerCase().includes('pilates') ? (
                                        <span className="text-[#846047]">MESE 1</span>
                                    ) : course.name.toLowerCase().includes('total') || course.name.toLowerCase().includes('body') ? (
                                        <span className="text-[#846047]">MESE 2</span>
                                    ) : course.name}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {course.packages.map((pkg) => (
                                        <Card key={pkg.id} className="bg-[#fffcfc] border-white/5 shadow-2xl overflow-hidden group hover:border-[var(--brand)]/40 transition-all duration-300 rounded-[32px] flex flex-col">
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
                                                <CardTitle className="text-xl font-black text-[#2a2e30] line-clamp-2 min-h-[3.5rem] italic tracking-tighter group-hover:text-[var(--brand)] transition-colors">
                                                    {pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante')
                                                        ? (
                                                            <span className="flex flex-col gap-1 text-[#846047]">
                                                                <span className="uppercase not-italic">BALI:</span>
                                                                <span className="flex items-center gap-2">Equilibrio & Detox <Leaf className="w-5 h-5 text-emerald-500 fill-emerald-100" /></span>
                                                            </span>
                                                        )
                                                        : (pkg.name.toLowerCase().includes('total') || pkg.name.toLowerCase().includes('body'))
                                                            ? (
                                                                <span className="flex flex-col gap-1 text-[#846047]">
                                                                    <span className="uppercase not-italic">NEW YORK:</span>
                                                                    <span>Energia & Metabolismo 🍎</span>
                                                                </span>
                                                            )
                                                            : <span className="uppercase">{pkg.name}</span>}
                                                </CardTitle>
                                                {pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante') ? (
                                                    <div className="mt-3">
                                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#f3efec] text-[#846047] text-xs font-black uppercase tracking-wider">
                                                            INIZIA QUI
                                                        </span>
                                                    </div>
                                                ) : (pkg.name.toLowerCase().includes('total') || pkg.name.toLowerCase().includes('body')) ? (
                                                    <div className="mt-3">
                                                        {/* No description for total body */}
                                                    </div>
                                                ) : (
                                                    <CardDescription className="text-gray-500 text-xs mt-2 line-clamp-3 leading-relaxed font-medium">
                                                        {pkg.description}
                                                    </CardDescription>
                                                )}
                                            </CardHeader>

                                            <CardFooter className="pt-2 pb-10 px-6 flex flex-col gap-3">
                                                <Button
                                                    onClick={() => setSelectedPkg(pkg)}
                                                    variant="outline"
                                                    className="w-full h-12 rounded-2xl border-[#7f554f] bg-[#7f554f] hover:bg-[#7f554f]/90 text-white font-bold uppercase tracking-wide text-[11px] gap-2 shadow-lg shadow-[#7f554f]/20"
                                                >
                                                    <Map className="w-4 h-4" /> Scopri l&apos;itinerario
                                                </Button>

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

            <Dialog open={!!selectedPkg} onOpenChange={(open) => !open && setSelectedPkg(null)}>
                <DialogContent className="max-w-2xl bg-white border-none rounded-[32px] overflow-hidden p-0">
                    {selectedPkg && (
                        <div className="flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
                            {/* Booking Style Header Image */}
                            <div className="relative h-48 sm:h-64 w-full">
                                {selectedPkg.image_url ? (
                                    <Image src={selectedPkg.image_url} alt={selectedPkg.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[#2a2e30]" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 sm:p-8 w-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex gap-0.5 text-yellow-400">
                                            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                                        </div>
                                        <span className="bg-yellow-400 text-[#2a2e30] text-[10px] font-black uppercase px-2 py-0.5 rounded-md">Eccezionale</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-none mb-1 shadow-black drop-shadow-lg">
                                        {selectedPkg.name.toLowerCase().includes('pilates') && selectedPkg.name.toLowerCase().includes('principiante') ? (
                                            <>MESE 1: <span className="text-[#f4f1ea]">Destinazione Bali</span></>
                                        ) : selectedPkg.name}
                                    </h2>
                                    <p className="text-white/80 text-sm font-medium flex items-center gap-1.5">
                                        <Map className="w-3.5 h-3.5" /> Destinazione Premium
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 space-y-8 bg-[#f8f9fa]">
                                {/* Highlights */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center gap-1">
                                        <Clock className="w-5 h-5 text-[#846047]" />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Durata</span>
                                        <span className="text-xs font-black text-[#2a2e30]">4 Settimane</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center gap-1">
                                        <Trophy className="w-5 h-5 text-[#846047]" />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Livello</span>
                                        <span className="text-xs font-black text-[#2a2e30]">Tutti</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center gap-1">
                                        <Calendar className="w-5 h-5 text-[#846047]" />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Frequenza</span>
                                        <span className="text-xs font-black text-[#2a2e30]">3x Settimana</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center gap-1">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Accesso</span>
                                        <span className="text-xs font-black text-[#2a2e30]">Illimitato</span>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-3">
                                    <h3 className="text-lg font-black text-[#2a2e30]">Benvenuta a Bali! 🍹</h3>
                                    {selectedPkg.name.toLowerCase().includes('pilates') && selectedPkg.name.toLowerCase().includes('principiante')
                                        ? (
                                            <div className="text-gray-600 text-sm leading-relaxed space-y-3">
                                                <p>Togliti le scarpe.</p>
                                                <p>Questo mese non dobbiamo correre, dobbiamo 'fluire'.</p>
                                                <p>Lavoreremo come l'acqua: movimenti dolci di Pilates per sgonfiare le gambe e Total Body a terra per risvegliare i muscoli senza traumi.</p>
                                                <p>E la sera?</p>
                                                <p>Impareremo a muovere il bacino con la dolcezza della Bachata e le basi morbide della Salsa.</p>
                                                <p>Niente scatti, solo onde.</p>
                                            </div>
                                        )
                                        : (
                                            <p className="text-gray-600 text-sm leading-relaxed">
                                                {selectedPkg.description || "Un viaggio trasformativo per il tuo benessere fisico e mentale. Questo pacchetto include tutto il necessario per raggiungere i tuoi obiettivi con il metodo RITA."}
                                            </p>
                                        )}
                                </div>

                                {/* Itinerary List */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-[#2a2e30]">Il tuo Itinerario di Viaggio</h3>
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4].map((week) => (
                                            <div key={week} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="w-10 h-10 rounded-full bg-[#f1ebe7] flex items-center justify-center shrink-0 font-black text-[#846047]">
                                                    {week}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-[#2a2e30] text-sm uppercase mb-1">
                                                        SETTIMANA {week}: {week === 1 ? "L'Atterraggio" : week === 2 ? "La Scoperta" : week === 3 ? "L'Avventura" : "Il Relax"}
                                                    </h4>
                                                    {(week === 1 || week === 3) && (
                                                        <p className="text-[10px] text-[#846047] font-bold mb-1">
                                                            3 Lezioni Fit
                                                        </p>
                                                    )}
                                                    {(week === 2 || week === 4) && (
                                                        <p className="text-[10px] text-[#846047] font-bold mb-1 flex items-center gap-1">
                                                            3 Lezioni Fit + Sorpresa 🎁
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Reviews / Trust */}
                                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <div className="bg-emerald-500 rounded-lg p-2 text-white font-black text-xl">9.8</div>
                                    <div>
                                        <div className="font-bold text-[#2a2e30] text-sm">Eccezionale</div>
                                        <div className="text-xs text-emerald-700">Basato su oltre 500 viaggiatrici felici</div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <BuyButton
                                        packageId={selectedPkg.id}
                                        packageName={selectedPkg.name}
                                        price={selectedPkg.price}
                                        isTrial={isTrialEligible}
                                        isDiscounted={isLoyaltyEligible}
                                        className="w-full bg-[#2a2e30] hover:bg-[#846047] text-white rounded-2xl h-14 font-black uppercase tracking-widest text-xs transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                        customLabel="Prenota Ora il Tuo Posto"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
