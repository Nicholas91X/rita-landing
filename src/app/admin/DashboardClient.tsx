'use client'

import { useState, useEffect } from 'react'
import { createBunnyVideo, saveVideoToDb, getAdminVideos, deleteVideo, updateVideo } from '@/app/actions/admin' // Added actions
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, UploadCloud, CheckCircle, AlertCircle, Trash2, Edit2, Save, X, PlayCircle } from 'lucide-react'

type Package = {
    id: string
    name: string
}

type Video = {
    id: string
    title: string
    bunny_video_id: string
    package_id: string
    packages: {
        name: string
    }
}

export default function AdminDashboardClient({ packages, libraryId }: { packages: Package[], libraryId?: string }) {
    // Upload State
    const [title, setTitle] = useState('')
    const [selectedPackage, setSelectedPackage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<'idle' | 'creating' | 'uploading' | 'saving' | 'success' | 'error'>('idle')

    // Management State
    const [videos, setVideos] = useState<Video[]>([])
    const [loadingVideos, setLoadingVideos] = useState(true)
    const [filterPackage, setFilterPackage] = useState('')
    const [editingVideo, setEditingVideo] = useState<string | null>(null) // Video ID being edited
    const [editForm, setEditForm] = useState({ title: '', packageId: '' })


    const fetchVideos = async () => {
        try {
            setLoadingVideos(true)
            const data = await getAdminVideos(filterPackage || undefined)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setVideos(data as any as Video[])
        } catch (error) {
            console.error('Failed to fetch videos', error)
        } finally {
            setLoadingVideos(false)
        }
    }

    // Initial fetch and on filter change
    useEffect(() => {
        fetchVideos()
    }, [filterPackage])

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

    const startEdit = (video: Video) => {
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
        <div className="space-y-12">
            {/* --- UPLOAD SECTION --- */}
            <Card className="max-w-xl mx-auto mt-8 relative overflow-hidden">
                {status === 'creating' || status === 'uploading' || status === 'saving' ? (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8">
                        <Loader2 className="h-12 w-12 text-[var(--brand)] animate-spin mb-4" />
                        <p className="text-xl font-semibold animate-pulse">
                            {status === 'creating' && 'Inizializzazione...'}
                            {status === 'uploading' && 'Caricamento su Bunny...'}
                            {status === 'saving' && 'Salvataggio nel Database...'}
                        </p>
                    </div>
                ) : null}

                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UploadCloud className="h-6 w-6" />
                        Carica Nuova Lezione
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status === 'success' && (
                        <div className="bg-green-100 text-green-700 p-4 rounded-xl flex items-center gap-2 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            Video caricato e salvato con successo!
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="bg-red-100 text-red-700 p-4 rounded-xl flex items-center gap-2 mb-4">
                            <AlertCircle className="h-5 w-5" />
                            Errore durante il caricamento. Riprova.
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Titolo Video
                        </label>
                        <input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Es. Lezione 1: Fondamentali"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="package" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Pacchetto
                        </label>
                        <select
                            id="package"
                            value={selectedPackage}
                            onChange={(e) => setSelectedPackage(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="" disabled>Seleziona un pacchetto</option>
                            {packages.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="file" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            File Video
                        </label>
                        <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:bg-[var(--panel)] transition-colors cursor-pointer relative">
                            <input
                                id="file"
                                type="file"
                                accept="video/*"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            {file ? (
                                <div className="text-[var(--brand)] font-semibold">
                                    {file.name}
                                </div>
                            ) : (
                                <div className="text-[var(--muted-foreground)]">
                                    <UploadCloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>Clicca o trascina il video qui</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        onClick={handleUpload}
                        disabled={!title || !selectedPackage || !file || status !== 'idle' && status !== 'success' && status !== 'error'}
                        className="w-full bg-[var(--brand)] text-white hover:opacity-90"
                    >
                        Avvia Upload
                    </Button>
                </CardContent>
            </Card>

            {/* --- MANAGEMENT SECTION --- */}
            <div className="max-w-4xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                    <h2 className="text-2xl font-bold">Gestione Contenuti</h2>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-sm font-medium whitespace-nowrap">Filtra per:</span>
                        <select
                            value={filterPackage}
                            onChange={(e) => setFilterPackage(e.target.value)}
                            className="flex h-9 w-full md:w-[250px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="">Tutti i Pacchetti</option>
                            {packages.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden">
                    {loadingVideos ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            Nessun video trovato.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {videos.map(video => (
                                <div key={video.id} className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4 hover:bg-[var(--panel)] transition-colors">
                                    <div className="h-10 w-10 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <PlayCircle className="h-5 w-5 text-zinc-400" />
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1">
                                        {editingVideo === video.id ? (
                                            <input
                                                value={editForm.title}
                                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            />
                                        ) : (
                                            <p className="font-medium truncate">{video.title}</p>
                                        )}

                                        {editingVideo === video.id ? (
                                            <select
                                                value={editForm.packageId}
                                                onChange={(e) => setEditForm({ ...editForm, packageId: e.target.value })}
                                                className="flex h-8 w-full md:w-[200px] rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                {packages.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                    {video.packages?.name || 'Nessun Pacchetto'}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 self-end md:self-center">
                                        {editingVideo === video.id ? (
                                            <>
                                                <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 w-8 p-0">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" onClick={() => handleUpdate(video.id)} className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white">
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button size="sm" variant="ghost" onClick={() => startEdit(video)} className="h-8 w-8 p-0 hover:bg-zinc-100">
                                                    <Edit2 className="h-4 w-4 text-zinc-500" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDelete(video.id)} className="h-8 w-8 p-0 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
