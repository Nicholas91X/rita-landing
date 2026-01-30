'use client'

import { useState } from 'react'
import { Bell, Send, Users, Megaphone, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { sendBroadcastNotification } from '@/app/actions/admin_actions/users'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { logger } from '@/lib/logger'

export default function AdminBroadcasts() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [audience, setAudience] = useState<'all' | 'subscribers' | 'one-time'>('all')
    const [loading, setLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            toast.error('Inserisci titolo e messaggio')
            return
        }
        setShowConfirm(true)
    }

    const confirmSend = async () => {
        setShowConfirm(false)

        setLoading(true)
        try {
            const result = await sendBroadcastNotification(title, message, audience)
            if (result.success) {
                toast.success(`Notifica inviata con successo a ${result.count} utenti!`)
                setTitle('')
                setMessage('')
            } else {
                toast.error('Errore durante l\'invio della notifica')
            }
        } catch (error) {
            logger.error('Broadcast error:', error)
            toast.error('Errore durante l\'invio della notifica')
        } finally {
            setLoading(false)
        }
    }

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
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Destinatari</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <button
                                            onClick={() => setAudience('all')}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group ${audience === 'all'
                                                ? 'bg-brand/10 border-brand text-white shadow-[0_0_20px_rgba(244,101,48,0.1)]'
                                                : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:bg-white/10'
                                                }`}
                                        >
                                            <Users className={`w-5 h-5 ${audience === 'all' ? 'text-brand' : 'opacity-40'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Tutti</span>
                                        </button>
                                        <button
                                            onClick={() => setAudience('subscribers')}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group ${audience === 'subscribers'
                                                ? 'bg-brand/10 border-brand text-white shadow-[0_0_20px_rgba(244,101,48,0.1)]'
                                                : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:bg-white/10'
                                                }`}
                                        >
                                            <Bell className={`w-5 h-5 ${audience === 'subscribers' ? 'text-brand' : 'opacity-40'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Abbonati</span>
                                        </button>
                                        <button
                                            onClick={() => setAudience('one-time')}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group ${audience === 'one-time'
                                                ? 'bg-brand/10 border-brand text-white shadow-[0_0_20px_rgba(244,101,48,0.1)]'
                                                : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20 hover:bg-white/10'
                                                }`}
                                        >
                                            <Send className={`w-5 h-5 ${audience === 'one-time' ? 'text-brand' : 'opacity-40'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Single</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Titolo Notifica</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="es: Nuova Masterclass disponibile!"
                                        className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 text-sm text-white focus:outline-none focus:border-brand/40 transition-colors font-medium"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-neutral-300 tracking-widest ml-1">Messaggio</label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Scrivi qui il contenuto del messaggio..."
                                        rows={5}
                                        className="flex w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white focus:outline-none focus:border-brand/40 transition-colors font-medium resize-none"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleSend}
                                disabled={loading || !title.trim() || !message.trim()}
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
                                        I messaggi verranno visualizzati istantaneamente dagli utenti nel loro campanellino delle notifiche.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand font-black">•</span>
                                        Usi questo strumento per annunci importanti, nuovi lanci o promemoria generali.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand font-black">•</span>
                                        L&apos;invio a grandi gruppi di utenti è automatizzato in background per garantire la stabilità del sistema.
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
                            Stai per inviare questa notifica a tutti gli utenti nel gruppo <span className="text-white font-bold uppercase tracking-widest">&quot;{audience === 'all' ? 'Tutti' : audience === 'subscribers' ? 'Abbonati' : 'Single'}&quot;</span>. Questa azione non può essere annullata.
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
