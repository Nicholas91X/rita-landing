'use client'

import { useState, useEffect } from 'react'
import { getUserSubscriptionInfo } from '@/app/actions/user'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { createPortalSession, cancelSubscription, requestRefund } from '@/app/actions/stripe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, ExternalLink, Calendar, CheckCircle2, Clock, Receipt, RefreshCcw, XCircle, AlertCircle, FileText, Package as PackageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface BillingDocument {
    id: string;
    type: 'invoice' | 'credit_note';
    number: string;
    date: number;
    amount: number;
    currency: string;
    url: string | null;
    status: string | null;
}

interface BillingSubscription {
    id: string;
    status: string;
    current_period_end: string;
    created_at: string;
    next_invoice: string;
    amount: number;
    interval: string;
    packages: {
        name: string;
        description: string;
        image_url: string | null;
        price: number;
    } | null;
    refund_requests: Array<{
        status: string;
        reason: string;
        created_at: string;
        processed_at: string | null;
    }>;
    documents: BillingDocument[];
    receipt_url?: string | null;
}

interface OneTimePurchase {
    id: string;
    status: string;
    created_at: string;
    amount: number;
    packages: {
        name: string;
        description: string;
        image_url: string | null;
        price: number;
    } | null;
    stripe_payment_intent_id: string;
}

