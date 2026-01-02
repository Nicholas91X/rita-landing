import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import VideoPlayer from '@/components/video/VideoPlayer' // Controlla che il path sia giusto
import Section from '@/components/Section'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function PackagePage(props: { params: Promise<{ id: string }> }) {
    // 1. Attendi i parametri (Risolve il warning di Next.js)
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

    // 4. Recupera info Pacchetto e Video usando packageId
    const { data: pkg } = await supabase
        .from('packages')
        .select('name, description')
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

    // Usiamo il primo video della lista come default
    const firstVideo = videos[0]

    return (
        <main className="min-h-screen bg-background pb-20">
            <Section className="py-8">
                <Link href="/dashboard" className="flex items-center text-sm text-muted-foreground hover:text-[var(--brand)] transition-colors mb-6">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Torna alla Dashboard
                </Link>

                <h1 className="h2 text-[var(--foreground)] mb-2">{pkg?.name}</h1>
                <p className="text-[var(--muted-foreground)] mb-8">{pkg?.description}</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Player Area */}
                    <div className="lg:col-span-2">
                        {/* QUI PASSIAMO L'ID DEL VIDEO (ab1ad388...), NON DEL PACCHETTO! */}
                        <VideoPlayer videoId={firstVideo.id} />

                        <div className="mt-6">
                            <h2 className="text-xl font-bold mb-2">{firstVideo.title}</h2>
                        </div>
                    </div>

                    {/* Playlist Area */}
                    <div className="space-y-4">
                        <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground px-2">
                            Lezioni nel pacchetto
                        </h3>
                        <div className="flex flex-col gap-2">
                            {videos.map((v) => (
                                <div
                                    key={v.id}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${v.id === firstVideo.id
                                        ? 'border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]'
                                        : 'border-[var(--border)] hover:bg-[var(--panel)]'
                                        }`}
                                >
                                    <p className="text-sm font-medium">{v.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>
        </main>
    )
}