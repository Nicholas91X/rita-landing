'use client'

import { useState, useEffect } from 'react'
import { Level } from '@/app/actions/content'
import { LibraryProgress } from '@/app/actions/video'
import LibrarySection from './LibrarySection'
import DiscoverSection from './DiscoverSection'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

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

interface TrainingSectionProps {
    levels: Level[]
    progress: LibraryProgress[]
    userProfile: DashboardProfile | null
    userName: string
}

export default function TrainingSection({ levels, progress, userProfile, userName }: TrainingSectionProps) {
    const searchParams = useSearchParams()
    const [subTab, setSubTab] = useState<'my-trainings' | 'new-trainings'>('my-trainings')

    useEffect(() => {
        if (searchParams.get('packageId')) {
            setSubTab('new-trainings')
        }
    }, [searchParams])

    return (
        <div className="space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
            {/* Header / Tabs - Styled to match previous design aesthetics */}
            <div className="flex justify-center md:justify-start px-2 md:px-0">
                <div className="bg-white rounded-full p-1.5 flex gap-1 shadow-sm border border-[#846047]/10 w-full md:w-auto max-w-full overflow-hidden">
                    <button
                        onClick={() => setSubTab('my-trainings')}
                        className={cn(
                            "px-4 py-3 rounded-full text-[11px] sm:text-sm font-bold transition-all duration-300 flex-1 md:flex-none text-center whitespace-nowrap truncate",
                            subTab === 'my-trainings'
                                ? "bg-[#846047] text-white shadow-md"
                                : "text-[#846047]/70 hover:bg-[#846047]/5 hover:text-[#846047]"
                        )}
                    >
                        I tuoi allenamenti
                    </button>
                    <button
                        onClick={() => setSubTab('new-trainings')}
                        className={cn(
                            "px-4 py-3 rounded-full text-[11px] sm:text-sm font-bold transition-all duration-300 flex-1 md:flex-none text-center whitespace-nowrap truncate",
                            subTab === 'new-trainings'
                                ? "bg-[#846047] text-white shadow-md"
                                : "text-[#846047]/70 hover:bg-[#846047]/5 hover:text-[#846047]"
                        )}
                    >
                        Nuovi corsi
                    </button>
                </div>
            </div>

            {/* Content Switcher */}
            <div>
                {subTab === 'my-trainings' ? (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <LibrarySection
                            levels={levels}
                            progress={progress}
                            onShowDiscover={() => setSubTab('new-trainings')}
                            userName={userName}
                            oneTimePurchases={userProfile?.oneTimePurchases || []}
                        />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <DiscoverSection
                            levels={levels}
                            userProfile={userProfile}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
