import { getAdminPackages, getAdminStats } from '@/app/actions/admin' // Added getAdminStats
import { isAdmin } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './DashboardClient'
import Section from '@/components/Section'

export default async function AdminPage() {
    const isSuperAdmin = await isAdmin()

    if (!isSuperAdmin) {
        redirect('/dashboard')
    }

    const packages = await getAdminPackages()
    const stats = await getAdminStats() // Fetch stats
    const libraryId = process.env.BUNNY_LIBRARY_ID

    return (
        <main className="min-h-screen bg-[var(--bg)] pb-20">
            <div className="bg-slate-900 text-white py-12 mb-8">
                <Section>
                    <h1 className="text-3xl font-bold">Pannello Super Admin</h1>
                    <p className="opacity-70">Carica nuovi contenuti e gestisci i video.</p>
                </Section>
            </div>

            <Section>
                <div className="grid grid-cols-1 gap-8">
                    <AdminDashboardClient packages={packages} libraryId={libraryId} stats={stats} />
                </div>
            </Section>
        </main>
    )
}
