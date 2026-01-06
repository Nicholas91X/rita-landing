'use client'

import { LucideIcon, Home, BookOpen, Search, CreditCard, User, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export type TabType = 'home' | 'library' | 'discover' | 'billing' | 'profile'

interface NavItem {
    id: TabType
    label: string
    icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'I Miei Corsi', icon: BookOpen },
    { id: 'discover', label: 'Scopri', icon: Search },
    { id: 'billing', label: 'Fatturazione', icon: CreditCard },
    { id: 'profile', label: 'Profilo', icon: User },
]

interface DashboardSidebarProps {
    activeTab: TabType
    setActiveTab: (tab: TabType) => void
}

export default function DashboardSidebar({ activeTab, setActiveTab }: DashboardSidebarProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 h-screen fixed left-0 top-0 bg-[var(--brand)] border-r border-white/10 p-6 z-20 shadow-[4px_0_24px_rgba(244,101,48,0.2)]">
                <div className="mb-10 px-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-lg">
                        <div className="w-4 h-4 rounded-sm border-2 border-brand" />
                    </div>
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Rita <span className="block text-secondary text-sm not-italic font-bold tracking-widest mt-0.5 opacity-90">Workout</span>
                    </h1>
                </div>

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
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white/90 hover:bg-white/10 transition-all duration-300 group">
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Esci
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[var(--brand)] shadow-[0_-8px_30px_rgba(244,101,48,0.4)] border-t border-white/10 px-4 flex items-center justify-around z-50 rounded-t-[32px]">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                            "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-4 py-2 rounded-2xl",
                            activeTab === item.id ? "text-[#001F3D] bg-white scale-110 -translate-y-3 shadow-[0_10px_25px_rgba(0,0,0,0.2)]" : "text-white/70"
                        )}
                    >
                        <item.icon className={cn(
                            "w-5 h-5",
                            activeTab === item.id && "scale-110"
                        )} />
                        <span className="text-[9px] font-black uppercase tracking-tighter">{item.id === 'library' ? 'Corsi' : item.label.split(' ')[0]}</span>
                    </button>
                ))}
            </nav>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--brand)] border-b border-white/10 px-6 flex items-center justify-between z-40 shadow-lg">
                <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">
                    Rita <span className="not-italic font-bold text-sm tracking-widest opacity-80">Workout</span>
                </h1>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-[#001F3D] shadow-lg border border-brand/10">
                    RU
                </div>
            </header>
        </>
    )
}
