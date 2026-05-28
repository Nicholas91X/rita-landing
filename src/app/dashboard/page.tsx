import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { getContentHierarchy } from '@/app/actions/content'
import StandardDashboardClient from './StandardDashboardClient'
import { isAdmin } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    // 1. Check if user is Super Admin
    const isSuperAdmin = await isAdmin()
    if (isSuperAdmin) {
        redirect('/admin')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, lead_expires_at, completion_modal_shown_at')
        .eq('id', user.id)
        .single()

    // 2. Recupera la gerarchia dei contenuti
    const levels = await getContentHierarchy()

    // Lead branch will be wired in C5; for C4 we only rename + keep standard
    // behavior intact. The profile fetch above is harmless additional work
    // that C5 will start using.
    void profile

    return (
        <main className="min-h-screen bg-[var(--secondary)]">
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-neutral-500 bg-[var(--secondary)]">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
                    <p className="text-sm font-bold uppercase tracking-widest">Inizializzazione Dashboard...</p>
                </div>
            }>
                <StandardDashboardClient levels={levels} />
            </Suspense>
        </main>
    )
}