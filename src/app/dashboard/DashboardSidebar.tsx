'use client'

import { LucideIcon, Home, BookOpen, Search, CreditCard, User, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signOutUser } from '@/app/actions/user'
import { toast } from 'sonner'
import { NotificationBell } from './NotificationBell'

export type TabType = 'home' | 'library' | 'discover' | 'billing' | 'profile'

interface NavItem {
    id: TabType
    label: string
    icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'CORSI', icon: BookOpen },
    { id: 'discover', label: 'Scopri', icon: Search },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'profile', label: 'Profilo', icon: User },
]

export interface DashboardSidebarProps {
    activeTab: TabType
    setActiveTab: (tab: TabType) => void
    userProfile?: any
}

export default function DashboardSidebar({ activeTab, setActiveTab, userProfile }: DashboardSidebarProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 h-screen fixed left-0 top-0 bg-[var(--brand)] border-r border-white/10 p-6 z-20 shadow-[4px_0_24px_rgba(244,101,48,0.2)]">
                <Link href="/" className="mb-10 px-2 flex items-center gap-3 group transition-transform hover:scale-[1.02]">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                        <Image
                            src="/logo/logo.png"
                            alt="Fitandsmile Logo"
                            width={48}
                            height={48}
                            className="object-contain"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                            Rita <span className="block text-secondary text-sm not-italic font-bold tracking-widest mt-0.5 opacity-90">Workout</span>
                        </span>
                    </div>
                </Link>

                <nav className="flex-1 space-y-2">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group relative overflow-hidden",
                                activeTab === item.id
                                    ? "text-[#001F3D] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] scale-[1.02]"
                                    : "text-white/80 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <item.icon className={cn(
                                "w-5 h-5 transition-transform duration-300",
                                activeTab === item.id ? "scale-110 text-[#001F3D]" : "group-hover:scale-110"
                            )} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="pt-6 border-t border-white/10">
                    <button
                        onClick={async () => {
                            try {
                                await signOutUser()
                            } catch {
                                toast.error('Errore durante il logout')
                            }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white/90 hover:bg-white/10 transition-all duration-300 group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Esci
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[var(--brand)] shadow-[0_-8px_30px_rgba(244,101,48,0.4)] border-t border-white/10 px-2 flex items-center justify-around z-50 rounded-t-[32px]">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                            "flex flex-col items-center gap-1 transition-all duration-300 relative px-2 py-2 rounded-xl min-w-[60px]",
                            activeTab === item.id ? "text-[#001F3D] bg-white scale-105 -translate-y-1 shadow-[0_10px_25px_rgba(0,0,0,0.1)]" : "text-white/70"
                        )}
                    >
                        <item.icon className="w-5 h-5 transition-transform duration-300" />
                        <span className="text-[9px] font-black uppercase tracking-tight text-center">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--brand)] border-b border-white/10 px-6 flex items-center justify-between z-40 shadow-lg">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/logo/logo.png"
                        alt="Fitandsmile Logo"
                        width={32}
                        height={32}
                        className="object-contain"
                    />
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">
                        Rita <span className="not-italic font-bold text-sm tracking-widest opacity-80">Workout</span>
                    </h1>
                </Link>
                <div className="flex items-center gap-4">
                    <NotificationBell />
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-[#001F3D] shadow-lg border border-brand/10 overflow-hidden">
                        {userProfile?.profile?.avatar_url ? (
                            <img
                                src={userProfile.profile.avatar_url}
                                alt="Profile"
                                className="w-full h-full object-cover"
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
            </header>
        </>
    )
}
