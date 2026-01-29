'use client'

import { useState, useEffect, Suspense } from 'react'
import { Level } from '@/app/actions/content'
import { useSearchParams } from 'next/navigation'
import DashboardSidebar, { TabType } from './DashboardSidebar'
import HomeSection from './HomeSection'
import TrainingSection from './TrainingSection'
import BillingSection from './BillingSection'
import ProfileSection from './ProfileSection'
import OneToOneSection from './OneToOneSection'
import { getLibraryProgress, LibraryProgress } from '@/app/actions/video'
import { getUserProfile } from '@/app/actions/user'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

import { NotificationBell } from './NotificationBell'

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
    oneTimePurchases: Array<{
        id: string;
        created_at: string;
        status: string;
        packages: {
            id: string;
            name: string;
            description: string;
            image_url: string | null;
        } | null;
    }>;
}

export default function DashboardClient({ levels }: { levels: Level[] }) {
    const [activeTab, setActiveTab] = useState<TabType>('home')
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [profileSubTab, setProfileSubTab] = useState<'info' | 'badges'>('info')
    const [libraryProgress, setLibraryProgress] = useState<LibraryProgress[]>([])
    const [userProfile, setUserProfile] = useState<DashboardProfile | null>(null)
    const searchParams = useSearchParams()

    // Fetch library progress & user profile
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [progress, profile] = await Promise.all([
                    getLibraryProgress(),
                    getUserProfile()
                ])
                setLibraryProgress(progress)
                setUserProfile(profile as DashboardProfile)
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error)
            }
        }
        fetchData()
    }, [])

    // Auto-select tab logic from search params
    useEffect(() => {
        const pkgId = searchParams.get('packageId')
        const success = searchParams.get('success')
        const tab = searchParams.get('tab') as TabType

        if (tab && ['home', 'training', 'billing', 'profile', '1to1'].includes(tab)) {
            setActiveTab(tab)
        } else if (success === 'true') {
            setActiveTab('training')
        } else if (pkgId) {
            setActiveTab('training')
        }
    }, [searchParams])

    const fetchUserProfile = async () => {
        const profile = await getUserProfile()
        setUserProfile(profile)
    }

    const renderContent = () => {
        const fullName = userProfile?.profile?.full_name || ''
        const firstName = fullName.split(' ')[0] // Extract first name for greeting

        switch (activeTab) {
            case 'home':
                return <HomeSection levels={levels} progress={libraryProgress} onShowLibrary={() => setActiveTab('training')} userName={firstName} oneTimePurchases={userProfile?.oneTimePurchases || []} />
            case 'training':
                return <TrainingSection
                    levels={levels}
                    progress={libraryProgress}
                    userProfile={userProfile}
                    userName={firstName}
                />
            case '1to1':
                return <OneToOneSection />
            case 'billing':
                return <BillingSection />
            case 'profile':
                return <ProfileSection onProfileUpdate={fetchUserProfile} activeSubTab={profileSubTab} />
            default:
                return <HomeSection levels={levels} progress={libraryProgress} onShowLibrary={() => setActiveTab('training')} oneTimePurchases={userProfile?.oneTimePurchases || []} />
        }
    }

    return (
        <div className="flex min-h-screen bg-[#fff8f3] text-[var(--secondary)] selection:bg-brand/30 relative overflow-x-hidden">
            {/* Sfondo chiaro, rimuovo il gradiente scuro */}

            {/* Navigation */}
            <DashboardSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                userProfile={userProfile}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
            />

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 pb-24 lg:pb-0 relative overflow-x-hidden transition-all duration-300",
                isSidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
            )}>
                {/* Content Header (Visible only on Desktop for Profile name or breadcrumbs if needed) */}
                <header className="hidden lg:flex h-14 items-center justify-between px-12 border-b border-[#f3efec] sticky top-0 bg-gradient-to-r from-[#654540] to-[#503530] backdrop-blur-xl z-20 transition-all shadow-md">
                    <div>
                        {/* Empty spacing for alignment with desktop layout if needed */}
                    </div>
                    <div className="flex items-center gap-6">
                        <NotificationBell />
                        <button
                            onClick={() => setActiveTab('profile')}
                            className="flex items-center gap-4 border-l border-white/20 pl-6 hover:opacity-80 transition-opacity"
                        >
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
                        </button>
                    </div>
                </header>

                {/* Header Sezione */}
                <div className="relative pt-0 pb-6 md:pt-32 md:pb-16 px-6 md:px-12 bg-[#ffffff] backdrop-blur-sm border-b border-[var(--secondary)]/10">
                    <div className="max-w-7xl mx-auto pt-20 md:pt-0">
                        {activeTab !== 'profile' ? (
                            <>
                                <h1 className="text-4xl md:text-5xl font-medium text-[#345c72] mb-2 tracking-tight uppercase">
                                    Area <span className="text-[#345c72]">Riservata</span>
                                </h1>
                                <p className="text-[#2a2e30] text-lg md:text-xl font-medium max-w-2xl">
                                    Benvenuta nel tuo spazio di allenamento.<br />Qui trovi i tuoi programmi, i progressi e i nuovi contenuti.
                                </p>
                            </>
                        ) : (
                            <div className="space-y-8">
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-medium text-[#345c72] mb-2 tracking-tight uppercase">
                                        Il Tuo <span className="text-[#345c72]">Profilo</span>
                                    </h1>
                                    <p className="text-[#2a2e30] text-lg md:text-xl font-medium max-w-2xl">
                                        Gestisci le tue informazioni e guarda i tuoi traguardi.
                                    </p>
                                </div>

                                {/* Header / Tabs - Styled to match previous design aesthetics */}
                                <div className="flex justify-center md:justify-start">
                                    <div className="bg-white rounded-full p-1.5 flex gap-1 shadow-sm border border-[#846047]/10 w-full md:w-auto">
                                        <button
                                            onClick={() => setProfileSubTab('info')}
                                            className={cn(
                                                "px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 flex-1 md:flex-none text-center whitespace-nowrap",
                                                profileSubTab === 'info'
                                                    ? "bg-[#846047] text-white shadow-md"
                                                    : "text-[#846047]/70 hover:bg-[#846047]/5 hover:text-[#846047]"
                                            )}
                                        >
                                            Dati Personali
                                        </button>
                                        <button
                                            onClick={() => setProfileSubTab('badges')}
                                            className={cn(
                                                "px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 flex-1 md:flex-none text-center whitespace-nowrap",
                                                profileSubTab === 'badges'
                                                    ? "bg-[#846047] text-white shadow-md"
                                                    : "text-[#846047]/70 hover:bg-[#846047]/5 hover:text-[#846047]"
                                            )}
                                        >
                                            Le mie conquiste
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dynamic Content */}
                <div className="p-6 md:p-12 pb-32 lg:pb-12 max-w-7xl mx-auto">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-neutral-500">
                            <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
                            <p className="text-sm font-bold uppercase tracking-widest">Inizializzazione Dashboard...</p>
                        </div>
                    }>
                        {renderContent()}
                    </Suspense>
                </div>
            </main>
        </div >
    )
}
