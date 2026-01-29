'use client'

import { Level } from '@/app/actions/content'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

import { LibraryProgress } from '@/app/actions/video'

export default function HomeSection({
    levels,
    progress,
    onShowLibrary,
    userName,
    oneTimePurchases = []
}: {
    levels: Level[],
    progress: LibraryProgress[],
    onShowLibrary: () => void,
    userName?: string,
    oneTimePurchases?: Array<{
        id: string;
        created_at: string;
        status: string;
        packages: {
            id: string;
            name: string;
            description: string;
            image_url: string | null;
        } | null;
    }>
}) {
    // Determine the "Boarding Pass" package:
    // 1. Find the first purchased package that is NOT fully completed.
    // 2. If all purchased packages are completed, fallback to the first purchased package.

    let boardingPackage = null
    const purchasedPackages = []

    // Flatten all purchased packages from levels
    for (const level of levels) {
        for (const course of level.courses) {
            for (const pkg of course.packages) {
                // Focus only on subscription packages for the Boarding Pass
                if (pkg.isPurchased && pkg.payment_mode === 'subscription') {
                    purchasedPackages.push(pkg)
                }
            }
        }
    }

    // Find first incomplete
    boardingPackage = purchasedPackages.find(pkg => {
        const pkgProgress = progress.find(p => p.packageId === pkg.id)
        return pkgProgress ? !pkgProgress.isFullyCompleted : true
    })

    // Fallback to first purchased if none found or all completed
    if (!boardingPackage && purchasedPackages.length > 0) {
        boardingPackage = purchasedPackages[0]
    }

    // Fallback variable for the UI
    const recentPackage = boardingPackage

    // Get all subscription packages for the history section
    const allSubscriptionPackages = levels.flatMap(level =>
        level.courses.flatMap(course =>
            course.packages.filter(p => p.isPurchased && p.payment_mode === 'subscription')
        )
    )

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {recentPackage && (
                <div className="relative overflow-hidden rounded-[32px] bg-[#ffffff] border-2 border-[#846047] shadow-2xl flex flex-col md:flex-row">
                    {/* Main Ticket Section */}
                    <div className="flex-1 p-8 md:p-12 relative border-b-2 md:border-b-0 md:border-r-2 border-dashed border-[#846047]">
                        {/* Cutouts for ticket effect */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047]" />
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047] md:block hidden" />

                        <div className="space-y-6">
                            <div className="flex justify-between items-start">
                                <span className="text-[#846047] text-xs font-black uppercase tracking-[0.3em]">
                                    {userName ? `BOARDING PASS: ${userName}` : 'BOARDING PASS'}
                                </span>
                                <div className="text-[#846047] font-mono text-xs opacity-60">
                                    FLIGHT RW-2026
                                </div>
                            </div>

                            <div>
                                <h3 className="text-3xl md:text-4xl font-black text-[#345c72] leading-tight italic uppercase tracking-tighter mb-2">
                                    Pronta per la tua prossima tappa?
                                </h3>
                                <p className="text-[var(--secondary)]/70 text-lg font-medium">
                                    <span className="font-bold">✨ Prossima Destinazione:</span><br />
                                    {recentPackage.name}
                                </p>
                            </div>

                            <div className="flex gap-8 text-xs font-mono text-[#846047]/80">
                                <div>
                                    <span className="block opacity-50 text-[10px]">GATE</span>
                                    <span className="font-bold text-lg">01</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 text-[10px]">SEAT</span>
                                    <span className="font-bold text-lg">1A</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 text-[10px]">CLASS</span>
                                    <span className="font-bold text-lg">VIP</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stub / Action Section */}
                    <div className="w-full md:w-64 bg-[#ffffff] p-8 md:p-12 flex flex-col justify-center items-center gap-4 relative">
                        {/* Cutout for right side of stub */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047] md:block hidden" />
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f1ebe7] rounded-full border-2 border-[#846047]" />

                        {/* Barcode decoration */}
                        <div className="w-full h-8 flex justify-between items-end opacity-20 mb-2">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="bg-[#2a2e30]" style={{
                                    width: Math.random() > 0.5 ? '2px' : '4px',
                                    height: Math.random() > 0.5 ? '100%' : '70%'
                                }} />
                            ))}
                        </div>

                        <Button asChild size="lg" className="w-full bg-[#345c72] hover:bg-[#345c72]/90 text-[#f3efec] font-black py-6 rounded-xl shadow-lg shadow-black/5 group transition-all">
                            <Link href={`/dashboard/package/${recentPackage.id}`} className="flex items-center justify-center gap-2">
                                PARTI ORA <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[32px] p-8 md:p-12 space-y-8 text-[var(--secondary)] shadow-sm border border-[var(--secondary)]/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <h4 className="text-xl font-bold text-[var(--secondary)] tracking-tight">
                            Le tue precedenti destinazioni
                        </h4>
                        {allSubscriptionPackages.length > 0 && (
                            <span className="bg-[#345c72]/10 text-[#345c72] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight w-fit whitespace-nowrap">
                                {allSubscriptionPackages.length} {allSubscriptionPackages.length === 1 ? 'Abbonamento attivo' : 'Abbonamenti attivi'}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onShowLibrary}
                        className="text-brand font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all whitespace-nowrap w-fit self-end sm:self-auto"
                    >
                        VEDI TUTTE <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {allSubscriptionPackages.map((pkg) => {
                        return (
                            <Link
                                key={pkg.id}
                                href={`/dashboard/package/${pkg.id}`}
                                className="p-6 bg-white border border-[#7f554f] rounded-2xl hover:shadow-lg transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h5 className="text-[var(--secondary)] font-bold">{pkg.name}</h5>
                                        <p className="text-[var(--secondary)]/60 text-xs mt-1 uppercase tracking-widest font-bold">
                                            Vedi corso
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-[#f3efec] flex items-center justify-center group-hover:bg-[#f3efec]/80 transition-colors">
                                        <ArrowRight className="w-5 h-5 text-[#7f554f] group-hover:scale-105 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Personalized Section - Now Single Purchases */}
            {oneTimePurchases.length > 0 && (
                <div className="space-y-6">
                    <h4 className="text-xl md:text-2xl font-bold text-[#593e25] tracking-tight uppercase">
                        Il tuo percorso personalizzato
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {oneTimePurchases.map((purchase) => {
                            if (purchase.status === 'refunded' || !purchase.packages) return null

                            return (
                                <Link key={purchase.id} href={`/dashboard/package/${purchase.packages.id}?purchaseId=${purchase.id}`}>
                                    <div className="bg-white rounded-[24px] overflow-hidden border border-[#846047]/20 shadow-lg hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
                                        <div className="relative h-48 shrink-0">
                                            {purchase.packages.image_url ? (
                                                <Image
                                                    src={purchase.packages.image_url}
                                                    alt={purchase.packages.name}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-[#f3efec] flex items-center justify-center">
                                                    <span className="text-4xl">✨</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute bottom-4 left-6 right-6">
                                                <h5 className="text-white text-xl font-black italic uppercase tracking-tight line-clamp-2">{purchase.packages.name}</h5>
                                            </div>
                                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase text-[#846047] shadow-sm">
                                                {new Date(purchase.created_at).toLocaleDateString('it-IT')}
                                            </div>
                                        </div>
                                        <div className="p-6 flex justify-between items-center mt-auto">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Stato</span>
                                                <span className={`
                                                    inline-block text-xs font-bold uppercase tracking-widest flex items-center gap-1
                                                    ${purchase.status === 'delivered' ? 'text-emerald-600' :
                                                        purchase.status === 'processing_plan' ? 'text-amber-600' :
                                                            purchase.status === 'pending_appointment' ? 'text-blue-600' : 'text-[#846047]'}
                                                 `}>
                                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse
                                                        ${purchase.status === 'delivered' ? 'bg-emerald-500' :
                                                            purchase.status === 'processing_plan' ? 'bg-amber-500' :
                                                                purchase.status === 'pending_appointment' ? 'bg-blue-500' : 'bg-[#846047]'}
                                                    `} />
                                                    {purchase.status === 'delivered' ? 'Pronto' :
                                                        purchase.status === 'processing_plan' ? 'In Lavorazione' :
                                                            purchase.status === 'pending_appointment' ? 'Da Prenotare' : 'Attivo'}
                                                </span>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-[#f3efec] flex items-center justify-center group-hover:bg-[#846047] group-hover:text-white transition-colors shadow-sm">
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}


        </div>
    )
}
