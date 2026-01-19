import { getAdminPackages, getAdminStats } from '@/app/actions/admin'
import { isAdmin } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './DashboardClient'
import Section from '@/components/Section'
import Link from 'next/link'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { signOutUser } from '@/app/actions/user'
import { Button } from '@/components/ui/button'

export default async function AdminPage() {
    const isSuperAdmin = await isAdmin()

    if (!isSuperAdmin) {
        redirect('/dashboard')
    }

    const packages = await getAdminPackages()
    const stats = await getAdminStats() // Fetch stats
    const libraryId = process.env.BUNNY_LIBRARY_ID

    return (
        <main className="min-h-screen bg-[#2A2E30] pb-20">
            <div className="bg-slate-900 border-b border-white/10 text-white sticky top-0 z-50 backdrop-blur-md bg-slate-900/90 shadow-lg">
                <div className="container mx-auto px-4 md:px-8 py-2 flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <Link href="/" className="flex items-start gap-2 group transition-transform hover:scale-[1.02]">
                            <Image
                                src="/logo/logo.png"
                                alt="Fitandsmile Logo"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm md:text-base font-black italic tracking-tighter uppercase leading-none">
                                    Rita <span className="text-brand">Workout</span>
                                </span>
                                <span className="text-[8px] uppercase tracking-[0.2em] font-bold opacity-50">Admin Panel</span>
                            </div>
                        </Link>

                        <div className="hidden md:block h-8 w-[1px] bg-white/10 self-stretch" />

                        <div className="hidden md:block">
                            <h1 className="text-sm font-bold leading-none">Pannello Super Admin</h1>
                            <p className="text-[9px] opacity-40 leading-none mt-1">Gestione contenuti e sistema.</p>
                        </div>
                    </div>

                    <form action={signOutUser}>
                        <Button
                            type="submit"
                            variant="ghost"
                            className="text-white/60 hover:text-white hover:bg-white/10 gap-2 px-2 h-8 rounded-lg transition-all"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Esci</span>
                        </Button>
                    </form>
                </div>
            </div>

            <Section>
                <div className="container mx-auto px-4 md:px-8">
                    <div className="grid grid-cols-1 gap-8">
                        <AdminDashboardClient packages={packages} libraryId={libraryId} stats={stats} />
                    </div>
                </div>
            </Section>
        </main>
    )
}
