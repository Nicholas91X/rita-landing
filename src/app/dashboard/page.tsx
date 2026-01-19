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
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-neutral-500 bg-[var(--secondary)]">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
                    <p className="text-sm font-bold uppercase tracking-widest">Inizializzazione Dashboard...</p>
                </div>
            }>
                <DashboardClient levels={levels} />
            </Suspense>
        </main>
    )
}
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'