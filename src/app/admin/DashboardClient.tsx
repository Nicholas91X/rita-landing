'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBunnyVideo, saveVideoToDb, getAdminVideos, deleteVideo, updateVideo } from '@/app/actions/admin'
import AdminStats from './AdminStats' // Import Stats
import { Button } from '@/components/ui/button'
import { Loader2, UploadCloud, CheckCircle, AlertCircle, Trash2, Edit2, Save, X, PlayCircle, Video } from 'lucide-react'

type Package = {
    id: string
    name: string
}


type VideoRecord = {
    id: string
    title: string
    bunny_video_id: string
    package_id: string
    packages: {
        name: string
    }
}

// Stats Type (matching AdminStats)
type AdminStatsData = {
    supabase: {
        totalUsers: number;
        activeSubscriptions: number;
        totalOneTimePurchases: number;
    };
    bunny: {
        totalVideos: number;
        totalViews: number;
        bandwidthUsed: number;
    };
};

export default function AdminDashboardClient({ packages, libraryId, stats }: { packages: Package[], libraryId?: string, stats?: AdminStatsData }) {
    // Upload State
    const [title, setTitle] = useState('')
    const [selectedPackage, setSelectedPackage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<'idle' | 'creating' | 'uploading' | 'saving' | 'success' | 'error'>('idle')

    // Management State
    const [videos, setVideos] = useState<VideoRecord[]>([])
    const [loadingVideos, setLoadingVideos] = useState(true)
    const [filterPackage, setFilterPackage] = useState('')
    const [editingVideo, setEditingVideo] = useState<string | null>(null) // Video ID being edited
    const [editForm, setEditForm] = useState({ title: '', packageId: '' })


    const fetchVideos = useCallback(async () => {
        try {
            setLoadingVideos(true)
            const data = await getAdminVideos(filterPackage || undefined)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setVideos(data as any as VideoRecord[])
        } catch (error) {
            console.error('Failed to fetch videos', error)
        } finally {
            setLoadingVideos(false)
        }
    }, [filterPackage])

    // Initial fetch and on filter change
    useEffect(() => {
        fetchVideos()
    }, [fetchVideos])

    const handleUpload = async () => {
        if (!title || !selectedPackage || !file) return

        try {
            setStatus('creating')

            // 1. Create Video Placeholder in Bunny
            const bunnyVideo = await createBunnyVideo(title)
            const videoId = bunnyVideo.guid

            // 2. Upload File via Proxy
            setStatus('uploading')

            const proxyUrl = `/api/admin/bunny-proxy/${libraryId}/${videoId}`

            const uploadResponse = await fetch(proxyUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: file
            })

            if (!uploadResponse.ok) {
                const errText = await uploadResponse.text()
                throw new Error(`Upload failed: ${errText}`)
            }

            setStatus('saving')

            // 3. Save to DB
            await saveVideoToDb({
                title,
                bunnyId: videoId,
                packageId: selectedPackage
            })

            setStatus('success')
            setFile(null)
            setTitle('')

            // Refresh list
            fetchVideos()
        } catch (error) {
            console.error(error)
            setStatus('error')
        }
    }

    const handleDelete = async (videoId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo video? Verrà rimosso sia dal database che da Bunny.net.')) return

        try {
            await deleteVideo(videoId)
            setVideos(videos.filter(v => v.id !== videoId))
        } catch (error) {
            alert('Errore durante l\'eliminazione')
            console.error(error)
        }
    }

    const startEdit = (video: VideoRecord) => {
        setEditingVideo(video.id)
        setEditForm({ title: video.title, packageId: video.package_id })
    }

    const cancelEdit = () => {
        setEditingVideo(null)
        setEditForm({ title: '', packageId: '' })
    }

    const handleUpdate = async (videoId: string) => {
        try {
            await updateVideo(videoId, {
                title: editForm.title,
                packageId: editForm.packageId
            })
            setEditingVideo(null)
            fetchVideos() // Refresh to update package name in UI etc
        } catch (error) {
            alert('Errore durante l\'aggiornamento')
            console.error(error)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* --- STATS SECTION --- */}
            <div className="mb-12">
                <h2 className="text-lg font-semibold text-muted-foreground mb-4 tracking-tight">Panoramica Attività</h2>
                {stats && <AdminStats stats={stats} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* --- LEFT COLUMN: UPLOAD (Sticky on Desktop) --- */}
                <div className="lg:col-span-4 lg:sticky lg:top-8">
                    <div className="bg-card rounded-xl border shadow-sm p-6 space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <UploadCloud className="h-5 w-5 text-primary" />
                                Carica Video
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Aggiungi una nuova lezione alla libreria.
                            </p>
                        </div>

                        {/* Status Messages */}
                        {status === 'creating' || status === 'uploading' || status === 'saving' ? (
                            <div className="p-6 bg-primary/5 rounded-lg border border-primary/10 flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                <p className="text-sm font-medium text-primary">
                                    {status === 'creating' && '1/3 Creazione record...'}
                                    {status === 'uploading' && '2/3 Upload su BunnyCDN...'}
                                    {status === 'saving' && '3/3 Salvataggio DB...'}
                                </p>
                            </div>
                        ) : status === 'success' ? (
                            <div className="p-4 bg-green-500/10 text-green-600 rounded-lg flex items-center gap-3 border border-green-500/20">
                                <CheckCircle className="h-5 w-5 shrink-0" />
                                <div className="text-sm font-medium">Video pubblicato online!</div>
                            </div>
                        ) : status === 'error' ? (
                            <div className="p-4 bg-red-500/10 text-red-600 rounded-lg flex items-center gap-3 border border-red-500/20">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <div className="text-sm font-medium">Errore durante l&apos;upload.</div>
                            </div>
                        ) : null}

                        {/* Form */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Titolo
                                </label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Es. Lezione 1: introduzione"
                                    className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Pacchetto
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedPackage}
                                        onChange={(e) => setSelectedPackage(e.target.value)}
                                        className="flex h-10 w-full appearance-none rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                    >
                                        <option value="" disabled>Seleziona destinazione</option>
                                        {packages.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none opacity-50">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Media
                                </label>
                                <div
                                    className={`
                                        border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative group
                                        ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-neutral-50'}
                                    `}
                                >
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    {file ? (
                                        <div className="text-primary font-semibold flex flex-col items-center gap-2">
                                            <Video className="h-8 w-8" />
                                            <span className="text-sm truncate max-w-full px-2">{file.name}</span>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground group-hover:text-primary transition-colors flex flex-col items-center gap-2">
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                <UploadCloud className="h-5 w-5" />
                                            </div>
                                            <p className="text-sm font-medium">Clicca per selezionare</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button
                                onClick={handleUpload}
                                disabled={!title || !selectedPackage || !file || (status !== 'idle' && status !== 'success' && status !== 'error')}
                                className="w-full h-11 bg-primary text-primary-foreground hover:opacity-90 font-semibold shadow-md mt-4"
                            >
                                {status === 'uploading' ? 'Caricamento...' : 'Pubblica Video'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: LIST --- */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
                        <div>
                            <h2 className="text-xl font-bold">Libreria Contenuti</h2>
                            <p className="text-sm text-muted-foreground">{videos.length} video totali</p>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <select
                                value={filterPackage}
                                onChange={(e) => setFilterPackage(e.target.value)}
                                className="flex h-10 w-full md:w-[220px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">Tutti i Pacchetti</option>
                                {packages.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden min-h-[400px]">
                        <div className="overflow-x-auto">
                            <div className="min-w-[900px]">
                                <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <div className="col-span-6 md:col-span-6 pl-2">Video</div>
                                    <div className="col-span-4 md:col-span-4">Pacchetto</div>
                                    <div className="col-span-2 md:col-span-2 text-right pr-4">Azioni</div>
                                </div>

                                {loadingVideos ? (
                                    <div className="p-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <span className="text-sm font-medium">Caricamento libreria...</span>
                                    </div>
                                ) : videos.length === 0 ? (
                                    <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                            <Video className="h-6 w-6 opacity-50" />
                                        </div>
                                        <p>Nessun video trovato in questo pacchetto.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {videos.map(video => (
                                            <div key={video.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors group">

                                                {/* Title Column */}
                                                <div className="col-span-6 md:col-span-6 flex items-center gap-4 pl-2">
                                                    <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm">
                                                        <PlayCircle className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                                                    </div>

                                                    {editingVideo === video.id ? (
                                                        <input
                                                            value={editForm.title}
                                                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-medium text-sm text-foreground/90 break-words" title={video.title}>
                                                                {video.title}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Package Column */}
                                                <div className="col-span-4 md:col-span-4 flex items-center">
                                                    {editingVideo === video.id ? (
                                                        <select
                                                            value={editForm.packageId}
                                                            onChange={(e) => setEditForm({ ...editForm, packageId: e.target.value })}
                                                            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-ring shadow-sm"
                                                        >
                                                            {packages.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 break-words whitespace-normal text-center leading-tight">
                                                            {video.packages?.name || 'Nessun Pacchetto'}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actions Column */}
                                                <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-2 pr-2">
                                                    {editingVideo === video.id ? (
                                                        <>
                                                            <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8 text-neutral-500 hover:text-neutral-700">
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" onClick={() => handleUpdate(video.id)} className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm">
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <Button size="icon" variant="ghost" onClick={() => startEdit(video)} className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 rounded-md">
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(video.id)} className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-md">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
