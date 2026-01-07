import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Section from '@/components/Section'
import Link from 'next/link'
import PackageClient from './PackageClient'

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

    if (!sub) redirect('/dashboard')

    // 4. Recupera info Pacchetto e Video
    const { data: pkg } = await supabase
        .from('packages')
        .select('id, name, description')
        .eq('id', packageId)
        .single()

    const { data: videos } = await supabase
        .from('videos')
        .select('id, title, bunny_video_id')
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