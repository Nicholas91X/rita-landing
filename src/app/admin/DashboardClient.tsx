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
                    {/* Orange Cross Separator */}
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--brand)]/80 to-transparent z-0 shadow-[0_0_10px_rgba(244,101,48,0.2)]" />
                    <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--brand)]/80 to-transparent z-0 shadow-[0_0_10px_rgba(244,101,48,0.2)]" />

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
                        <div className="bg-neutral-900 border border-white/10 rounded-[2rem] shadow-2xl p-8 space-y-8 relative overflow-hidden">
                            {/* Orange Accent Top Bar */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-50" />

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                                    <UploadCloud className="h-6 w-6 text-[var(--brand)] drop-shadow-[0_0_8px_rgba(244,101,48,0.4)]" />
                                    Carica Video
                                </h3>
                                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">Aggiungi una nuova lezione</p>
                            </div>

                            {/* Status logic */}
                            {status === 'creating' || status === 'uploading' || status === 'saving' ? (
                                <div className="p-6 bg-[var(--brand)]/5 rounded-2xl border border-[var(--brand)]/20 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
                                    <Loader2 className="h-10 w-10 text-[var(--brand)] animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand)]">
                                        {status === 'creating' && '1/3 Creazione record...'}
                                        {status === 'uploading' && '2/3 Upload su BunnyCDN...'}
                                        {status === 'saving' && '3/3 Salvataggio DB...'}
                                    </p>
                                </div>
                            ) : status === 'success' ? (
                                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center gap-3 border border-emerald-500/20">
                                    <CheckCircle className="h-5 w-5 shrink-0" />
                                    <div className="text-[10px] font-black uppercase tracking-widest">Video pubblicato!</div>
                                </div>
                            ) : status === 'error' ? (
                                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl flex items-center gap-3 border border-red-500/20">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <div className="text-[10px] font-black uppercase tracking-widest">Errore durante l&apos;upload</div>
                                </div>
                            ) : null}

                            <div className="space-y-6">
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest ml-1 group-focus-within:text-[var(--brand)] transition-colors">Titolo Lezione</label>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Esempio: Warm-up dinamico"
                                        className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]/50 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest ml-1 group-focus-within:text-[var(--brand)] transition-colors">Pacchetto di Destinazione</label>
                                    <select
                                        value={selectedPackage}
                                        onChange={(e) => setSelectedPackage(e.target.value)}
                                        className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]/50 transition-all appearance-none cursor-pointer font-medium"
                                    >
                                        <option value="" disabled className="bg-neutral-900 text-neutral-500">Scegli un pacchetto...</option>
                                        {packages.map(p => <option key={p.id} value={p.id} className="bg-neutral-900">{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest ml-1">File Video</label>
                                    <div className={`border-2 border-dashed rounded-[2rem] p-10 text-center transition-all cursor-pointer relative group ${file ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-white/5 hover:border-[var(--brand)]/30 hover:bg-[var(--brand)]/5'}`}>
                                        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                        {file ? (
                                            <div className="text-[var(--brand)] font-black flex flex-col items-center gap-3">
                                                <div className="w-14 h-14 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border border-[var(--brand)]/20 shadow-[0_0_20px_rgba(244,101,48,0.1)]">
                                                    <Video className="h-7 w-7" />
                                                </div>
                                                <span className="text-xs truncate w-full px-4 uppercase tracking-tight">{file.name}</span>
                                            </div>
                                        ) : (
                                            <div className="text-neutral-500 flex flex-col items-center gap-3 group-hover:text-neutral-300 transition-all">
                                                <UploadCloud className="h-12 w-12 text-neutral-600 group-hover:text-[var(--brand)] group-hover:drop-shadow-[0_0_8px_rgba(244,101,48,0.3)] transition-all" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Trascina o seleziona</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    onClick={handleUpload}
                                    disabled={!title || !selectedPackage || !file || (status !== 'idle' && status !== 'success' && status !== 'error')}
                                    className="w-full h-14 bg-[var(--brand)] hover:opacity-90 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_10px_20px_rgba(244,101,48,0.2)] hover:shadow-[0_12px_25px_rgba(244,101,48,0.3)] disabled:opacity-30 border-none"
                                >
                                    {status === 'uploading' ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Caricamento...
                                        </span>
                                    ) : 'Pubblica Video'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: LIST */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-neutral-900 p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
                            {/* Orange Accent Left Bar */}
                            <div className="absolute left-0 top-1/4 w-1 h-1/2 bg-[var(--brand)] rounded-r-full shadow-[0_0_10px_rgba(244,101,48,0.5)]" />

                            <div>
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
                                    Libreria Contenuti
                                </h2>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1 ml-4">{videos.length} video caricati con successo</p>
                            </div>
                            <div className="relative w-full md:w-auto">
                                <select
                                    value={filterPackage}
                                    onChange={(e) => setFilterPackage(e.target.value)}
                                    className="flex h-11 w-full md:w-[240px] rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-widest text-neutral-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 focus:border-[var(--brand)]/50 focus:text-white transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-neutral-900">Tutti i Pacchetti</option>
                                    {packages.map(p => <option key={p.id} value={p.id} className="bg-neutral-900">{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-neutral-900 rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden min-h-[500px] relative">
                            <div className="overflow-x-auto">
                                <div className="min-w-[900px]">
                                    <div className="grid grid-cols-12 gap-4 border-b border-white/5 bg-white/5 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                                        <div className="col-span-6">Scheda Video</div>
                                        <div className="col-span-4">Pacchetto Collegato</div>
                                        <div className="col-span-2 text-right">Azioni</div>
                                    </div>

                                    {loadingVideos ? (
                                        <div className="p-32 flex flex-col items-center gap-4 text-neutral-500">
                                            <Loader2 className="h-10 w-10 animate-spin text-[var(--brand)]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Sincronizzazione in corso...</span>
                                        </div>
                                    ) : videos.length === 0 ? (
                                        <div className="p-32 text-center space-y-4">
                                            <Video className="w-16 h-16 text-white/5 mx-auto" />
                                            <p className="text-neutral-500 text-sm font-medium">Nessun video trovato in questa categoria.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/5">
                                            {videos.map(video => (
                                                <div key={video.id} className="grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-white/[0.02] transition-colors group/row border-l-4 border-transparent hover:border-l-[var(--brand)]/50">
                                                    <div className="col-span-6 flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover/row:bg-[var(--brand)]/10 transition-all">
                                                            <PlayCircle className="h-6 w-6 text-neutral-600 group-hover/row:text-[var(--brand)] group-hover/row:scale-110 transition-all" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            {editingVideo === video.id ? (
                                                                <input
                                                                    value={editForm.title}
                                                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                                    className="flex h-10 w-full rounded-xl border border-[var(--brand)]/50 bg-white/10 px-4 text-sm text-white focus:outline-none"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <span className="font-black text-sm text-white tracking-tight group-hover/row:text-[var(--brand)] transition-colors">{video.title}</span>
                                                            )}
                                                            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mt-0.5">ID: {video.video_id?.slice(0, 8)}...</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-4">
                                                        {editingVideo === video.id ? (
                                                            <select
                                                                value={editForm.packageId}
                                                                onChange={(e) => setEditForm({ ...editForm, packageId: e.target.value })}
                                                                className="flex h-10 w-full rounded-xl border border-[var(--brand)]/50 bg-white/10 px-3 text-xs text-white focus:outline-none"
                                                            >
                                                                {packages.map(p => <option key={p.id} value={p.id} className="bg-neutral-900">{p.name}</option>)}
                                                            </select>
                                                        ) : (
                                                            <span className="px-3 py-1.5 rounded-full bg-[var(--brand)]/5 text-[var(--brand)] text-[9px] font-black uppercase tracking-widest border border-[var(--brand)]/10 group-hover/row:bg-[var(--brand)]/10 group-hover/row:border-[var(--brand)]/30 transition-all">
                                                                {video.packages?.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-2 flex justify-end gap-2">
                                                        {editingVideo === video.id ? (
                                                            <>
                                                                <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-10 w-10 rounded-xl hover:bg-white/5 text-neutral-500"><X className="h-5 w-5" /></Button>
                                                                <Button size="icon" onClick={() => handleUpdate(video.id)} className="h-10 w-10 bg-[var(--brand)] text-white rounded-xl shadow-lg shadow-[var(--brand)]/20 hover:scale-105 transition-transform"><Save className="h-5 w-5" /></Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="icon" variant="ghost" onClick={() => startEdit(video)} className="h-10 w-10 rounded-xl hover:bg-[var(--brand)]/10 text-neutral-500 hover:text-[var(--brand)] transition-all"><Edit2 className="h-4 w-4" /></Button>
                                                                <Button size="icon" variant="ghost" onClick={() => handleDelete(video.id)} className="h-10 w-10 rounded-xl hover:bg-red-500/10 text-neutral-600 hover:text-red-500 transition-all"><Trash2 className="h-4 w-4" /></Button>
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
