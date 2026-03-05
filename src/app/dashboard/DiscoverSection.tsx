'use client'

import { useState } from 'react'
import { Level, Package } from '@/app/actions/content'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import BuyButton from '@/components/BuyButton'
import { Compass, Map, Check, Star, Calendar, Clock, Trophy, Contact, MessageCircle, ArrowRight } from 'lucide-react'
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
    const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)

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
                .sort((a, b) => {
                    const isABali = a.name.toLowerCase().includes('bali') || (a.name.toLowerCase().includes('pilates') && a.name.toLowerCase().includes('principiante'));
                    const isBBali = b.name.toLowerCase().includes('bali') || (b.name.toLowerCase().includes('pilates') && b.name.toLowerCase().includes('principiante'));
                    if (isABali && !isBBali) return -1;
                    if (!isABali && isBBali) return 1;
                    return 0;
                });
            return { ...course, packages: availablePackages }
        }).filter(course => course.packages.length > 0)
        return { ...level, courses: coursesWithAvailable }
    }).filter(level => level.courses.length > 0)

    if (discoverLevels.length === 0) {
        return (
            <div className="text-center py-24 border-2 border-dashed border-[var(--dash-border)] rounded-3xl bg-[var(--dash-card)] animate-in fade-in duration-700">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="mx-auto w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center">
                        <Compass className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Hai già tutto!</h3>
                    <p className="text-[var(--dash-muted-light)] leading-relaxed">
                        Complimenti! Hai accesso a tutti i nostri percorsi di allenamento. Resta sintonizzata per nuovi contenuti in arrivo.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[var(--dash-accent-soft)] p-8 rounded-3xl shadow-sm">
                <h2 className="text-3xl font-bold text-[var(--dash-accent)] tracking-tight flex items-center gap-3 mb-6">
                    Il Tuo Passaporto Fit & Smile <Contact className="w-8 h-8 text-[var(--dash-accent)]" />
                </h2>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
                    <div className="text-[var(--dash-text)] text-base font-medium max-w-2xl leading-relaxed space-y-2">
                        <p>Prepara i bagagli (e il tappetino), si parte!</p>
                        <p>Qui trovi tutte le tappe del tuo viaggio di rinascita.</p>
                        <p>Scegli la tua prossima destinazione e inizia a collezionare i timbri!</p>
                    </div>
                    {hasUsedTrial && (
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--dash-accent-soft)] border border-[var(--dash-border)] animate-in fade-in slide-in-from-right-4 duration-1000">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--dash-muted-light)]">
                                Periodo di prova già usufruito
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {discoverLevels.map((level) => (
                <div key={level.id} className="space-y-16">
                    {level.courses.map((course) => (
                        <div key={course.id} className="space-y-8">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-brand" />
                                {course.name.toLowerCase().includes('pilates') ? (
                                    <span className="text-[var(--dash-accent)]">MESE 1</span>
                                ) : (course.name.toLowerCase().includes('total') || course.name.toLowerCase().includes('body')) ? (
                                    <span className="text-[var(--dash-accent)]">MESE 2</span>
                                ) : course.name}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 relative">
                                {course.packages.map((pkg, index) => {
                                    const isBali = pkg.name.toLowerCase().includes('bali') || (pkg.name.toLowerCase().includes('pilates') && pkg.name.toLowerCase().includes('principiante'));
                                    const isNewYork = pkg.name.toLowerCase().includes('new york') || pkg.name.toLowerCase().includes('total') || pkg.name.toLowerCase().includes('body');
                                    const isLast = index === course.packages.length - 1;
                                    const isEndOfRowDesktop = index % 3 === 2;
                                    const isEndOfRowTablet = index % 2 === 1;

                                    return (
                                        <div key={pkg.id} className="relative group/card">
                                            {/* Connecting Map Paths */}
                                            {!isLast && (
                                                <>
                                                    {/* Desktop/Tablet Horizontal Path */}
                                                    <div className={`hidden md:block absolute -right-12 top-1/2 w-12 border-t-2 border-dashed border-[var(--dash-accent)]/40 z-0 ${isEndOfRowDesktop ? 'lg:hidden' : ''} ${isEndOfRowTablet ? 'md:hidden lg:block' : ''}`} />

                                                    {/* Mobile/Wrap Vertical Path */}
                                                    <div className={`absolute left-1/2 -bottom-12 h-12 border-l-2 border-dashed border-[var(--dash-accent)]/40 z-0 ${!isEndOfRowDesktop ? 'lg:hidden' : 'lg:block'} ${!isEndOfRowTablet ? 'md:hidden' : 'md:block lg:hidden'} md:hidden`} />

                                                    {/* Always show vertical on true mobile */}
                                                    <div className="md:hidden absolute left-1/2 -bottom-12 h-12 border-l-2 border-dashed border-[var(--dash-accent)]/40 z-0" />
                                                </>
                                            )}

                                            <Card className="bg-[var(--dash-card)] border border-[var(--dash-accent)]/10 shadow-xl overflow-hidden group hover:border-[var(--dash-accent)]/30 transition-all duration-500 rounded-[40px] flex flex-col relative z-10 h-full">
                                                {/* Image Header */}
                                                <div className="h-56 w-full relative overflow-hidden">
                                                    {pkg.image_url ? (
                                                        <Image
                                                            src={pkg.image_url}
                                                            alt={pkg.name}
                                                            fill
                                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                            className="object-cover group-hover:scale-110 transition-transform duration-1000"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-[var(--dash-placeholder)] flex items-center justify-center">
                                                            <Compass className="w-12 h-12 text-[var(--dash-accent)]/20" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                                    {/* Badge */}
                                                    <div className="absolute top-4 right-4">
                                                        {isTrialEligible ? (
                                                            <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-emerald-400/50">
                                                                7 Giorni Gratis
                                                            </div>
                                                        ) : isLoyaltyEligible ? (
                                                            <div className="bg-brand text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-orange-400/50">
                                                                Sconto Active
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    {/* Price Tag Overlay */}
                                                    <div className="absolute bottom-4 left-6">
                                                        <div className="bg-[var(--dash-card)] backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-lg">
                                                            <span className="text-[var(--dash-accent)] font-black text-sm">€{pkg.price}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <CardHeader className="pb-4 pt-8 px-8 flex-1 space-y-6">
                                                    <div>
                                                        <h4 className="text-[var(--dash-accent)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">Destinazione</h4>
                                                        <CardTitle className="text-3xl font-black text-[var(--dash-text)] uppercase tracking-tighter leading-none mb-1">
                                                            {isBali ? "Bali" : isNewYork ? "New York" : pkg.name}
                                                            {isBali && <span className="ml-2">🍹</span>}
                                                            {isNewYork && <span className="ml-2">🗽</span>}
                                                        </CardTitle>
                                                        <p className="text-[var(--dash-muted)] text-sm font-medium">
                                                            {pkg.title || (isNewYork ? "Energia & Metabolismo" : "Metodo Fit & Smile")}
                                                        </p>
                                                    </div>

                                                    {/* Mini Highlights - Inspired by the image */}
                                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                                        <div className="bg-[var(--dash-card-header)] p-3 rounded-2xl border border-[var(--dash-border)] flex flex-col items-center text-center gap-1">
                                                            <Clock className="w-4 h-4 text-[var(--dash-accent)]" />
                                                            <span className="text-[9px] uppercase font-bold text-[var(--dash-muted-light)]">Durata</span>
                                                            <span className="text-[11px] font-black text-[var(--dash-text)]">4 Settimane</span>
                                                        </div>
                                                        <div className="bg-[var(--dash-card-header)] p-3 rounded-2xl border border-[var(--dash-border)] flex flex-col items-center text-center gap-1">
                                                            <Calendar className="w-4 h-4 text-[var(--dash-accent)]" />
                                                            <span className="text-[9px] uppercase font-bold text-[var(--dash-muted-light)]">Ritmo</span>
                                                            <span className="text-[11px] font-black text-[var(--dash-text)]">3x Week</span>
                                                        </div>
                                                    </div>

                                                    {/* "INIZIA QUI" label - Specific for Bali */}
                                                    {isBali && (
                                                        <div className="flex justify-center">
                                                            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-orange-50 text-[var(--brand)] text-[10px] font-black uppercase tracking-widest border border-orange-200 shadow-sm animate-pulse">
                                                                Ideale per iniziare 🌸
                                                            </span>
                                                        </div>
                                                    )}
                                                </CardHeader>

                                                <CardFooter className="pt-2 pb-10 px-8 flex flex-col gap-4">
                                                    <Button
                                                        onClick={() => setSelectedPkg(pkg)}
                                                        variant="ghost"
                                                        className="w-full text-[var(--dash-accent)] font-black uppercase tracking-widest text-[10px] gap-2 hover:bg-[var(--dash-accent)]/10 transition-all"
                                                    >
                                                        Vedi Itinerario Completo <ArrowRight className="w-4 h-4" />
                                                    </Button>

                                                    <BuyButton
                                                        packageId={pkg.id}
                                                        packageName={pkg.name}
                                                        price={pkg.price}
                                                        isTrial={isTrialEligible}
                                                        isDiscounted={isLoyaltyEligible}
                                                        className="w-full bg-[var(--dash-heading)] hover:bg-[var(--dash-accent)] text-white rounded-xl h-11 font-bold uppercase tracking-widest text-[11px] transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] px-2 text-center"
                                                        customLabel="Ottieni il Biglietto"
                                                    />
                                                </CardFooter>
                                            </Card>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {/* Help / Advice Section */}
            <div className="mt-20 bg-[var(--dash-accent-soft)] p-8 sm:p-12 rounded-[40px] border border-[var(--dash-accent)]/10 shadow-sm text-center space-y-6 max-w-4xl mx-auto">
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-[var(--dash-accent)] uppercase tracking-tight">
                        Non sai quale biglietto prendere?
                    </h3>
                    <div className="text-[var(--dash-text)] text-lg font-medium leading-relaxed max-w-3xl mx-auto">
                        <p>Il mio consiglio è di seguire l&apos;ordine naturale:</p>
                        <p className="text-[var(--dash-accent)] font-black text-2xl my-3">
                            Bali → NY → Siviglia → Avana
                        </p>
                        <div className="mt-4 text-base text-[var(--dash-muted)] space-y-2">
                            <p>Il tuo corpo è stato progettato per questo percorso.</p>
                            <p>Ma se ti senti già piena di energia, puoi volare subito a New York!</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={() => window.open('https://wa.me/your-number', '_blank')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-12 px-8 font-bold uppercase tracking-wide text-xs gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <MessageCircle className="w-5 h-5" /> Scrivimi per un consiglio
                    </Button>
                </div>
            </div>

            <Dialog open={!!selectedPkg} onOpenChange={(open) => !open && setSelectedPkg(null)}>
                <DialogContent className="max-w-2xl bg-[var(--dash-card)] border-none rounded-[28px] sm:rounded-[32px] overflow-hidden p-0">
                    {selectedPkg && (
                        <div className="flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
                            {/* Booking Style Header Image */}
                            <div className="relative h-48 sm:h-64 w-full">
                                {selectedPkg.image_url ? (
                                    <Image src={selectedPkg.image_url} alt={selectedPkg.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[var(--dash-text)]" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 sm:p-8 w-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex gap-0.5 text-yellow-400">
                                            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                                        </div>
                                        <span className="bg-yellow-400 text-[var(--dash-text)] text-[10px] font-black uppercase px-2 py-0.5 rounded-md">Eccezionale</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-none mb-1 shadow-black drop-shadow-lg">
                                        {selectedPkg.name.toLowerCase().includes('pilates') && selectedPkg.name.toLowerCase().includes('principiante') ? (
                                            <>MESE 1: <span className="text-[var(--dash-text)]">Destinazione Bali</span></>
                                        ) : selectedPkg.name}
                                    </h2>
                                    <p className="text-white/80 text-sm font-medium flex items-center gap-1.5">
                                        <Map className="w-3.5 h-3.5" /> Destinazione Premium
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 space-y-8 bg-[var(--dash-card-header)]">
                                {/* Highlights */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-[var(--dash-card)] p-3 rounded-xl border border-[var(--dash-border)] shadow-sm flex flex-col items-center text-center gap-1">
                                        <Clock className="w-5 h-5 text-[var(--dash-accent)]" />
                                        <span className="text-[10px] uppercase font-bold text-[var(--dash-muted-light)]">Durata</span>
                                        <span className="text-xs font-black text-[var(--dash-text)]">4 Settimane</span>
                                    </div>
                                    <div className="bg-[var(--dash-card)] p-3 rounded-xl border border-[var(--dash-border)] shadow-sm flex flex-col items-center text-center gap-1">
                                        <Trophy className="w-5 h-5 text-[var(--dash-accent)]" />
                                        <span className="text-[10px] uppercase font-bold text-[var(--dash-muted-light)]">Livello</span>
                                        <span className="text-xs font-black text-[var(--dash-text)]">Tutti</span>
                                    </div>
                                    <div className="bg-[var(--dash-card)] p-3 rounded-xl border border-[var(--dash-border)] shadow-sm flex flex-col items-center text-center gap-1">
                                        <Calendar className="w-5 h-5 text-[var(--dash-accent)]" />
                                        <span className="text-[10px] uppercase font-bold text-[var(--dash-muted-light)]">Frequenza</span>
                                        <span className="text-xs font-black text-[var(--dash-text)]">3x Settimana</span>
                                    </div>
                                    <div className="bg-[var(--dash-card)] p-3 rounded-xl border border-[var(--dash-border)] shadow-sm flex flex-col items-center text-center gap-1">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <span className="text-[10px] uppercase font-bold text-[var(--dash-muted-light)]">Accesso</span>
                                        <span className="text-xs font-black text-[var(--dash-text)]">Illimitato</span>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-3">
                                    <h3 className="text-lg font-black text-[var(--dash-text)]">
                                        Benvenuta a {
                                            selectedPkg.name.toLowerCase().includes('bali') || (selectedPkg.name.toLowerCase().includes('pilates') && selectedPkg.name.toLowerCase().includes('principiante'))
                                                ? "Bali 🍹"
                                                : (selectedPkg.name.toLowerCase().includes('total') || selectedPkg.name.toLowerCase().includes('body') || selectedPkg.name.toLowerCase().includes('new york'))
                                                    ? "New York 🗽"
                                                    : selectedPkg.name
                                        }
                                    </h3>
                                    {(selectedPkg.name.toLowerCase().includes('bali') || (selectedPkg.name.toLowerCase().includes('pilates') && selectedPkg.name.toLowerCase().includes('principiante')))
                                        ? (
                                            <div className="text-[var(--dash-muted)] text-sm leading-relaxed space-y-3">
                                                <p>Togliti le scarpe.</p>
                                                <p>Questo mese non dobbiamo correre.</p>
                                                <p>Dobbiamo &apos;fluire&apos;.</p>
                                                <p>Lavoreremo come l&apos;acqua.</p>
                                                <p>Movimenti dolci di Pilates per sgonfiare le gambe.</p>
                                                <p>Total Body a terra per risvegliare i muscoli senza traumi.</p>
                                                <p>E la sera?</p>
                                                <p>Impareremo a muovere il bacino con la dolcezza della Bachata.</p>
                                                <p>Le basi morbide della Salsa.</p>
                                                <p>Niente scatti, solo onde.</p>
                                            </div>
                                        )
                                        : (selectedPkg.name.toLowerCase().includes('total') || selectedPkg.name.toLowerCase().includes('body') || selectedPkg.name.toLowerCase().includes('new york'))
                                            ? (
                                                <div className="text-[var(--dash-muted)] text-sm leading-relaxed space-y-3">
                                                    <p>Allaccia le scarpe da ginnastica, siamo nella Grande Mela!</p>
                                                    <p>Ora che ti sei sbloccata, alziamo un po&apos; il ritmo.</p>
                                                    <p>Questo mese il focus è sulle gambe e sull&apos;energia:</p>
                                                    <p>Camminate sul posto, esercizi in piedi per il metabolismo e una postura fiera da &apos;donna in carriera&apos;.</p>
                                                    <p>Nel weekend ci scateniamo con una Salsa elegante, per sentirci dive di Broadway!</p>
                                                </div>
                                            )
                                            : (
                                                <p className="text-[var(--dash-muted)] text-sm leading-relaxed">
                                                    {selectedPkg.description || "Un viaggio trasformativo per il tuo benessere fisico e mentale. Questo pacchetto include tutto il necessario per raggiungere i tuoi obiettivi con il metodo RITA."}
                                                </p>
                                            )}
                                </div>

                                {/* Itinerary List */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-[var(--dash-text)]">Il tuo Itinerario di Viaggio</h3>
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4].map((week) => (
                                            <div key={week} className="flex items-start gap-4 p-4 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)] shadow-sm hover:shadow-md transition-shadow">
                                                <div className="w-10 h-10 rounded-full bg-[var(--dash-placeholder)] flex items-center justify-center shrink-0 font-black text-[var(--dash-accent)]">
                                                    {week}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-[var(--dash-text)] text-sm uppercase mb-1">
                                                        SETTIMANA {week}: {week === 1 ? "L'Atterraggio" : week === 2 ? "La Scoperta" : week === 3 ? "L'Avventura" : "Il Relax"}
                                                    </h4>
                                                    {(week === 1 || week === 3) && (
                                                        <p className="text-[10px] text-[var(--dash-accent)] font-bold mb-1">
                                                            3 Lezioni Fit
                                                        </p>
                                                    )}
                                                    {(week === 2 || week === 4) && (
                                                        <p className="text-[10px] text-[var(--dash-accent)] font-bold mb-1 flex items-center gap-1">
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
                                        <div className="font-bold text-[var(--dash-text)] text-sm">Eccezionale</div>
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
                                        className="w-full bg-[var(--dash-heading)] hover:bg-[var(--dash-accent)] text-white rounded-2xl h-14 font-black uppercase tracking-widest text-xs transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                        customLabel="Prenota Ora il Tuo Posto"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    )
}
