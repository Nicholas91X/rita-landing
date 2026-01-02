import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import VideoPlayer from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PlayCircle } from 'lucide-react'
import Section from '@/components/Section'

type Props = {
    params: Promise<{ id: string }>
    searchParams: Promise<{ v?: string }>
}

export default async function PackagePage(props: Props) {
    const params = await props.params
    const searchParams = await props.searchParams

    const packageId = params.id
    const videoParam = searchParams.v

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check subscription
    const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('package_id', packageId)
        .eq('status', 'active')
        .single()

    if (!subscription) {
        redirect('/dashboard')
    }

    // Fetch package info
    const { data: pkg } = await supabase
        .from('packages')
        .select('name')
        .eq('id', packageId)
        .single()

    if (!pkg) redirect('/dashboard')

    // Fetch videos
    const { data: videos } = await supabase
        .from('videos')
        .select('*')
        .eq('package_id', packageId)
        .order('order_index', { ascending: true })

    const safeVideos = videos || []

    // Determine active video
    const activeVideo = safeVideos.find(v => v.id === videoParam) || safeVideos[0]

    return (
        <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] pb-20">
            {/* Header */}
            <div className="bg-[var(--panel)] border-b border-[var(--border)] sticky top-0 z-10">
                <Section className="py-4">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" className="hover:bg-transparent pl-0 hover:text-[var(--brand)]">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <ArrowLeft className="h-5 w-5" />
                                <span className="hidden md:inline">Torna alla Dashboard</span>
                            </Link>
                        </Button>
                        <div className="h-6 w-px bg-[var(--border)] mx-2" />
                        <h1 className="text-xl font-bold truncate">{pkg.name}</h1>
                    </div>
                </Section>
            </div>

            <Section className="py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Player Area */}
                    <div className="lg:col-span-2 space-y-6">
                        {activeVideo ? (
                            <div className="space-y-4">
                                <div className="rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video relative">
                                    <VideoPlayer videoId={activeVideo.bunny_video_id} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{activeVideo.title}</h2>
                                    {activeVideo.description && (
                                        <p className="text-[var(--foreground)]/70 mt-2">{activeVideo.description}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="aspect-video bg-[var(--panel)] rounded-2xl flex items-center justify-center text-[var(--muted-foreground)]">
                                Nessun video disponibile
                            </div>
                        )}
                    </div>

                    {/* Playlist Sidebar */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg px-2">Lezioni del corso</h3>
                        <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
                            {safeVideos.map((video, index) => {
                                const isActive = video.id === activeVideo?.id
                                return (
                                    <Link
                                        key={video.id}
                                        href={`/dashboard/package/${packageId}?v=${video.id}`}
                                        className={`
                                    block p-4 rounded-xl border transition-all duration-200
                                    ${isActive
                                                ? 'bg-[var(--brand)]/10 border-[var(--brand)] shadow-sm'
                                                : 'bg-[var(--panel)] border-transparent hover:border-[var(--border)] hover:bg-[var(--panel)]/80'
                                            }
                                `}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`
                                        mt-1 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold
                                        ${isActive ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg)] text-[var(--foreground)]/50'}
                                    `}>
                                                {index + 1}
                                            </div>
                                            <div className="space-y-1">
                                                <p className={`font-medium text-sm ${isActive ? 'text-[var(--brand)]' : 'text-[var(--foreground)]'}`}>
                                                    {video.title}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-[var(--foreground)]/50">
                                                    <PlayCircle className="h-3 w-3" />
                                                    <span>Guarda ora</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}

                            {safeVideos.length === 0 && (
                                <p className="text-sm text-[var(--muted-foreground)] px-2">
                                    Non ci sono ancora lezioni caricate per questo pacchetto.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </Section>
        </main>
    )
}
