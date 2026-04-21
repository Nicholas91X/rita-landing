'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, Megaphone, Loader2, Info, Users, Layers, Package as PackageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import {
    sendBroadcast,
    countBroadcastRecipients,
    getBroadcastTargets,
} from '@/app/actions/admin_actions/broadcasts'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { logger } from '@/lib/logger'

type TargetType = 'all' | 'package' | 'level'
type Channels = { inApp: boolean; push: boolean; email: boolean }
type TargetOption = { id: string; name: string }

export default function AdminBroadcasts() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [url, setUrl] = useState('/dashboard')
    const [targetType, setTargetType] = useState<TargetType>('all')
    const [targetId, setTargetId] = useState<string | undefined>(undefined)
    const [channels, setChannels] = useState<Channels>({ inApp: true, push: true, email: false })
    const [loading, setLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [counts, setCounts] = useState<{ total: number; withPush: number } | null>(null)
    const [levels, setLevels] = useState<TargetOption[]>([])
    const [packages, setPackages] = useState<TargetOption[]>([])

    // Load targeting options on mount
    useEffect(() => {
        getBroadcastTargets().then(({ levels: lv, packages: pk }) => {
            setLevels(lv)
            setPackages(pk)
        })
    }, [])

    // Live recipient count (debounced)
    useEffect(() => {
        if (targetType !== 'all' && !targetId) { setCounts(null); return }
        const t = setTimeout(async () => {
            const r = await countBroadcastRecipients({ targetType, targetId })
            setCounts(r)
        }, 300)
        return () => clearTimeout(t)
    }, [targetType, targetId])

    // Reset targetId when switching away from level/package
    useEffect(() => {
        if (targetType === 'all') setTargetId(undefined)
    }, [targetType])

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            toast.error('Inserisci titolo e messaggio')
            return
        }
        if (targetType !== 'all' && !targetId) {
            toast.error('Seleziona un livello o pacchetto')
            return
        }
        if (!channels.inApp && !channels.push) {
            toast.error('Abilita almeno un canale')
            return
        }
        setShowConfirm(true)
    }

    const confirmSend = async () => {
        setShowConfirm(false)
        setLoading(true)
        try {
            const result = await sendBroadcast({
                title, body: message, url, targetType, targetId, channels,
            })
            if (result.ok) {
                const { recipients, inApp, pushSent, pushSkipped, pushFailed } = result.data
                const pushTotal = pushSent + pushSkipped + pushFailed
                toast.success(
                    `Inviato a ${recipients} utenti` +
                    (channels.inApp ? ` · in-app ${inApp}` : '') +
                    (channels.push ? ` · push ${pushSent}/${pushTotal}` : '')
                )
                setTitle('')
                setMessage('')
            } else {
                toast.error(result.message)
                if (result.retryAfter) toast.error(`Riprova tra ${result.retryAfter}s`)
            }
        } catch (error) {
            logger.error('Broadcast error:', error)
            toast.error("Errore durante l'invio della notifica")
        } finally {
            setLoading(false)
        }
    }

    const targetOptions = targetType === 'level' ? levels : targetType === 'package' ? packages : []

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left: Form */}
                <div className="lg:col-span-7">
                    <Card className="bg-neutral-900 border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent opacity-50" />
                        <CardHeader className="space-y-1 p-8 pb-4">
                            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                                <Megaphone className="h-6 w-6 text-brand drop-shadow-[0_0_8px_rgba(244,101,48,0.4)]" />
                                Invia Broadcast
                            </CardTitle>
                            <CardDescription className="text-xs font-bold text-neutral-300 uppercase tracking-widest">
                                Messaggi di sistema per tutti gli utenti
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 pt-4 space-y-6">
                            {/* Target type radios */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Destinatari</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <TargetButton
                                        active={targetType === 'all'} icon={<Users className="w-5 h-5" />}
                                        label="Tutti" onClick={() => setTargetType('all')}
                                    />
                                    <TargetButton
                                        active={targetType === 'level'} icon={<Layers className="w-5 h-5" />}
                                        label="Livello" onClick={() => setTargetType('level')}
                                    />
                                    <TargetButton
                                        active={targetType === 'package'} icon={<PackageIcon className="w-5 h-5" />}
                                        label="Pacchetto" onClick={() => setTargetType('package')}
                                    />
                                </div>
                            </div>

                            {/* Target dropdown when package/level */}
                            {targetType !== 'all' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">
                                        {targetType === 'level' ? 'Seleziona livello' : 'Seleziona pacchetto'}
                                    </label>
                                    <select
                                        value={targetId ?? ''}
                                        onChange={(e) => setTargetId(e.target.value || undefined)}
                                        className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 text-sm text-white focus:outline-none focus:border-brand/40 transition-colors font-medium"
                                    >
                                        <option value="">— Seleziona —</option>
                                        {targetOptions.map((o) => (
                                            <option key={o.id} value={o.id} className="bg-neutral-900">{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Recipient counter */}
                            {counts && (
                                <div className="text-xs text-neutral-400 bg-white/5 rounded-xl px-4 py-2 border border-white/10">
                                    <span className="text-white font-bold">{counts.total}</span> utenti
                                    {channels.push && <> · <span className="text-white font-bold">{counts.withPush}</span> con push attive</>}
                                </div>
                            )}

                            {/* Channels */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Canali</label>
                                <div className="flex flex-wrap gap-3">
                                    <ChannelToggle checked={channels.inApp} onChange={(v) => setChannels({ ...channels, inApp: v })} label="In-app" />
                                    <ChannelToggle checked={channels.push} onChange={(v) => setChannels({ ...channels, push: v })} label="Push" />
                                    <ChannelToggle checked={channels.email} onChange={() => {}} label="Email (presto)" disabled />
                                </div>
                            </div>

                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Titolo Notifica</label>
                                <input
                                    type="text"
                                    value={title}
                                    maxLength={50}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="es: Nuova Masterclass disponibile!"
                                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 text-sm text-white focus:outline-none focus:border-brand/40 transition-colors font-medium"
                                />
                                <div className="text-[10px] text-neutral-500 ml-1">{title.length}/50</div>
                            </div>

                            {/* Body */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Messaggio</label>
                                <textarea
                                    value={message}
                                    maxLength={150}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Scrivi qui il contenuto del messaggio..."
                                    rows={4}
                                    className="flex w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white focus:outline-none focus:border-brand/40 transition-colors font-medium resize-none"
                                />
                                <div className="text-[10px] text-neutral-500 ml-1">{message.length}/150</div>
                            </div>

                            {/* URL */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">URL al click</label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="/dashboard"
                                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-6 text-sm text-white focus:outline-none focus:border-brand/40 transition-colors font-medium"
                                />
                            </div>

                            <Button
                                onClick={handleSend}
                                disabled={loading || !title.trim() || !message.trim() || (targetType !== 'all' && !targetId)}
                                className="w-full h-16 bg-white hover:bg-white/90 text-black font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-white/5 gap-3 text-base"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Invio in corso...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-5 w-5" />
                                        Invia Notifica
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Info/Preview */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-neutral-900 border-white/10 rounded-[2rem] shadow-xl p-8 border-l-brand border-l-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-brand/10 rounded-2xl">
                                <Info className="h-6 w-6 text-brand" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-white font-black uppercase italic tracking-tighter">Informazioni</h4>
                                <ul className="text-xs text-neutral-400 space-y-3 font-medium leading-relaxed">
                                    <li className="flex gap-2">
                                        <span className="text-brand font-black">•</span>
                                        In-app: campanellino. Push: notifica nativa (solo chi ha dato il permesso).
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand font-black">•</span>
                                        Utenti con tab aperto negli ultimi 60s non ricevono push (per evitare spam).
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand font-black">•</span>
                                        Limite: 5 broadcast ogni ora per sicurezza.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Card>

                    {/* Fake Preview */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em] ml-1">Anteprima Notifica</h4>
                        <div className="bg-[#001F3D] rounded-2xl border border-white/10 p-4 shadow-2xl scale-95 origin-top-left opacity-80 pointer-events-none">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-brand/20 rounded-lg">
                                    <Megaphone className="w-4 h-4 text-brand" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-white uppercase truncate">{title || 'Titolo della Notifica'}</p>
                                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2 leading-snug">
                                        {message || 'Qui comparirà il contenuto del tuo messaggio broadcast inviato a Rita Workout.'}
                                    </p>
                                    <span className="text-[9px] text-neutral-600 font-bold mt-2 inline-block">ORA</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-[2rem] max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                            <Megaphone className="h-5 w-5 text-brand" />
                            Conferma Invio
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400 font-medium">
                            Stai per inviare a{' '}
                            <span className="text-white font-bold">{counts?.total ?? '?'} utenti</span>
                            {channels.push && counts && ` (${counts.withPush} con push attive)`}.
                            <br />
                            Canali: <span className="text-white font-bold">
                                {[channels.inApp && 'in-app', channels.push && 'push'].filter(Boolean).join(' + ') || 'nessuno'}
                            </span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                        <p className="text-[10px] font-black uppercase text-brand tracking-widest">Anteprima Titolo</p>
                        <p className="text-sm font-bold">{title}</p>
                    </div>
                    <DialogFooter className="flex gap-3 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setShowConfirm(false)}
                            className="flex-1 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={confirmSend}
                            className="flex-1 bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand/20"
                        >
                            Invia Ora
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function TargetButton({ active, icon, label, onClick }: {
    active: boolean
    icon: React.ReactNode
    label: string
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group ${active
                ? 'bg-brand/10 border-brand text-white shadow-[0_0_20px_rgba(244,101,48,0.1)]'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:bg-white/10'
                }`}
        >
            <span className={active ? 'text-brand' : 'opacity-40'}>{icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </button>
    )
}

function ChannelToggle({ checked, onChange, label, disabled }: {
    checked: boolean
    onChange: (v: boolean) => void
    label: string
    disabled?: boolean
}) {
    return (
        <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${disabled
            ? 'bg-white/5 border-white/5 text-neutral-600 cursor-not-allowed'
            : checked
                ? 'bg-brand/10 border-brand text-white cursor-pointer'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 cursor-pointer'
            }`}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 accent-brand"
            />
            <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                {label === 'Push' && <Bell className="h-3 w-3" />}
                {label}
            </span>
        </label>
    )
}
