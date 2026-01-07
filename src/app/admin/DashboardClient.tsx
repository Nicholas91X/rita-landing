'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBunnyVideo, saveVideoToDb, getAdminVideos, deleteVideo, updateVideo } from '@/app/actions/admin'
import AdminStats from './AdminStats'
import AdminPackages from './AdminPackages'
import AdminStripe from './AdminStripe'
import AdminRequests from './AdminRequests'
import { Button } from '@/components/ui/button'
import { Loader2, UploadCloud, CheckCircle, AlertCircle, Trash2, Edit2, Save, X, PlayCircle, Video, Package as PackageIcon, CreditCard, Bell } from 'lucide-react'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

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
    const [activeTab, setActiveTab] = useState<'content' | 'packages' | 'payments' | 'requests'>('content')

    // Video State
    const [title, setTitle] = useState('')
    const [selectedPackage, setSelectedPackage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<'idle' | 'creating' | 'uploading' | 'saving' | 'success' | 'error'>('idle')
    const [videos, setVideos] = useState<VideoRecord[]>([])
    const [loadingVideos, setLoadingVideos] = useState(true)
    const [filterPackage, setFilterPackage] = useState('')
    const [editingVideo, setEditingVideo] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ title: '', packageId: '' })

    const fetchVideos = useCallback(async () => {
        try {
            setLoadingVideos(true)
            const data = await getAdminVideos(filterPackage || undefined)
            setVideos(data as unknown as VideoRecord[])
        } catch (error) {
            console.error('Failed to fetch videos', error)
        } finally {
            setLoadingVideos(false)
        }
    }, [filterPackage])

    useEffect(() => {
        fetchVideos()
    }, [fetchVideos])

    const handleUpload = async () => {
        if (!title || !selectedPackage || !file) return
        try {
            setStatus('creating')
            const bunnyVideo = await createBunnyVideo(title)
            const videoId = bunnyVideo.guid
            setStatus('uploading')
            const proxyUrl = `/api/admin/bunny-proxy/${libraryId}/${videoId}`
            const uploadResponse = await fetch(proxyUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: file
            })
            if (!uploadResponse.ok) throw new Error('Upload failed')
            setStatus('saving')
            await saveVideoToDb({ title, bunnyId: videoId, packageId: selectedPackage })
            setStatus('success')
            setFile(null)
            setTitle('')
            fetchVideos()
        } catch (error) {
            console.error(error)
            setStatus('error')
        }
    }

    const handleDelete = async (videoId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo video?')) return
        try {
            await deleteVideo(videoId)
            setVideos(videos.filter(v => v.id !== videoId))
        } catch {
            alert('Errore durante l\'eliminazione')
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
            await updateVideo(videoId, { title: editForm.title, packageId: editForm.packageId })
            setEditingVideo(null)
            fetchVideos()
        } catch {
            alert('Errore durante l\'aggiornamento')
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {stats && (
                <Accordion type="multiple" defaultValue={["overview"]} className="mb-0">
                    <AccordionItem value="overview" className="border-none">
                        <AccordionTrigger className="hover:no-underline py-0 mb-4 focus-visible:ring-0">
                            <h2 className="text-lg font-semibold text-muted-foreground tracking-tight">Panoramica Attività</h2>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8">
                            <AdminStats stats={stats} />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}

            {/* TAB NAVIGATION - Premium Restructured Design (2x2 Grid with Cross Separator) */}
            <div className="flex justify-center mb-10 px-4">
                <div className="grid grid-cols-2 p-1 bg-neutral-900 border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden w-full max-w-md">
                    {/* Horizontal Divider */}
                    <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2" />
                    {/* Vertical Divider */}
                    <div className="absolute top-0 left-1/2 w-px h-full bg-white/10 -translate-x-1/2" />

                    <button
                        onClick={() => setActiveTab('content')}
                        className={`relative z-10 flex flex-col items-center justify-center py-8 transition-all duration-300 group ${activeTab === 'content' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {activeTab === 'content' && (
                            <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                        )}
                        <Video className={`w-7 h-7 mb-2 transition-all duration-500 ${activeTab === 'content' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Contenuti</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('packages')}
                        className={`relative z-10 flex flex-col items-center justify-center py-8 transition-all duration-300 group ${activeTab === 'packages' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {activeTab === 'packages' && (
                            <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                        )}
                        <PackageIcon className={`w-7 h-7 mb-2 transition-all duration-500 ${activeTab === 'packages' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Pacchetti</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`relative z-10 flex flex-col items-center justify-center py-8 transition-all duration-300 group ${activeTab === 'payments' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {activeTab === 'payments' && (
                            <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                        )}
                        <CreditCard className={`w-7 h-7 mb-2 transition-all duration-500 ${activeTab === 'payments' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Transazioni</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`relative z-10 flex flex-col items-center justify-center py-8 transition-all duration-300 group ${activeTab === 'requests' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {activeTab === 'requests' && (
                            <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                        )}
                        <Bell className={`w-7 h-7 mb-2 transition-all duration-500 ${activeTab === 'requests' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Fatturazione</span>
                    </button>
                </div>
            </div>

            {activeTab === 'packages' ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <AdminPackages />
                </div>
            ) : activeTab === 'payments' ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <AdminStripe />
                </div>
            ) : activeTab === 'requests' ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <AdminRequests />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in slide-in-from-bottom-4 duration-500">
                    {/* LEFT COLUMN: UPLOAD */}
                    <div className="lg:col-span-4 lg:sticky lg:top-8">
                        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <UploadCloud className="h-5 w-5 text-primary" />
                                    Carica Video
                                </h3>
                                <p className="text-sm text-muted-foreground">Aggiungi una nuova lezione.</p>
                            </div>

                            {/* Status logic */}
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
                                    <div className="text-sm font-medium">Video pubblicato!</div>
                                </div>
                            ) : status === 'error' ? (
                                <div className="p-4 bg-red-500/10 text-red-600 rounded-lg flex items-center gap-3 border border-red-500/20">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <div className="text-sm font-medium">Errore durante l&apos;upload.</div>
                                </div>
                            ) : null}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground">Titolo</label>
                                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo lezione" className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground">Pacchetto</label>
                                    <select value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm">
                                        <option value="" disabled>Seleziona pacchetto</option>
                                        {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground">Media</label>
                                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                                        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                        {file ? <div className="text-primary font-semibold flex flex-col items-center gap-2"><Video className="h-8 w-8" /><span className="text-sm truncate w-full">{file.name}</span></div> : <div className="text-muted-foreground flex flex-col items-center gap-2"><UploadCloud className="h-8 w-8" /><p className="text-sm">Seleziona video</p></div>}
                                    </div>
                                </div>
                                <Button onClick={handleUpload} disabled={!title || !selectedPackage || !file || (status !== 'idle' && status !== 'success' && status !== 'error')} className="w-full h-11">
                                    {status === 'uploading' ? 'Caricamento...' : 'Pubblica Video'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: LIST */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
                            <div>
                                <h2 className="text-xl font-bold">Libreria Contenuti</h2>
                                <p className="text-sm text-muted-foreground">{videos.length} video caricati</p>
                            </div>
                            <select value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)} className="flex h-10 w-full md:w-[220px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                                <option value="">Tutti i Pacchetti</option>
                                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="bg-card rounded-xl border shadow-sm overflow-hidden min-h-[400px]">
                            <div className="overflow-x-auto">
                                <div className="min-w-[900px]">
                                    <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-6 py-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        <div className="col-span-6">Video</div>
                                        <div className="col-span-4">Pacchetto</div>
                                        <div className="col-span-2 text-right">Azioni</div>
                                    </div>

                                    {loadingVideos ? (
                                        <div className="p-20 flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-sm">Caricamento...</span></div>
                                    ) : (
                                        <div className="divide-y divide-border/50">
                                            {videos.map(video => (
                                                <div key={video.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors">
                                                    <div className="col-span-6 flex items-center gap-4">
                                                        <PlayCircle className="h-5 w-5 text-muted-foreground" />
                                                        {editingVideo === video.id ? (
                                                            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm" autoFocus />
                                                        ) : (
                                                            <span className="font-medium text-sm truncate">{video.title}</span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-4 capitalize text-sm">
                                                        {editingVideo === video.id ? (
                                                            <select value={editForm.packageId} onChange={(e) => setEditForm({ ...editForm, packageId: e.target.value })} className="flex h-9 w-full rounded-md border bg-background px-2 text-sm">
                                                                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                            </select>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">{video.packages?.name}</span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-2 flex justify-end gap-2">
                                                        {editingVideo === video.id ? (
                                                            <>
                                                                <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                                                                <Button size="icon" onClick={() => handleUpdate(video.id)} className="h-8 w-8 bg-green-600 text-white"><Save className="h-4 w-4" /></Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="icon" variant="ghost" onClick={() => startEdit(video)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                                                                <Button size="icon" variant="ghost" onClick={() => handleDelete(video.id)} className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button>
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
                    </div>
                </div>
            )}
        </div>
    )
}
