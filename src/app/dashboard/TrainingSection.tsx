'use client'

import { useState, useEffect } from 'react'
import { Level } from '@/app/actions/content'
import { LibraryProgress } from '@/app/actions/video'
import LibrarySection from './LibrarySection'
import DiscoverSection from './DiscoverSection'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

interface TrainingSectionProps {
    levels: Level[]
    progress: LibraryProgress[]
    userProfile: any
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Tabs - Styled to match previous design aesthetics */}
            <div className="flex justify-center md:justify-start">
                <div className="bg-white rounded-full p-1.5 flex gap-1 shadow-sm border border-[#846047]/10 w-full md:w-auto">
                    <button
                        onClick={() => setSubTab('my-trainings')}
                        className={cn(
                            "px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 flex-1 md:flex-none text-center whitespace-nowrap",
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
                            "px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 flex-1 md:flex-none text-center whitespace-nowrap",
                            subTab === 'new-trainings'
                                ? "bg-[#846047] text-white shadow-md"
                                : "text-[#846047]/70 hover:bg-[#846047]/5 hover:text-[#846047]"
                        )}
                    >
                        Nuovi Allenamenti
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
