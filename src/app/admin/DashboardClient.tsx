'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBunnyVideo, saveVideoToDb, getAdminVideos, deleteVideo, updateVideo } from '@/app/actions/admin_actions/videos'
import AdminStats from './AdminStats'
import AdminPackages from './AdminPackages'
import AdminStripe from './AdminStripe'
import AdminRequests from './AdminRequests'
import AdminUsers from './AdminUsers'
import OneToOneClients from './OneToOneClients'
import AdminBroadcasts from './AdminBroadcasts'
import { Button } from '@/components/ui/button'
import { Loader2, UploadCloud, CheckCircle, Trash2, Edit2, Save, X, PlayCircle, Video, Package as PackageIcon, CreditCard, Bell, Users, LayoutGrid, List, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
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
    tappa: string | null
    video_type: string | null
    duration_minutes: number | null
    order_index: number
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
    const [activeTab, setActiveTab] = useState<'library' | 'packages' | 'payments' | 'requests' | 'users' | 'one-to-one' | 'broadcast'>('library')

    // Video State
    const [title, setTitle] = useState('')
    const [tappa, setTappa] = useState('')
    const [videoType, setVideoType] = useState('pilates')
    const [duration, setDuration] = useState('31')
    const [selectedPackage, setSelectedPackage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<'idle' | 'creating' | 'uploading' | 'saving' | 'success' | 'error'>('idle')
    const [videos, setVideos] = useState<VideoRecord[]>([])
    const [loadingVideos, setLoadingVideos] = useState(true)
    const [filterPackage, setFilterPackage] = useState('')
    const [viewMode, setViewMode] = useState<'list' | 'weeks'>('list')
    const [editingVideo, setEditingVideo] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({
        title: '',
        packageId: '',
        tappa: '',
        videoType: '',
        duration: '',
        orderIndex: 0
    })

    const fetchVideos = useCallback(async () => {
        try {
            setLoadingVideos(true)
            const data = await getAdminVideos(filterPackage || undefined)
            setVideos(data as unknown as VideoRecord[])
        } catch (error) {
            logger.error('Failed to fetch videos', error)
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
            await saveVideoToDb({
                title,
                bunnyId: videoId,
                packageId: selectedPackage,
                tappa: tappa || undefined,
                videoType: videoType || undefined,
                duration: parseInt(duration) || undefined
            })
            setStatus('success')
            fetchVideos()
            setFile(null)
            setTitle('')
            setTappa('')
        } catch (error) {
            logger.error('Upload error:', error)
            setStatus('error')
        }
    }

    const handleDelete = async (videoId: string) => {
        if (!confirm('Sei sicuro?')) return
        try {
            await deleteVideo(videoId)
            fetchVideos()
        } catch (error) {
            logger.error('Delete video error:', error)
        }
    }

    const startEdit = (video: VideoRecord) => {
        setEditingVideo(video.id)
        setEditForm({
            title: video.title,
            packageId: video.package_id,
            tappa: video.tappa || '',
            videoType: video.video_type || 'pilates',
            duration: video.duration_minutes?.toString() || '30',
            orderIndex: video.order_index
        })
    }

    const cancelEdit = () => {
        setEditingVideo(null)
    }

    const handleUpdate = async (videoId: string) => {
        try {
            await updateVideo(videoId, {
                title: editForm.title,
                packageId: editForm.packageId,
                tappa: editForm.tappa || undefined,
                videoType: editForm.videoType || undefined,
                duration: parseInt(editForm.duration) || undefined,
                orderIndex: editForm.orderIndex
            })
            setEditingVideo(null)
            fetchVideos()
        } catch (error) {
            logger.error('Update video error:', error)
        }
    }

    return (
        <div className="min-h-screen bg-black font-inter selection:bg-[var(--brand)]/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-20">
                <div className="flex flex-col items-center gap-12 md:gap-16">
                    {stats && (
                        <Accordion type="multiple" defaultValue={["overview"]} className="w-full mb-0">
                            <AccordionItem value="overview" className="border-none">
                                <AccordionTrigger className="hover:no-underline py-0 mb-4 focus-visible:ring-0">
                                    <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">Panoramica Attività</h2>
                                </AccordionTrigger>
                                <AccordionContent className="pb-8">
                                    <AdminStats stats={stats} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )}

                    {/* TAB NAVIGATION */}
                    <div className="grid grid-cols-2 md:grid-cols-3 p-1 bg-neutral-900 border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden w-full max-w-4xl">
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'library' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'library' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <Video className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'library' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Contenuti</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('packages')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'packages' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'packages' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <PackageIcon className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'packages' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Pacchetti</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'payments' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'payments' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <CreditCard className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'payments' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Transazioni</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'requests' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'requests' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <Bell className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'requests' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Fatturazione</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('one-to-one')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'one-to-one' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'one-to-one' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <Users className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'one-to-one' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Clienti 1:1</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('users')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'users' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'users' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <Users className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'users' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Utenti</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('broadcast')}
                            className={`relative z-10 flex flex-col items-center justify-center py-6 transition-all duration-300 group ${activeTab === 'broadcast' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {activeTab === 'broadcast' && (
                                <div className="absolute inset-2 bg-white/10 rounded-3xl z-[-1] animate-in fade-in zoom-in-95 duration-300" />
                            )}
                            <Megaphone className={`w-5 h-5 mb-2 transition-all duration-500 ${activeTab === 'broadcast' ? 'text-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Broadcast</span>
                        </button>
                    </div>

                    {activeTab === 'packages' ? (
                        <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                            <AdminPackages />
                        </div>
                    ) : activeTab === 'payments' ? (
                        <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                            <AdminStripe />
                        </div>
                    ) : activeTab === 'requests' ? (
                        <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                            <AdminRequests />
                        </div>
                    ) : activeTab === 'users' ? (
                        <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                            <AdminUsers />
                        </div>
                    ) : activeTab === 'one-to-one' ? (
                        <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                            <OneToOneClients />
                        </div>
                    ) : activeTab === 'broadcast' ? (
                        <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                            <AdminBroadcasts />
                        </div>
                    ) : (
                        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in slide-in-from-bottom-4 duration-500">
                            {/* LEFT COLUMN: UPLOAD */}
                            <div className="lg:col-span-4 lg:sticky lg:top-8">
                                <div className="bg-neutral-900 border border-white/10 rounded-[2rem] shadow-2xl p-8 space-y-8 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-50" />
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                                            <UploadCloud className="h-6 w-6 text-[var(--brand)] drop-shadow-[0_0_8px_rgba(244,101,48,0.4)]" />
                                            Carica Video
                                        </h3>
                                        <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest px-1">Aggiungi una nuova lezione</p>
                                    </div>

                                    {status === 'creating' || status === 'uploading' || status === 'saving' ? (
                                        <div className="p-6 bg-[var(--brand)]/5 rounded-2xl border border-[var(--brand)]/20 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
                                            <Loader2 className="h-10 w-10 text-[var(--brand)] animate-spin" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand)]">
                                                {status.toUpperCase()}...
                                            </p>
                                        </div>
                                    ) : status === 'success' ? (
                                        <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center gap-3 border border-emerald-500/20">
                                            <CheckCircle className="h-5 w-5 shrink-0" />
                                            <div className="text-[10px] font-black uppercase tracking-widest">Video pubblicato!</div>
                                        </div>
                                    ) : null}

                                    <div className="space-y-6">
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Titolo Lezione</label>
                                            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo" className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none" />
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Tappa</label>
                                            <input value={tappa} onChange={(e) => setTappa(e.target.value)} placeholder="Tappa" className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 group">
                                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Tipo</label>
                                                <select value={videoType} onChange={(e) => setVideoType(e.target.value)} className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none">
                                                    <option value="pilates" className="bg-neutral-900 text-white">Pilates</option>
                                                    <option value="total_body" className="bg-neutral-900 text-white">Total Body</option>
                                                    <option value="salsa" className="bg-neutral-900 text-white">Salsa</option>
                                                    <option value="bachata" className="bg-neutral-900 text-white">Bachata</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2 group">
                                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Durata</label>
                                                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none" />
                                            </div>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Pacchetto</label>
                                            <select value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)} className="flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none">
                                                <option value="" disabled className="bg-neutral-900 text-white">Seleziona...</option>
                                                {packages.map(p => <option key={p.id} value={p.id} className="bg-neutral-900 text-white">{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">File Video</label>
                                            <div className="border-2 border-dashed border-white/5 rounded-[2rem] p-10 text-center relative group hover:border-[var(--brand)]/30 transition-all cursor-pointer">
                                                <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                                {file ? <span className="text-xs text-[var(--brand)] font-black uppercase">{file.name}</span> : <UploadCloud className="h-10 w-10 mx-auto text-neutral-500" />}
                                            </div>
                                        </div>
                                        <Button onClick={handleUpload} disabled={!title || !selectedPackage || !file} className="w-full h-14 bg-[var(--brand)] text-white font-black uppercase tracking-widest rounded-2xl transition-all">Pubblica Video</Button>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: LIST */}
                            <div className="lg:col-span-8 space-y-6">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-neutral-900 p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
                                    <div className="absolute left-0 top-1/4 w-1 h-1/2 bg-[var(--brand)] rounded-r-full" />
                                    <div className="px-2 md:px-0">
                                        <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white">Libreria Contenuti</h2>
                                        <p className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">{videos.length} video caricati</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto px-2 md:px-0">
                                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
                                            <button onClick={() => setViewMode('list')} className={cn("px-3 md:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'list' ? "bg-[var(--brand)] text-white" : "text-neutral-500 hover:text-white")}><List className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => setViewMode('weeks')} className={cn("px-3 md:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'weeks' ? "bg-[var(--brand)] text-white" : "text-neutral-500 hover:text-white")}><LayoutGrid className="h-3.5 w-3.5" /></button>
                                        </div>
                                        <div className="relative flex-1 md:flex-none min-w-[140px]">
                                            <select value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)} className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-[10px] font-black uppercase text-neutral-400 focus:outline-none focus:text-white appearance-none">
                                                <option value="" className="bg-neutral-900 text-white">Tutti</option>
                                                {packages.map(p => <option key={p.id} value={p.id} className="bg-neutral-900 text-white">{p.name}</option>)}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                                <List className="h-3 w-3" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-900 rounded-3xl md:rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden relative min-h-[400px]">
                                    {loadingVideos ? (
                                        <div className="p-32 flex flex-col items-center gap-4 text-white">
                                            <Loader2 className="h-10 w-10 animate-spin text-[var(--brand)]" />
                                            <span className="text-[10px] font-black uppercase">Caricamento...</span>
                                        </div>
                                    ) : videos.length === 0 ? (
                                        <div className="p-32 text-center text-white/5">
                                            <Video className="w-16 h-16 mx-auto mb-4" />
                                            <p className="text-[10px] font-black uppercase">Nessun video</p>
                                        </div>
                                    ) : viewMode === 'weeks' ? (
                                        <div className="p-4 md:p-8 space-y-12">
                                            {Array.from(new Set(videos.map(v => v.package_id))).map(pkgId => {
                                                const pkgName = videos.find(v => v.package_id === pkgId)?.packages?.name
                                                const pkgVideos = videos.filter(v => v.package_id === pkgId).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                                return (
                                                    <div key={pkgId} className="space-y-6">
                                                        <h3 className="text-sm font-black text-[var(--brand)] uppercase tracking-[0.3em] border-b border-white/5 pb-2">{pkgName}</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                            {[1, 2, 3, 4].map(week => {
                                                                const weekVideos = pkgVideos.filter(v => {
                                                                    const idx = v.order_index
                                                                    if (week === 1) return idx >= 1 && idx <= 3
                                                                    if (week === 2) return idx >= 4 && idx <= 6
                                                                    if (week === 3) return idx >= 7 && idx <= 9
                                                                    if (week === 4) return idx >= 10 && idx <= 12
                                                                    return false
                                                                })
                                                                return (
                                                                    <div key={week} className="bg-white/5 rounded-3xl p-5 border border-white/5 space-y-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Settimana {week}</span>
                                                                            <span className="text-[10px] font-black text-[var(--brand)]">{weekVideos.length}/3</span>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {weekVideos.map(v => (
                                                                                <div key={v.id} className="p-2.5 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-1">
                                                                                    <div className="flex items-center justify-between text-[10px] font-black">
                                                                                        <span className="text-white truncate">{v.tappa}</span>
                                                                                        <span className="text-[var(--brand)]">#{v.order_index}</span>
                                                                                    </div>
                                                                                    <span className="text-[9px] text-neutral-500 truncate">{v.title}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/5">
                                            <div className="hidden lg:block overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                                <div className="min-w-[1000px]">
                                                    <div className="grid grid-cols-12 gap-4 border-b border-white/5 bg-white/5 px-8 py-5 text-[10px] font-black uppercase text-white/50">
                                                        <div className="col-span-1">#</div>
                                                        <div className="col-span-4">Titolo / Tappa</div>
                                                        <div className="col-span-1">Tipo</div>
                                                        <div className="col-span-1">Durata</div>
                                                        <div className="col-span-4">Pacchetto</div>
                                                        <div className="col-span-1 text-right">Azioni</div>
                                                    </div>
                                                    {videos.map(video => (
                                                        <div key={video.id} className="grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-white/[0.02]">
                                                            <div className="col-span-1 text-[var(--brand)] font-black text-xs">#{video.order_index}</div>
                                                            <div className="col-span-4 min-w-0">
                                                                <p className="font-black text-xs text-white truncate">{video.title}</p>
                                                                <p className="text-[9px] font-bold text-[var(--brand)] uppercase">{video.tappa}</p>
                                                            </div>
                                                            <div className="col-span-1 text-[10px] text-white/40 uppercase">{video.video_type?.slice(0, 3)}</div>
                                                            <div className="col-span-1 text-[10px] text-white font-black">{video.duration_minutes}m</div>
                                                            <div className="col-span-4">
                                                                <span className="px-2 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase text-white/50">{video.packages?.name}</span>
                                                            </div>
                                                            <div className="col-span-1 flex justify-end gap-2">
                                                                <Button size="icon" variant="ghost" onClick={() => startEdit(video)} className="h-8 w-8 text-neutral-500 hover:text-[var(--brand)]"><Edit2 className="h-3.5 w-3.5" /></Button>
                                                                <Button size="icon" variant="ghost" onClick={() => handleDelete(video.id)} className="h-8 w-8 text-neutral-500 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="lg:hidden divide-y divide-white/5 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                                <div className="min-w-full">
                                                    {videos.map(video => (
                                                        <div key={video.id} className="p-4 space-y-3">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[9px] font-black text-[var(--brand)]">#{video.order_index}</span>
                                                                        <span className="text-[9px] font-bold text-white/30 uppercase">{video.video_type}</span>
                                                                    </div>
                                                                    <h4 className="font-black text-base text-white tracking-tight leading-snug pr-2 break-words">{video.title}</h4>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        {video.tappa && (
                                                                            <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-wider">{video.tappa}</span>
                                                                        )}
                                                                        {video.tappa && video.duration_minutes && (
                                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                                        )}
                                                                        {video.duration_minutes && (
                                                                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{video.duration_minutes}m</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1 shrink-0 self-start">
                                                                    <Button size="icon" variant="ghost" onClick={() => startEdit(video)} className="h-8 w-8"><Edit2 className="h-3.5 w-3.5" /></Button>
                                                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(video.id)} className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
