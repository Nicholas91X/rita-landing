import { getContentHierarchy } from '@/app/actions/content'
import DashboardClient from './DashboardClient'
import { isAdmin } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    // 1. Check if user is Super Admin
    const isSuperAdmin = await isAdmin()
    if (isSuperAdmin) {
        redirect('/admin')
    }

    // 2. Recupera la gerarchia dei contenuti
    const levels = await getContentHierarchy()

    return (
        <main className="min-h-screen bg-[var(--secondary)]">
            <DashboardClient levels={levels} />
        </main>
    )
}