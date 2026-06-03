import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Section from '@/components/Section'
import Link from 'next/link'
import PackageClient, { type MonthTab } from './PackageClient'
import PersonalView from './PersonalView'
import { DashboardThemeProvider } from '../../ThemeContext'
import { isAdmin as checkIsAdmin } from '@/utils/supabase/admin'
import { computeUnlockStatus } from '@/lib/package-unlock'

export default async function PackagePage(props: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ purchaseId?: string }>
}) {
    // 1. Attendi i parametri e searchParams
    const params = await props.params;
    const searchParams = await props.searchParams;
    const packageId = params.id;
    const purchaseId = searchParams.purchaseId;

    const supabase = await createClient()

    // 2. Verifica autenticazione
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Sub-4: check admin status (admins bypass playback lock)
    const userIsAdmin = await checkIsAdmin(user.id)

    // 3. Verifica abbonamento usando packageId (attivo/trialing + period non scaduto)
    const { data: subRow } = await supabase
        .from('user_subscriptions')
        .select('id, current_period_end')
        .eq('user_id', user.id)
        .eq('package_id', packageId)
        .in('status', ['active', 'trialing'])
        .maybeSingle()

    const sub = subRow && (!subRow.current_period_end || new Date(subRow.current_period_end).getTime() > Date.now())
        ? subRow
        : null

    // 3b. Verifica se è un acquisto Una Tantum (se non trovato in subscriptions)
    let oneTimePurchase = null;

    if (!sub) {
        let otpQuery = supabase
            .from('one_time_purchases')
            .select('id, user_id, package_id, status, document_url')
            .eq('user_id', user.id)
            .eq('package_id', packageId)

        if (purchaseId) {
            otpQuery = otpQuery.eq('id', purchaseId)
        } else {
            // Se non specificato, prendi l'ultimo acquisto non rimborsato
            otpQuery = otpQuery.neq('status', 'refunded').order('created_at', { ascending: false }).limit(1)
        }

        const { data: otpData } = await otpQuery.maybeSingle()
        oneTimePurchase = otpData;
    }

    // Se non è né abbonamento né one-time, redirect
    if (!sub && !oneTimePurchase) {
        redirect('/dashboard')
    }

    // 4. Recupera info Pacchetto
    const { data: pkg } = await supabase
        .from('packages')
        .select('id, name, description, subtitle, payment_mode, course_id, order_index')
        .eq('id', packageId)
        .single()

    // 5. Verifica Profilo Utente per il nome
    // 5. Verifica Profilo Utente completo per la navbar
    const { getUserProfile } = await import('@/app/actions/user')
    const userProfile = await getUserProfile()

    // Fallback per il nome se non presente nel profilo (non dovrebbe succedere se loggato, ma per sicurezza)
    const firstName = userProfile?.profile?.full_name?.split(' ')[0] || userProfile?.user?.email?.split('@')[0]

    // LOGICA DI RENDER
    // Se è un pacchetto "payment" (One-Time 1:1) -> Mostra PersonalView.
    // ECCEZIONE: gli accessi lead (status='lead') sono video gratuiti, non
    // consulenze 1:1 — vanno mostrati come video gallery come gli abbonamenti.
    if (pkg?.payment_mode === 'payment' && oneTimePurchase && oneTimePurchase.status !== 'lead') {
        return (
            <DashboardThemeProvider>
                <PersonalView
                    status={(oneTimePurchase.status as 'paid' | 'pending_appointment' | 'processing_plan' | 'delivered') || 'pending_appointment'}
                    documentUrl={oneTimePurchase.document_url}
                    packageName={pkg.name}
                    userName={firstName}
                    userProfile={userProfile}
                />
            </DashboardThemeProvider>
        )
    }

    // Altrimenti -> Standard Video View
    const { data: videos } = await supabase
        .from('videos')
        .select('id, title, bunny_video_id, order_index, video_type, tappa, duration_minutes')
        .eq('package_id', packageId)
        .order('order_index', { ascending: true })

    if (!videos || videos.length === 0) {
        return (
            <Section className="py-20 text-center">
                <h1 className="h2 mb-4">{pkg?.name}</h1>
                <p>Nessun video presente in questo pacchetto.</p>
                <Link href="/dashboard" className="text-[var(--brand)] underline mt-4 block">Torna indietro</Link>
            </Section>
        )
    }

    // 6. Build the month tabs = the packages of this course (the chain). Each
    // is owned (active sub or non-refunded purchase), locked (a prior month
    // isn't completed), or unlockable. Skipped for lead access (a single free
    // package with no chain).
    const isLead = oneTimePurchase?.status === 'lead'
    let months: MonthTab[] = []
    if (!isLead && pkg?.course_id) {
        const [{ data: coursePkgs }, { data: userSubs }, { data: userOtp }, { data: userBadges }] = await Promise.all([
            supabase.from('packages').select('id, name, course_id, order_index').eq('course_id', pkg.course_id),
            supabase.from('user_subscriptions').select('package_id, status, current_period_end').eq('user_id', user.id).in('status', ['active', 'trialing']),
            supabase.from('one_time_purchases').select('package_id').eq('user_id', user.id).neq('status', 'refunded'),
            supabase.from('user_badges').select('package_id').eq('user_id', user.id),
        ])

        const nowMs = Date.now()
        const ownedIds = new Set<string>([
            ...((userSubs || [])
                .filter((s: { current_period_end: string | null }) => !s.current_period_end || new Date(s.current_period_end).getTime() > nowMs)
                .map((s: { package_id: string }) => s.package_id)),
            ...((userOtp || []).map((p: { package_id: string }) => p.package_id)),
        ])
        const completedIds = new Set((userBadges || []).map((b: { package_id: string }) => b.package_id))
        const chain = (coursePkgs || []) as Array<{ id: string; name: string; course_id: string | null; order_index: number }>

        months = chain
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((m) => {
                const owned = ownedIds.has(m.id)
                const status = owned
                    ? { isLocked: false, lockedBy: null as string | null }
                    : computeUnlockStatus(m, chain, completedIds)
                return {
                    id: m.id,
                    name: m.name,
                    monthNumber: m.order_index + 1,
                    isCurrent: m.id === packageId,
                    isOwned: owned,
                    isLocked: status.isLocked,
                    lockedBy: status.lockedBy,
                }
            })
    }

    return <DashboardThemeProvider><PackageClient pkg={pkg!} videos={videos} isAdmin={userIsAdmin} flatLayout={isLead} months={months} /></DashboardThemeProvider>
}
