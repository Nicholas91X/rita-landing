'use client'

import { useState, useEffect } from 'react'
import { getUserSubscriptionInfo } from '@/app/actions/user'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { createPortalSession, cancelSubscription, requestRefund } from '@/app/actions/stripe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, ExternalLink, Calendar, CheckCircle2, Clock, Receipt, RefreshCcw, XCircle, AlertCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export default function BillingSection() {
    const [subscriptions, setSubscriptions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [portalLoading, setPortalLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Modals State
    const [refundDialog, setRefundDialog] = useState<{ open: boolean, subId: string | null }>({ open: false, subId: null })
    const [cancelDialog, setCancelDialog] = useState<{ open: boolean, subId: string | null }>({ open: false, subId: null })
    const [refundReason, setRefundReason] = useState('')
    const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)
    const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all')

    const filteredSubscriptions = subscriptions.filter(sub => {
        if (filter === 'all') return true;
        if (filter === 'active') return ['active', 'trialing'].includes(sub.status);
        if (filter === 'ended') return ['canceled', 'unpaid', 'refunded', 'past_due', 'incomplete_expired'].includes(sub.status);
        return true;
    });

    const fetchSubs = async () => {
        try {
            const data = await getUserSubscriptionInfo()
            setSubscriptions(data)
        } catch (error) {
            console.error('Failed to fetch subscriptions', error)
            toast.error('Errore nel caricamento dei dati di fatturazione')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSubs()

        const supabase = createClient()

        // Listen for changes in refund_requests
        const refundChannel = supabase
            .channel('user_refund_requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'refund_requests'
            }, () => {
                fetchSubs()
            })
            .subscribe()

        // Listen for changes in user_subscriptions (e.g. status changes)
        const subChannel = supabase
            .channel('user_subscriptions_sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_subscriptions'
            }, () => {
                fetchSubs()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(refundChannel)
            supabase.removeChannel(subChannel)
        }
    }, [])

    const handleManageBilling = async () => {
        try {
            setPortalLoading(true)
            const url = await createPortalSession()
            window.location.href = url
        } catch (error: any) {
            toast.error(error.message || 'Errore durante l\'apertura del portale')
        } finally {
            setPortalLoading(false)
        }
    }

    const handleCancelConfirm = async () => {
        if (!cancelDialog.subId) return
        try {
            setActionLoading(cancelDialog.subId)
            await cancelSubscription(cancelDialog.subId)
            toast.success('Rinnovo annullato con successo')
            setCancelDialog({ open: false, subId: null })
            fetchSubs()
        } catch (error: any) {
            toast.error(error.message || 'Errore durante l\'annullamento')
        } finally {
            setActionLoading(null)
        }
    }

    const handleRefundSubmit = async () => {
        if (!refundReason.trim()) return toast.error('Specifica una motivazione')
        try {
            setIsSubmittingRefund(true)
            await requestRefund(refundDialog.subId!, refundReason)
            toast.success('Richiesta di rimborso inviata correttamente')
            setRefundDialog({ open: false, subId: null })
            setRefundReason('')
        } catch (error: any) {
            toast.error(error.message || 'Errore durante la richiesta')
        } finally {
            setIsSubmittingRefund(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Caricamento dati di fatturazione...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Fatturazione</h2>
                    <p className="text-neutral-400 mt-1">Gestisci il tuo abbonamento e i tuoi pagamenti.</p>
                </div>
                <Button
                    onClick={handleManageBilling}
                    disabled={portalLoading || subscriptions.length === 0}
                    className="bg-white hover:bg-neutral-200 text-black font-bold h-12 px-6 rounded-2xl transition-all"
                >
                    {portalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <span className="flex items-center gap-2">
                            Gestisci su Stripe <ExternalLink className="w-4 h-4" />
                        </span>
                    )}
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 pb-4 border-b border-white/5">
                <Button
                    variant={filter === 'all' ? 'secondary' : 'ghost'}
                    onClick={() => setFilter('all')}
                    className="h-8 text-xs font-bold rounded-lg"
                >
                    Tutti
                </Button>
                <Button
                    variant={filter === 'active' ? 'secondary' : 'ghost'}
                    onClick={() => setFilter('active')}
                    className={cn(
                        "h-8 text-xs font-bold rounded-lg gap-2",
                        filter === 'active' && "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    )}
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Attivi
                </Button>
                <Button
                    variant={filter === 'ended' ? 'secondary' : 'ghost'}
                    onClick={() => setFilter('ended')}
                    className="h-8 text-xs font-bold rounded-lg text-neutral-400"
                >
                    Conclusi/Rimborsati
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSubscriptions.length > 0 ? filteredSubscriptions.map((sub: any) => (
                    <Card key={sub.id} className="bg-white/5 backdrop-blur-md border-white/5 shadow-2xl overflow-hidden group">
                        <div className={sub.status === 'active' ? 'h-1.5 w-full bg-emerald-500' : 'h-1.5 w-full bg-neutral-700'} />
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl font-bold text-white line-clamp-1">{sub.packages?.name}</CardTitle>
                                {sub.status === 'active' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20 uppercase">Attivo</span>
                                ) : sub.status === 'trialing' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20 uppercase">In Prova</span>
                                ) : sub.status === 'refunded' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20 uppercase">Rimborsato</span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-neutral-500/10 text-neutral-500 text-[10px] font-bold border border-neutral-500/20 uppercase">{sub.status}</span>
                                )}
                            </div>
                            <CardDescription className="text-neutral-400 text-xs mt-1 italic">
                                {sub.packages?.description || 'Nessuna descrizione disponibile'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 text-sm text-neutral-300">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                    <CreditCard className="w-4 h-4 text-brand" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Costo</span>
                                    <span className="font-mono">€ {sub.amount.toFixed(2)} / {sub.interval === 'month' ? 'mese' : sub.interval}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-neutral-300">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-brand" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
                                        {sub.status === 'active' ? 'Prossimo Rinnovo' : 'Usufruibile fino a'}
                                    </span>
                                    <span className="font-mono">{new Date(sub.next_invoice).toLocaleDateString('it-IT')}</span>
                                </div>
                            </div>

                            {sub.status === 'refunded' && sub.refund_requests?.[0]?.processed_at && (
                                <div className="flex items-center gap-3 text-sm text-neutral-300">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <RefreshCcw className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Data Rimborso</span>
                                        <span className="font-mono">{new Date(sub.refund_requests[0].processed_at).toLocaleDateString('it-IT')}</span>
                                    </div>
                                </div>
                            )}

                            {/* Documentation Section */}
                            {sub.documents && sub.documents.length > 0 && (
                                <div className="pt-4 mt-2 border-t border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Receipt className="w-3.5 h-3.5 text-brand" />
                                        <span className="text-[10px] uppercase font-black tracking-widest text-white">Documentazione</span>
                                    </div>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                        {sub.documents.map((doc: any) => (
                                            <div key={doc.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group/doc">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {doc.type === 'invoice' ? (
                                                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                                    ) : (
                                                        <RefreshCcw className="w-3.5 h-3.5 text-amber-500" />
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[9px] font-bold text-white truncate">
                                                            {doc.type === 'invoice' ? 'Fattura' : 'Nota di Credito'} {doc.number}
                                                        </span>
                                                        <span className="text-[8px] text-neutral-500">
                                                            {new Date(doc.date * 1000).toLocaleDateString('it-IT')} • €{doc.amount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-7 h-7 rounded-lg hover:bg-white/10"
                                                    onClick={() => window.open(doc.url, '_blank')}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover/doc:text-white" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-3">
                            <div className="hidden">
                                {sub.receipt_url && (
                                    <Button
                                        variant="link"
                                        className="p-0 h-auto text-[10px] text-brand hover:text-brand/80 flex items-center gap-1.5 self-start"
                                        onClick={() => window.open(sub.receipt_url, '_blank')}
                                    >
                                        <Receipt className="w-3 h-3" />
                                        Visualizza ultima ricevuta
                                    </Button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 w-full mt-2">
                                {sub.status === 'active' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-[10px] border-white/10 hover:bg-white/5 text-white gap-2 font-bold"
                                        onClick={() => setCancelDialog({ open: true, subId: sub.id })}
                                        disabled={actionLoading === sub.id}
                                    >
                                        {actionLoading === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                        Annulla
                                    </Button>
                                )}

                                {sub.refund_requests && sub.refund_requests.length > 0 ? (
                                    <div className="flex-1 flex flex-col gap-1">
                                        <div className={cn(
                                            "h-8 flex items-center justify-center gap-2 px-3 rounded-md border text-[9px] font-black uppercase tracking-tighter",
                                            sub.refund_requests[0].status === 'pending' ? "border-amber-500/20 bg-amber-500/5 text-amber-500" :
                                                sub.refund_requests[0].status === 'approved' ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500" :
                                                    "border-red-500/20 bg-red-500/5 text-red-500"
                                        )}>
                                            {sub.refund_requests[0].status === 'pending' ? <Clock className="w-3 h-3" /> :
                                                sub.refund_requests[0].status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
                                                    <XCircle className="w-3 h-3" />}
                                            {sub.refund_requests[0].status === 'pending' ? 'In attesa rimborso' :
                                                sub.refund_requests[0].status === 'approved' ? 'Rimborso approvato' :
                                                    'Rimborso rifiutato'}
                                        </div>
                                        {sub.refund_requests[0].processed_at && (
                                            <span className="text-[8px] text-neutral-500 uppercase font-bold text-center">
                                                Elaborata il {new Date(sub.refund_requests[0].processed_at).toLocaleDateString('it-IT')}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-[10px] border-brand/20 hover:bg-brand/5 text-brand gap-2 font-bold"
                                        onClick={() => setRefundDialog({ open: true, subId: sub.id })}
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5" />
                                        Rimborso
                                    </Button>
                                )}
                            </div>

                            <div className="w-full flex items-center gap-2 text-[8px] text-neutral-500 mt-2 uppercase tracking-widest font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/50" />
                                Transazione sicura Stripe
                            </div>
                        </CardFooter>
                    </Card>
                )) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                        <CreditCard className="w-16 h-16 text-brand/30 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Ancora nessun abbonamento</h3>
                        <p className="text-neutral-500 max-w-sm mx-auto font-medium">Inizia la tua trasformazione attivando uno dei nostri piani esclusivi dalla sezione Scopri.</p>
                    </div>
                )}
            </div>

            <div className="p-6 bg-brand/5 border border-brand/10 rounded-3xl flex items-start gap-4">
                <div className="p-3 bg-brand/10 rounded-2xl">
                    <Clock className="w-6 h-6 text-brand" />
                </div>
                <div>
                    <h4 className="font-bold text-white">Politica sui Rimborsi</h4>
                    <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
                        Le richieste di rimborso vengono elaborate manualmente entro 48 ore lavorative.
                        Assicurati di inserire una motivazione valida per facilitare l'operazione.
                        Ricorda che puoi annullare il rinnovo in qualsiasi momento cliccando su "Annulla" o tramite il portale Stripe.
                    </p>
                </div>
            </div>

            {/* Refund Modal */}
            <Dialog open={refundDialog.open} onOpenChange={(open) => !open && setRefundDialog({ open: false, subId: null })}>
                <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                            <RefreshCcw className="w-6 h-6 text-brand" />
                            Richiedi Rimborso
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Spiegaci il motivo della tua richiesta di rimborso. Verrai ricontattato via email.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest ml-1">Motivazione</label>
                            <Textarea
                                placeholder="Esempio: Errore nell'acquisto, duplicato, etc..."
                                className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl focus:ring-brand focus:border-brand"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                            <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-500/80 leading-relaxed font-medium">
                                Una volta inviata, la richiesta verrà esaminata dallo staff. Non è necessario inviare più richieste.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setRefundDialog({ open: false, subId: null })}
                            className="rounded-xl"
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={handleRefundSubmit}
                            disabled={isSubmittingRefund || !refundReason.trim()}
                            className="bg-brand hover:bg-brand/90 text-white font-bold rounded-xl px-8"
                        >
                            {isSubmittingRefund ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invia Richiesta'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancellation Confirmation Modal */}
            <Dialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, subId: null })}>
                <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-sm rounded-[2.5rem] p-8">
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-red-500" />
                        </div>

                        <div className="space-y-2">
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                                Conferma Annullamento
                            </DialogTitle>
                            <DialogDescription className="text-neutral-400 text-sm">
                                Sei sicuro di voler annullare il rinnovo automatico? Manterrai l'accesso fino alla scadenza del periodo attuale.
                            </DialogDescription>
                        </div>

                        <div className="flex flex-col w-full gap-3 pt-4">
                            <Button
                                onClick={handleCancelConfirm}
                                disabled={actionLoading === cancelDialog.subId}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-12 rounded-2xl"
                            >
                                {actionLoading === cancelDialog.subId ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sì, Annulla Rinnovo'}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setCancelDialog({ open: false, subId: null })}
                                className="w-full text-neutral-400 hover:text-white h-12 rounded-2xl"
                            >
                                No, Mantieni Attivo
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
