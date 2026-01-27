import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Section from '@/components/Section'
import Link from 'next/link'
import PackageClient from './PackageClient'
import PersonalView from './PersonalView'

export default async function PackagePage(props: { params: Promise<{ id: string }> }) {
    // 1. Attendi i parametri
    const params = await props.params;
    const packageId = params.id;

    const supabase = await createClient()

    // 2. Verifica autenticazione
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 3. Verifica abbonamento usando packageId
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('package_id', packageId)
        .eq('status', 'active')
        .maybeSingle()

    // 3b. Verifica se è un acquisto Una Tantum (se non trovato in subscriptions)
    let oneTimePurchase = null;

    if (!sub) {
        const { data: otp } = await supabase
            .from('one_time_purchases')
            .select('id, user_id, package_id, status, document_url')
            .eq('user_id', user.id)
            .eq('package_id', packageId)
            .maybeSingle()

        oneTimePurchase = otp;
    }

    // Se non è né abbonamento né one-time, redirect
    if (!sub && !oneTimePurchase) {
        redirect('/dashboard')
    }

    // 4. Recupera info Pacchetto
    const { data: pkg } = await supabase
        .from('packages')
        .select('id, name, description, payment_mode')
        .eq('id', packageId)
        .single()

    // 5. Verifica Profilo Utente per il nome
    // 5. Verifica Profilo Utente completo per la navbar
    const { getUserProfile } = await import('@/app/actions/user')
    const userProfile = await getUserProfile()

    // Fallback per il nome se non presente nel profilo (non dovrebbe succedere se loggato, ma per sicurezza)
    const firstName = userProfile?.profile?.full_name?.split(' ')[0] || userProfile?.user?.email?.split('@')[0]

    // LOGICA DI RENDER
    // Se è un pacchetto "payment" (One-Time) -> Mostra PersonalView
    if (pkg?.payment_mode === 'payment' && oneTimePurchase) {
        return (
            <PersonalView
                status={(oneTimePurchase.status as 'paid' | 'pending_appointment' | 'processing_plan' | 'delivered') || 'pending_appointment'}
                documentUrl={oneTimePurchase.document_url}
                packageName={pkg.name}
                userName={firstName}
                userProfile={userProfile}
            />
        )
    }

    // Altrimenti -> Standard Video View
    const { data: videos } = await supabase
        .from('videos')
        .select('id, title, bunny_video_id, order_index')
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

    return <PackageClient pkg={pkg!} videos={videos} />
}