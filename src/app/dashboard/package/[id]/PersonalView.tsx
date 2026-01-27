'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calendar, Download, FileText, MessageCircle, Sparkles, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardSidebar, { TabType } from '../../DashboardSidebar'
import { NotificationBell } from '../../NotificationBell'
import Image from 'next/image'

type PurchaseStatus = 'pending_appointment' | 'processing_plan' | 'delivered'

interface PersonalViewProps {
    status: PurchaseStatus
    documentUrl?: string | null
    packageName: string
    userName?: string
    userProfile: any
}

export default function PersonalView({ status, documentUrl, packageName, userName, userProfile }: PersonalViewProps) {
    const router = useRouter()

    const handleTabChange = (tab: TabType) => {
        if (tab === '1to1') return
        router.push(`/dashboard?tab=${tab}`)
    }

    const renderContent = () => {

        // Status 1: Pending Appointment (Default)
        if (status === 'pending_appointment') {
            return (
                <div className="min-h-[80vh] flex items-center justify-center p-6 animate-in fade-in duration-700">
                    <Card className="max-w-2xl w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border-[#846047]/20">
                        <div className="bg-[#593e25] p-10 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[#846047] opacity-20 mix-blend-overlay"></div>
                            <Sparkles className="w-12 h-12 text-[#e1d5c6] mx-auto mb-4 animate-pulse" />
                            <h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter mb-4">
                                Benvenuta, {userName || 'Atleta'}!
                            </h1>
                            <p className="text-[#e1d5c6] text-lg font-medium max-w-lg mx-auto">
                                Hai appena sbloccato il tuo percorso esclusivo <strong>{packageName}</strong>.
                            </p>
                        </div>

                        <div className="p-10 md:p-14 space-y-10">
                            <div className="text-center space-y-4">
                                <h2 className="text-2xl font-bold text-[#593e25]">Il prossimo step: Conosciamoci!</h2>
                                <p className="text-neutral-600 leading-relaxed text-lg">
                                    Per creare il piano perfetto per te, ho bisogno di conoscere la tua storia e i tuoi obiettivi.
                                    Prenota ora la tua consulenza diretta.
                                </p>
                            </div>

                            <div className="flex flex-col gap-4 max-w-sm mx-auto">
                                <Button asChild className="h-16 bg-[#25D366] hover:bg-[#20b85a] text-white rounded-2xl text-lg font-bold shadow-xl shadow-emerald-900/10 transition-all hover:scale-[1.02]">
                                    <Link href="https://wa.me/393519398967?text=Ciao%20Rita,%20ho%20acquistato%20il%20Percorso%20Personalizzato%20e%20vorrei%20fissare%20la%20call!" target="_blank">
                                        <MessageCircle className="w-6 h-6 mr-3" />
                                        Prenota su WhatsApp
                                    </Link>
                                </Button>
                                <p className="text-center text-xs text-neutral-400 font-medium">
                                    Ti risponderò al più presto per fissare l'orario.
                                </p>
                            </div>

                            <div className="border-t border-neutral-100 pt-8 mt-8">
                                <div className="flex items-start gap-4 p-4 bg-[#f9f5f1] rounded-2xl border border-[#e1d5c6]/50">
                                    <div className="bg-[#fff] p-2 rounded-full shadow-sm">
                                        <Calendar className="w-5 h-5 text-[#846047]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#593e25] text-sm mb-1">Cosa succede dopo la call?</h4>
                                        <p className="text-xs text-neutral-500 leading-normal">
                                            Dopo la nostra chiacchierata, elaborerò il tuo piano su misura.
                                            Troverai qui il tuo documento PDF pronto per il download entro 48h.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )
        }

        // Status 2: Processing (Admin marked as working)
        if (status === 'processing_plan') {
            return (
                <div className="w-full flex items-center justify-center animate-in fade-in duration-700">
                    <Card className="max-w-xl w-full bg-white rounded-[32px] md:rounded-[40px] shadow-2xl p-6 md:p-10 text-center border-[#846047]/10">
                        <div className="w-14 h-14 md:w-20 md:h-20 bg-[#f3efec] rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 relative">
                            <FileText className="w-7 h-7 md:w-10 md:h-10 text-[#846047] animate-pulse" />
                            <div className="absolute top-0 right-0 w-5 h-5 md:w-6 md:h-6 bg-[#593e25] rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold animate-spin-slow">
                                ⚙️
                            </div>
                        </div>
                        <h2 className="text-xl md:text-3xl font-black text-[#593e25] italic uppercase tracking-tighter mb-2 md:mb-4 leading-tight">
                            Ci stiamo lavorando!
                        </h2>
                        <p className="text-neutral-600 text-sm md:text-lg mb-5 md:mb-8 leading-relaxed max-w-sm mx-auto">
                            Grazie per la call! Rita sta elaborando il tuo <strong>{packageName}</strong> basato su quanto vi siete dette.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f3efec] rounded-full text-[#846047] text-xs md:text-sm font-bold">
                            <ClockIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            Attendi circa 48 ore
                        </div>
                    </Card>
                </div>
            )
        }

        // Status 3: Delivered (Download available)
        if (status === 'delivered') {
            return (
                <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 md:p-6 pb-24 animate-in fade-in duration-700 space-y-4 md:space-y-8">
                    <div className="text-center space-y-3">
                        <span className="inline-block text-emerald-600 font-bold uppercase tracking-widest text-[10px] md:text-xs bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 shadow-sm">
                            Pronto per il download
                        </span>
                        <h1 className="text-3xl md:text-6xl font-black text-[#593e25] italic uppercase tracking-tighter leading-none shrink-0">
                            Il tuo Piano è Qui
                        </h1>
                    </div>

                    <Card className="max-w-4xl w-full bg-white rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border-[#846047]/20 flex flex-col md:flex-row">
                        <div className="bg-[#593e25] p-8 md:p-10 md:w-2/5 flex flex-col justify-between relative overflow-hidden text-white min-h-[220px]">
                            <div className="absolute inset-0 bg-[url('/images/texture-noise.png')] opacity-10"></div>
                            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
                                <Sparkles className="w-8 h-8 text-[#e1d5c6] mb-4" />
                                <h3 className="text-2xl md:text-3xl font-black italic uppercase leading-tight mb-2">{packageName}</h3>
                                <p className="text-white/70 text-sm font-medium">Creato esclusivamente per {userName}</p>
                            </div>
                            <div className="relative z-10 mt-8 md:mt-12 flex justify-center md:justify-end">
                                <FileText className="w-20 h-20 md:w-24 md:h-24 text-white/10 absolute -bottom-4 -right-4 rotate-12" />
                            </div>
                        </div>

                        <div className="p-6 md:p-14 md:w-3/5 flex flex-col justify-center space-y-6 md:space-y-8">
                            <div className="text-center md:text-left">
                                <h4 className="text-xl md:text-2xl font-bold text-[#2a2e30] mb-2">Ora tocca a te!</h4>
                                <p className="text-neutral-500 text-sm md:text-base leading-relaxed">
                                    Scarica il documento PDF che contiene la tua scheda, i consigli nutrizionali e il programma settimanale.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {documentUrl ? (
                                    <Button asChild className="w-full h-14 md:h-16 bg-[#593e25] hover:bg-[#4a331f] text-white rounded-xl md:rounded-2xl text-base md:text-lg font-bold shadow-xl shadow-[#593e25]/20 flex items-center justify-between px-6 md:px-8 hover:scale-[1.02] transition-all">
                                        <Link href={documentUrl} target="_blank" download>
                                            <span>Scarica PDF</span>
                                            <Download className="w-5 h-5 md:w-6 md:h-6" />
                                        </Link>
                                    </Button>
                                ) : (
                                    <div className="p-4 bg-red-50 text-red-500 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>Link al documento mancante.</span>
                                    </div>
                                )}

                                <p className="text-center text-xs text-neutral-400">
                                    Hai bisogno di chiarimenti? <Link href="https://wa.me/393519398967" className="underline hover:text-[#593e25] font-semibold">Scrivimi su WhatsApp</Link>
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )
        }

        return null
    }

    return (
        <div className="flex min-h-screen bg-[#f3efec] text-[var(--secondary)] selection:bg-brand/30 relative">
            <DashboardSidebar
                activeTab="1to1"
                setActiveTab={handleTabChange}
                userProfile={userProfile}
            />

            <main className="flex-1 lg:ml-72 relative min-h-screen flex flex-col">
                {/* Desktop Header for Consistency */}
                <header className="hidden lg:flex h-14 items-center justify-between px-12 border-b border-[#f3efec] sticky top-0 bg-gradient-to-r from-[#654540] to-[#503530] backdrop-blur-xl z-20 transition-all shadow-md">
                    <div></div>
                    <div className="flex items-center gap-6">
                        <NotificationBell />
                        <div className="flex items-center gap-4 border-l border-white/20 pl-6">
                            <div className="text-right">
                                <p className="text-[10px] text-white uppercase tracking-widest font-black">Rita Workout</p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-xs font-black text-[#001F3D] shadow-xl border border-white/20 overflow-hidden relative">
                                {userProfile?.profile?.avatar_url ? (
                                    <Image
                                        src={userProfile.profile.avatar_url}
                                        alt="Profile"
                                        fill
                                        className="object-cover"
                                        sizes="40px"
                                    />
                                ) : (
                                    <span>
                                        {userProfile?.profile?.full_name
                                            ? userProfile.profile.full_name.substring(0, 2).toUpperCase()
                                            : userProfile?.user?.email?.substring(0, 2).toUpperCase() || 'RU'
                                        }
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex items-center justify-center p-4 md:p-12 pt-20 md:pt-12 max-w-7xl mx-auto w-full">
                    {renderContent()}
                </div>
            </main>
        </div>
    )
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    )
}