export default function BillingSection() {
    const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([])
    const [oneTimePurchases, setOneTimePurchases] = useState<OneTimePurchase[]>([])
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
            if (data && 'subscriptions' in data) {
                setSubscriptions(data.subscriptions)
                setOneTimePurchases(data.oneTimePurchases)
            } else if (Array.isArray(data)) {
                setSubscriptions(data)
            }
        } catch (error: unknown) {
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore'
            toast.error(message)
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore'
            toast.error(message)
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore'
            toast.error(message)
        } finally {
            setIsSubmittingRefund(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-neutral-500 font-medium">
                <Loader2 className="w-8 h-8 animate-spin text-[#846047]" />
                <p>Caricamento dati di fatturazione...</p>
            </div>
        )
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-[#593e25] italic uppercase tracking-tighter">Fatturazione</h2>
                    <p className="text-neutral-500 mt-1 font-medium">Gestisci il tuo abbonamento e i tuoi pagamenti.</p>
                </div>
                <Button
                    onClick={handleManageBilling}
                    disabled={portalLoading || (subscriptions.length === 0 && oneTimePurchases.length === 0)}
                    className="bg-[#593e25] hover:bg-[#593e25]/90 text-white font-bold h-12 px-6 rounded-2xl transition-all shadow-xl"
                >
                    {portalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <span className="flex items-center gap-2">
                            Metodo di Pagamento <ExternalLink className="w-4 h-4" />
                        </span>
                    )}
                </Button>
            </div>

            {/* Subscriptions Section */}
            <div className="space-y-8">
                <div className="flex items-center justify-between border-b border-[#846047]/10 pb-4">
                    <h3 className="text-xl font-bold text-[#2a2e30]">Abbonamenti</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={filter === 'all' ? 'secondary' : 'ghost'}
                            onClick={() => setFilter('all')}
                            className="h-8 text-xs font-bold rounded-lg text-[#593e25]"
                        >
                            Tutti
                        </Button>
                        <Button
                            variant={filter === 'active' ? 'secondary' : 'ghost'}
                            onClick={() => setFilter('active')}
                            className={cn(
                                "h-8 text-xs font-bold rounded-lg gap-2",
                                filter === 'active' && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            )}
                        >
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Attivi
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSubscriptions.length > 0 ? filteredSubscriptions.map((sub) => {
                        const createdAt = new Date(sub.created_at).getTime();
                        const now = new Date().getTime();
                        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
                        const isRefundAllowed = diffDays <= 4 && sub.status !== 'trialing';

                        return (
                            <Card key={sub.id} className="bg-white border-[#846047]/20 shadow-xl overflow-hidden group rounded-[2rem]">
                                <div className="h-32 w-full relative overflow-hidden">
                                    {sub.packages?.image_url ? (
                                        <Image
                                            src={sub.packages.image_url}
                                            alt={sub.packages.name}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                            <PackageIcon className="w-10 h-10 text-neutral-300" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                    <div className={cn(
                                        "absolute top-0 left-0 w-full h-1.5",
                                        sub.status === 'active' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-neutral-300'
                                    )} />
                                </div>
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-black text-[#593e25] line-clamp-1 italic uppercase tracking-tight">{sub.packages?.name}</CardTitle>
                                        {sub.status === 'active' ? (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20 uppercase">Attivo</span>
                                        ) : sub.status === 'trialing' ? (
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold border border-blue-500/20 uppercase">In Prova</span>
                                        ) : sub.status === 'refunded' ? (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold border border-amber-500/20 uppercase">Rimborsato</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-bold border border-neutral-200 uppercase">{sub.status}</span>
                                        )}
                                    </div>
                                    <CardDescription className="text-neutral-500 text-xs mt-1 italic font-medium leading-tight">
                                        {sub.packages?.description || 'Nessuna descrizione disponibile'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                                        <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                                            <CreditCard className="w-4 h-4 text-[#846047]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">Costo</span>
                                            <span className="font-bold text-[#2a2e30]">€ {sub.amount.toFixed(2)} / {sub.interval === 'month' ? 'mese' : sub.interval}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                                        <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                                            <Calendar className="w-4 h-4 text-[#846047]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">
                                                {sub.status === 'active' ? 'Prossimo Rinnovo' : 'Fino a'}
                                            </span>
                                            <span className="font-bold text-[#2a2e30]">{new Date(sub.next_invoice).toLocaleDateString('it-IT')}</span>
                                        </div>
                                    </div>

                                    {sub.documents && sub.documents.length > 0 && (
                                        <div className="pt-4 mt-2 border-t border-neutral-100 space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Receipt className="w-3.5 h-3.5 text-[#846047]" />
                                                <span className="text-[10px] uppercase font-black tracking-widest text-[#593e25]">Documenti Scaricabili</span>
                                            </div>
                                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                                {sub.documents.map((doc) => (
                                                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-neutral-50 border border-neutral-100 hover:bg-neutral-100 transition-colors group/doc">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {doc.type === 'invoice' ? (
                                                                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                                            ) : (
                                                                <RefreshCcw className="w-3.5 h-3.5 text-amber-600" />
                                                            )}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[9px] font-black text-[#2a2e30] truncate uppercase tracking-tight">
                                                                    {doc.type === 'invoice' ? 'Fattura' : 'Nota Credito'}
                                                                </span>
                                                                <span className="text-[8px] text-neutral-500 font-bold">
                                                                    {new Date(doc.date * 1000).toLocaleDateString('it-IT')} • €{doc.amount.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="w-8 h-8 rounded-xl hover:bg-white hover:shadow-sm"
                                                            onClick={() => window.open(doc.url || undefined, '_blank')}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover/doc:text-[#593e25]" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 w-full mt-2">
                                        {['active', 'trialing'].includes(sub.status) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-10 text-[10px] border-neutral-200 hover:bg-neutral-50 text-[#593e25] gap-2 font-black uppercase tracking-widest rounded-2xl"
                                                onClick={() => setCancelDialog({ open: true, subId: sub.id })}
                                                disabled={actionLoading === sub.id}
                                            >
                                                {actionLoading === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                                Annulla
                                            </Button>
                                        )}

                                        {(!sub.refund_requests || sub.refund_requests.length === 0) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={cn(
                                                    "flex-1 h-10 text-[10px] border-[#846047]/20 hover:bg-[#846047]/5 text-[#846047] gap-2 font-black uppercase tracking-widest rounded-2xl",
                                                    !isRefundAllowed && "opacity-40 cursor-not-allowed border-neutral-100 text-neutral-400"
                                                )}
                                                onClick={() => isRefundAllowed && setRefundDialog({ open: true, subId: sub.id })}
                                                title={sub.status === 'trialing' ? "Rimborso non disponibile per prodotti in prova" : !isRefundAllowed ? "Rimborso non disponibile dopo 4 giorni" : ""}
                                            >
                                                <RefreshCcw className="w-3.5 h-3.5" />
                                                Rimborso
                                            </Button>
                                        )}
                                    </div>
                                    {sub.refund_requests && sub.refund_requests.length > 0 && (
                                        <div className="w-full">
                                            <div className={cn(
                                                "h-10 flex items-center justify-center gap-2 px-3 rounded-2xl border text-[9px] font-black uppercase tracking-tighter",
                                                sub.refund_requests[0].status === 'pending' ? "border-amber-500/20 bg-amber-500/5 text-amber-600" :
                                                    sub.refund_requests[0].status === 'approved' ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" :
                                                        "border-red-500/20 bg-red-500/5 text-red-600"
                                            )}>
                                                {sub.refund_requests[0].status === 'pending' ? <Clock className="w-3 h-3" /> :
                                                    sub.refund_requests[0].status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
                                                        <XCircle className="w-3 h-3" />}
                                                {sub.refund_requests[0].status === 'pending' ? 'In attesa rimborso' :
                                                    sub.refund_requests[0].status === 'approved' ? 'Rimborso approvato' :
                                                        'Rimborso rifiutato'}
                                            </div>
                                        </div>
                                    )}
                                    <div className="w-full flex items-center justify-center gap-2 text-[8px] text-neutral-400 mt-2 uppercase tracking-[0.2em] font-black">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/50" />
                                        Pagamento Sicuro Stripe
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    }) : (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-[#846047]/10 rounded-[2.5rem] bg-neutral-50/50">
                            <CreditCard className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-[#593e25] italic uppercase tracking-tighter mb-2">Nessun abbonamento attivo</h3>
                            <p className="text-neutral-500 max-w-sm mx-auto font-medium">Inizia il tuo percorso scegliendo il piano più adatto a te.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* One-Time Purchases Section */}
            <div className="space-y-8">
                <div className="flex items-center justify-between border-b border-[#846047]/10 pb-4">
                    <h3 className="text-xl font-bold text-[#2a2e30]">Acquisti Singoli</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {oneTimePurchases.length > 0 ? oneTimePurchases.map((purchase) => (
                        <Card key={purchase.id} className="bg-white border-[#846047]/20 shadow-xl overflow-hidden group rounded-[2rem]">
                            <div className="h-32 w-full relative overflow-hidden">
                                {purchase.packages?.image_url ? (
                                    <Image
                                        src={purchase.packages.image_url}
                                        alt={purchase.packages.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                        <PackageIcon className="w-10 h-10 text-neutral-300" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#846047]" />
                            </div>
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg font-black text-[#593e25] line-clamp-1 italic uppercase tracking-tight">{purchase.packages?.name}</CardTitle>
                                    <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold border border-brand/20 uppercase">Acquistato</span>
                                </div>
                                <CardDescription className="text-neutral-500 text-xs mt-1 italic font-medium leading-tight">
                                    {purchase.packages?.description || 'Accesso completo al pacchetto.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 text-sm text-neutral-600">
                                    <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                                        <CreditCard className="w-4 h-4 text-[#846047]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">Prezzo Pagato</span>
                                        <span className="font-bold text-[#2a2e30]">€ {purchase.amount ? (purchase.amount / 100).toFixed(2) : purchase.packages?.price.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-neutral-600">
                                    <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                                        <Calendar className="w-4 h-4 text-[#846047]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">Data Acquisto</span>
                                        <span className="font-bold text-[#2a2e30]">{new Date(purchase.created_at).toLocaleDateString('it-IT')}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2 pb-6 px-6">
                                <div className="w-full flex items-center justify-center gap-2 text-[8px] text-neutral-400 mt-2 uppercase tracking-[0.2em] font-black">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-brand/50" />
                                    Accesso Permanente Sbloccato
                                </div>
                            </CardFooter>
                        </Card>
                    )) : (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-[#846047]/10 rounded-[2.5rem] bg-neutral-50/50">
                            <PackageIcon className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-[#593e25] italic uppercase tracking-tighter mb-2">Nessun acquisto singolo</h3>
                            <p className="text-neutral-500 max-w-sm mx-auto font-medium">I tuoi contenuti acquistati una tantum appariranno qui.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-8 bg-[#846047]/5 border border-[#846047]/10 rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-[#846047]/10">
                    <Clock className="w-6 h-6 text-[#846047]" />
                </div>
                <div>
                    <h4 className="font-black text-[#593e25] uppercase italic tracking-tight">Supporto e Rimborsi</h4>
                    <p className="text-sm text-neutral-500 mt-2 leading-relaxed font-medium">
                        Le richieste di rimborso vengono elaborate manualmente entro 48 ore lavorative.
                        Assicurati di inserire una motivazione valida per facilitare l&apos;operazione.
                        Puoi annullare l&apos;abbonamento o cambiare metodo di pagamento cliccando sul pulsante in alto a destra.
                    </p>
                </div>
            </div>

            {/* Modals are unchanged except for styling/dark text */}
            <Dialog open={refundDialog.open} onOpenChange={(open) => !open && setRefundDialog({ open: false, subId: null })}>
                <DialogContent className="bg-white border-neutral-200 text-[#2a2e30] max-w-md rounded-[2.5rem] p-8 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-[#593e25]">
                            <RefreshCcw className="w-6 h-6 text-[#846047]" />
                            Richiedi Rimborso
                        </DialogTitle>
                        <DialogDescription className="text-neutral-500 font-medium">
                            Spiegaci il motivo della tua richiesta. Verrai ricontattato via email.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-neutral-400 tracking-[0.2em] ml-1">Motivazione</label>
                            <Textarea
                                placeholder="Esempio: Errore nell'acquisto, duplicato, etc..."
                                className="min-h-[140px] bg-neutral-50 border-neutral-200 rounded-2xl focus:ring-[#846047] focus:border-[#846047] text-[#2a2e30] font-medium"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-brand/5 border border-brand/10 rounded-2xl">
                            <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[#593e25] leading-relaxed font-bold">
                                Una volta inviata, la richiesta verrà esaminata dallo staff. Manterrai l&apos;accesso fino alla risoluzione.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setRefundDialog({ open: false, subId: null })}
                            className="rounded-2xl text-neutral-500 font-bold hover:bg-neutral-50"
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={handleRefundSubmit}
                            disabled={isSubmittingRefund || !refundReason.trim()}
                            className="bg-[#593e25] hover:bg-[#593e25]/90 text-white font-black uppercase italic tracking-widest rounded-2xl px-8 h-12 shadow-lg"
                        >
                            {isSubmittingRefund ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Invia Richiesta'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, subId: null })}>
                <DialogContent className="bg-white border-neutral-200 text-[#2a2e30] max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <XCircle className="w-10 h-10 text-white" />
                        </div>

                        <div className="space-y-2">
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-[#593e25]">
                                Conferma Fine
                            </DialogTitle>
                            <DialogDescription className="text-neutral-500 font-medium text-sm">
                                Sei sicuro di voler annullare il rinnovo? Manterrai l&apos;accesso fino alla scadenza del periodo attuale.
                            </DialogDescription>
                        </div>

                        <div className="flex flex-col w-full gap-3 pt-4">
                            <Button
                                onClick={handleCancelConfirm}
                                disabled={actionLoading === cancelDialog.subId}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-12 rounded-2xl shadow-xl shadow-red-500/10 uppercase italic tracking-widest"
                            >
                                {actionLoading === cancelDialog.subId ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sì, Annulla Rinnovo'}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setCancelDialog({ open: false, subId: null })}
                                className="w-full text-neutral-400 hover:text-[#593e25] h-12 rounded-2xl font-bold"
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
