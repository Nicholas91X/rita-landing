'use client'

import { useState, useEffect, Suspense } from 'react'
import { Level } from '@/app/actions/content'
import { useSearchParams } from 'next/navigation'
import DashboardSidebar, { TabType } from './DashboardSidebar'
import HomeSection from './HomeSection'
import LibrarySection from './LibrarySection'
import DiscoverSection from './DiscoverSection'
import BillingSection from './BillingSection'
import ProfileSection from './ProfileSection'
import { getLibraryProgress, LibraryProgress } from '@/app/actions/video'
import { Loader2 } from 'lucide-react'

import { NotificationBell } from './NotificationBell'

export default function DashboardClient({ levels }: { levels: Level[] }) {
    const [activeTab, setActiveTab] = useState<TabType>('home')
    const [libraryProgress, setLibraryProgress] = useState<LibraryProgress[]>([])
    const searchParams = useSearchParams()

    // Fetch library progress
    useEffect(() => {
        const fetchProgress = async () => {
            const progress = await getLibraryProgress()
            setLibraryProgress(progress)
        }
        fetchProgress()
    }, [])

    // Auto-select tab logic from search params
    useEffect(() => {
        const pkgId = searchParams.get('packageId')
        const success = searchParams.get('success')
        const tab = searchParams.get('tab') as TabType

        if (tab && ['home', 'library', 'discover', 'billing', 'profile'].includes(tab)) {
            setActiveTab(tab)
        } else if (success === 'true') {
            setActiveTab('library')
        } else if (pkgId) {
            setActiveTab('discover')
        }
    }, [searchParams])

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <HomeSection levels={levels} onShowLibrary={() => setActiveTab('library')} />
            case 'library':
                return <LibrarySection
                    levels={levels}
                    progress={libraryProgress}
                    onShowDiscover={() => setActiveTab('discover')}
                />
            case 'discover':
                return <DiscoverSection levels={levels} />
            case 'billing':
                return <BillingSection />
            case 'profile':
                return <ProfileSection />
            default:
                return <HomeSection levels={levels} onShowLibrary={() => setActiveTab('library')} />
        }
    }

    return (
        <div className="flex min-h-screen bg-[var(--secondary)] text-white selection:bg-brand/30 relative">
            {/* Sfondo con gradiente radiale per profondità */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_30%,#002b54_0%,#001F3D_100%)] pointer-events-none" />

            {/* Navigation */}
            <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-72 pb-24 lg:pb-0 relative">
                {/* Content Header (Visible only on Desktop for Profile name or breadcrumbs if needed) */}
                <header className="hidden lg:flex h-20 items-center justify-between px-12 border-b border-white/5 sticky top-0 bg-white/5 backdrop-blur-xl z-20 transition-all">
                    <div>
                        {/* Empty spacing for alignment with desktop layout if needed */}
                    </div>
                    <div className="flex items-center gap-6">
                        <NotificationBell />
                        <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                            <div className="text-right">
                                <p className="text-[10px] text-brand uppercase tracking-widest font-black">Rita Workout</p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-xs font-black text-[#001F3D] shadow-xl border border-white/20">
                                RU
                            </div>
                        </div>
                    </div>
                </header>

                {/* Header Sezione */}
                <div className="relative pt-0 pb-6 md:pt-8 md:pb-16 px-6 md:px-12 bg-white/5 backdrop-blur-sm border-b border-white/5">
                    <div className="max-w-7xl mx-auto pt-20 md:pt-0">
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight italic uppercase">
                            Area <span className="text-brand">Riservata</span>
                        </h1>
                        <p className="text-neutral-400 text-lg md:text-xl font-medium max-w-2xl">
                            Benvenuta nel tuo spazio di allenamento. Qui trovi i tuoi programmi, i progressi e i nuovi contenuti.
                        </p>
                    </div>
                </div>

                {/* Dynamic Content */}
                <div className="p-6 md:p-12 pb-32 lg:pb-12 max-w-7xl mx-auto">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-neutral-500">
                            <Loader2 className="w-10 h-10 animate-spin text-brand" />
                            <p className="text-sm font-bold uppercase tracking-widest">Inizializzazione Dashboard...</p>
                        </div>
                    }>
                        {renderContent()}
                    </Suspense>
                </div>
            </main>
        </div>
    )
}
