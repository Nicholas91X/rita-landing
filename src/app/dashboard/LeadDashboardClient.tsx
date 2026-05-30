'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, User, LogOut, Loader2, IdCard } from 'lucide-react'
import { toast } from 'sonner'
import { unstable_rethrow, useSearchParams } from 'next/navigation'

import { Level } from '@/app/actions/content'
import { getLibraryProgress, type LibraryProgress } from '@/app/actions/video'
import { getUserProfile, signOutUser } from '@/app/actions/user'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

import DashboardShell from './DashboardShell'
import LibrarySection from './LibrarySection'
import ProfileSection from './ProfileSection'
import LeadCountdownBanner from './lead/LeadCountdownBanner'
import LeadProfileUpsellCard from './lead/LeadProfileUpsellCard'
import UpgradeModal from './lead/UpgradeModal'
import LeadCompletionModal from './lead/LeadCompletionModal'
import TransitionOverlay from '@/components/TransitionOverlay'

interface LeadDashboardProfile {
    user: { id: string; email?: string }
    profile: {
        full_name: string | null
        avatar_url: string | null
        has_used_trial: boolean
    } | null
    activeSubscriptions: Array<{ id: string; status: string }>
    badges: Array<{ id: string; badge_type: string; packages: { name: string } }>
    oneTimePurchases: Array<{
        id: string
        created_at: string
        status: string
        packages: { id: string; name: string; description: string; image_url: string | null } | null
    }>
}

type LeadTab = 'library' | 'profile'

interface LeadDashboardClientProps {
    levels: Level[]
    leadExpiresAt: string | null
    showCompletionModal: boolean
}

export default function LeadDashboardClient({
    levels,
    leadExpiresAt,
    showCompletionModal,
}: LeadDashboardClientProps) {
    const searchParams = useSearchParams()
    // Arriving from the completion modal's "Guarda il Passaporto" button
    // (router.push('/dashboard?tab=profile&sub=badges')) should land directly
    // on the profile's passport sub-tab.
    const wantsBadges = searchParams.get('tab') === 'profile' && searchParams.get('sub') === 'badges'

    const [activeTab, setActiveTab] = useState<LeadTab>(wantsBadges ? 'profile' : 'library')
    const [profileSubTab, setProfileSubTab] = useState<'info' | 'badges'>(wantsBadges ? 'badges' : 'info')
    const [libraryProgress, setLibraryProgress] = useState<LibraryProgress[]>([])
    const [userProfile, setUserProfile] = useState<LeadDashboardProfile | null>(null)
    const [upgradeOpen, setUpgradeOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const [progress, profile] = await Promise.all([
                    getLibraryProgress(),
                    getUserProfile(),
                ])
                setLibraryProgress(progress)
                setUserProfile(profile as LeadDashboardProfile)
            } catch (err) {
                logger.error('Failed to fetch lead dashboard data:', err)
            }
        }
        load()
    }, [])

    const firstName = useMemo(() => {
        const fullName = userProfile?.profile?.full_name || ''
        return fullName.split(' ')[0]
    }, [userProfile?.profile?.full_name])

    const handleLogout = async () => {
        setLoggingOut(true)
        try {
            await signOutUser()
        } catch (err) {
            unstable_rethrow(err)
            setLoggingOut(false)
            toast.error('Errore durante il logout')
        }
    }

    return (
        <DashboardShell>
            <TransitionOverlay show={loggingOut} message="Uscita in corso..." />

            <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
                <LeadCountdownBanner
                    leadExpiresAt={leadExpiresAt}
                    onUpgradeClick={() => setUpgradeOpen(true)}
                />

                <header className="bg-[var(--dash-card)] border-b border-[var(--dash-border)] px-4 md:px-12 py-6 md:py-10">
                    <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-[var(--brand)] font-bold mb-1">
                                Lezioni Gratis
                            </p>
                            <h1 className="text-2xl md:text-4xl font-bold text-[var(--dash-heading)]">
                                Ciao{firstName ? `, ${firstName}` : ''}
                            </h1>
                            <p className="text-sm text-[var(--dash-muted)] mt-1">
                                Il Rituale della Leggerezza ti aspetta.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            aria-label="Esci"
                            className="p-2 rounded-full text-[var(--dash-muted)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-accent-soft)] transition"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="max-w-5xl mx-auto mt-6 flex gap-2 bg-[var(--dash-bg)] rounded-full p-1 w-fit">
                        <TabButton
                            active={activeTab === 'library'}
                            onClick={() => setActiveTab('library')}
                            icon={<BookOpen className="h-4 w-4" />}
                            label="I tuoi video"
                        />
                        <TabButton
                            active={activeTab === 'profile'}
                            onClick={() => setActiveTab('profile')}
                            icon={<User className="h-4 w-4" />}
                            label="Profilo"
                        />
                    </div>
                </header>

                <main className="flex-1 p-4 md:p-12 max-w-5xl mx-auto w-full">
                    {!userProfile ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4 text-[var(--dash-muted)]">
                            <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
                            <p className="text-sm font-bold uppercase tracking-widest">
                                Caricamento...
                            </p>
                        </div>
                    ) : activeTab === 'library' ? (
                        <LibrarySection
                            levels={levels}
                            progress={libraryProgress}
                            onShowDiscover={() => setActiveTab('profile')}
                            oneTimePurchases={userProfile.oneTimePurchases}
                        />
                    ) : (
                        <div className="space-y-6">
                            <LeadProfileUpsellCard
                                onUpgradeClick={() => setUpgradeOpen(true)}
                            />
                            <div className="flex gap-2 bg-[var(--dash-bg)] rounded-full p-1 w-fit">
                                <TabButton
                                    active={profileSubTab === 'info'}
                                    onClick={() => setProfileSubTab('info')}
                                    icon={<User className="h-4 w-4" />}
                                    label="Dati"
                                />
                                <TabButton
                                    active={profileSubTab === 'badges'}
                                    onClick={() => setProfileSubTab('badges')}
                                    icon={<IdCard className="h-4 w-4" />}
                                    label="Passaporto"
                                />
                            </div>
                            <ProfileSection activeSubTab={profileSubTab} />
                        </div>
                    )}
                </main>
            </div>

            <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
            <LeadCompletionModal
                shouldShow={showCompletionModal}
                onUpgradeClick={() => setUpgradeOpen(true)}
            />
        </DashboardShell>
    )
}

function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition',
                active
                    ? 'bg-[var(--brand)] text-white shadow'
                    : 'text-[var(--dash-muted)] hover:text-[var(--dash-text)]',
            )}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}
