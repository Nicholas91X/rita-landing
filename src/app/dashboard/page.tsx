import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { getContentHierarchy } from '@/app/actions/content'
import StandardDashboardClient from './StandardDashboardClient'
import LeadDashboardClient from './LeadDashboardClient'
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

    const isLead = profile?.account_type === 'lead'

    // Lead-completion modal: one-shot, fires the first time the lead has
    // earned any badge while completion_modal_shown_at is still null.
    // (Leads can only earn the Lezioni Gratis badge, so this is unambiguous.)
    let showCompletionModal = false
    if (isLead && profile?.completion_modal_shown_at == null) {
        const { count } = await supabase
            .from('user_badges')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
        showCompletionModal = (count ?? 0) > 0
    }

    return (
        <main className="min-h-screen bg-[var(--secondary)]">
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-neutral-500 bg-[var(--secondary)]">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
                    <p className="text-sm font-bold uppercase tracking-widest">Inizializzazione Dashboard...</p>
                </div>
            }>
                {isLead ? (
                    <LeadDashboardClient
                        levels={levels}
                        leadExpiresAt={profile?.lead_expires_at ?? null}
                        showCompletionModal={showCompletionModal}
                    />
                ) : (
                    <StandardDashboardClient levels={levels} />
                )}
            </Suspense>
        </main>
    )
}
