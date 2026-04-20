'use client'

import { useState, useEffect } from 'react'
import { getUserSubscriptionInfo } from '@/app/actions/user'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
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
    amount: number | null;
    packages: {
        name: string;
        description: string;
        image_url: string | null;
        price: number;
    } | null;
    stripe_payment_intent_id: string | null;
    refund_requests: Array<{
        status: string;
        reason: string;
        created_at: string;
        processed_at: string | null;
    }>;
    documents: BillingDocument[];
}

export default function BillingSection() {
    const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([])
    const [oneTimePurchases, setOneTimePurchases] = useState<OneTimePurchase[]>([])
    const [loading, setLoading] = useState(true)
    const [portalLoading, setPortalLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Modals State
    const [refundDialog, setRefundDialog] = useState<{ open: boolean, id: string | null, type: 'subscription' | 'purchase' }>({ open: false, id: null, type: 'subscription' })
    const [cancelDialog, setCancelDialog] = useState<{ open: boolean, subId: string | null }>({ open: false, subId: null })
    const [refundReason, setRefundReason] = useState('')
    const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)

    // Filters and Pagination State
    const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all')
    const [purchaseFilter, setPurchaseFilter] = useState<'all' | 'delivered' | 'refunded'>('all')
    const [subPage, setSubPage] = useState(1)
    const [purchasePage, setPurchasePage] = useState(1)
    const ITEMS_PER_PAGE = 3

    const filteredSubscriptions = subscriptions.filter(sub => {
        if (filter === 'all') return true;
        if (filter === 'active') return ['active', 'trialing'].includes(sub.status);
        if (filter === 'ended') return ['canceled', 'unpaid', 'refunded', 'past_due', 'incomplete_expired'].includes(sub.status);
        return true;
    });

    const filteredOneTimePurchases = oneTimePurchases.filter(purchase => {
        if (purchaseFilter === 'all') return true;
        if (purchaseFilter === 'delivered') return purchase.status === 'delivered';
        if (purchaseFilter === 'refunded') return purchase.status === 'refunded';
        return true;
    });

    // Paginated lists
    const totalSubPages = Math.ceil(filteredSubscriptions.length / ITEMS_PER_PAGE);
    const paginatedSubs = filteredSubscriptions.slice((subPage - 1) * ITEMS_PER_PAGE, subPage * ITEMS_PER_PAGE);

    const totalPurchasePages = Math.ceil(filteredOneTimePurchases.length / ITEMS_PER_PAGE);
    const paginatedPurchases = filteredOneTimePurchases.slice((purchasePage - 1) * ITEMS_PER_PAGE, purchasePage * ITEMS_PER_PAGE);

    const fetchSubs = async () => {
        try {
            const data = await getUserSubscriptionInfo()
            if (data && 'subscriptions' in data) {
                setSubscriptions(data.subscriptions)
                setOneTimePurchases(data.oneTimePurchases as unknown as OneTimePurchase[])
            } else if (Array.isArray(data)) {
                setSubscriptions(data)
            }
        } catch (error: unknown) {
            logger.error('Failed to fetch subscriptions', error)
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
            const result = await cancelSubscription({ subscriptionId: cancelDialog.subId })
            if (!result.ok) {
                toast.error(result.message)
                return
            }
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
            const result = await requestRefund({
                id: refundDialog.id!,
                reason: refundReason,
                type: refundDialog.type,
            })
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            toast.success('Richiesta di rimborso inviata correttamente')
            setRefundDialog({ open: false, id: null, type: 'subscription' })
            setRefundReason('')
            fetchSubs() // Refresh to show status
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore'
            toast.error(message)
        } finally {
            setIsSubmittingRefund(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-[var(--dash-muted)] font-medium">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--dash-accent)]" />
                <p>Caricamento dati di fatturazione...</p>
            </div>
        )
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-[var(--dash-heading)] italic uppercase tracking-tighter">Fatturazione</h2>
                    <p className="text-[var(--dash-muted)] mt-1 font-medium">Gestisci il tuo abbonamento e i tuoi pagamenti.</p>
                </div>
                <Button
                    onClick={handleManageBilling}
                    disabled={portalLoading || (subscriptions.length === 0 && oneTimePurchases.length === 0)}
                    className="bg-[var(--dash-accent)] hover:bg-[var(--dash-accent)]/90 text-white font-bold h-12 px-6 rounded-2xl transition-all shadow-xl"
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
                <div className="flex items-center justify-between border-b border-[var(--dash-accent-border)] pb-4">
                    <h3 className="text-xl font-bold text-[var(--dash-text)]">Abbonamenti</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={filter === 'all' ? 'secondary' : 'ghost'}
                            onClick={() => { setFilter('all'); setSubPage(1); }}
                            className="h-8 text-xs font-bold rounded-lg text-[var(--dash-heading)]"
                        >
                            Tutti
                        </Button>
                        <Button
                            variant={filter === 'active' ? 'secondary' : 'ghost'}
                            onClick={() => { setFilter('active'); setSubPage(1); }}
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
                    {paginatedSubs.length > 0 ? paginatedSubs.map((sub) => {
                        const createdAt = new Date(sub.created_at).getTime();
                        const now = new Date().getTime();
                        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
                        const isRefundAllowed = diffDays <= 4 && sub.status !== 'trialing';

                        return (
                            <Card key={sub.id} className="bg-[var(--dash-card)] border-[var(--dash-accent-border)] shadow-xl overflow-hidden group rounded-[2rem]">
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
                                        <div className="w-full h-full bg-[var(--dash-placeholder)] flex items-center justify-center">
                                            <PackageIcon className="w-10 h-10 text-[var(--dash-muted-light)]" />
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
                                        <CardTitle className="text-lg font-black text-[var(--dash-heading)] line-clamp-1 italic uppercase tracking-tight">{sub.packages?.name}</CardTitle>
                                        {sub.status === 'active' ? (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20 uppercase">Attivo</span>
                                        ) : sub.status === 'trialing' ? (
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold border border-blue-500/20 uppercase">In Prova</span>
                                        ) : sub.status === 'refunded' ? (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold border border-amber-500/20 uppercase">Rimborsato</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--dash-placeholder)] text-[var(--dash-muted)] text-[10px] font-bold border border-[var(--dash-border)] uppercase">{sub.status}</span>
                                        )}
                                    </div>
                                    <CardDescription className="text-[var(--dash-muted)] text-xs mt-1 italic font-medium leading-tight">
                                        {sub.packages?.description || 'Nessuna descrizione disponibile'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3 text-sm text-[var(--dash-muted)]">
                                        <div className="w-8 h-8 rounded-full bg-[var(--dash-card)] flex items-center justify-center border border-[var(--dash-border)]">
                                            <CreditCard className="w-4 h-4 text-[var(--dash-accent)]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-wider">Costo</span>
                                            <span className="font-bold text-[var(--dash-text)]">€ {sub.amount.toFixed(2)} / {sub.interval === 'month' ? 'mese' : sub.interval}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-[var(--dash-muted)]">
                                        <div className="w-8 h-8 rounded-full bg-[var(--dash-card)] flex items-center justify-center border border-[var(--dash-border)]">
                                            <Calendar className="w-4 h-4 text-[var(--dash-accent)]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-wider">
                                                {sub.status === 'active' ? 'Prossimo Rinnovo' : 'Fino a'}
                                            </span>
                                            <span className="font-bold text-[var(--dash-text)]">{new Date(sub.next_invoice).toLocaleDateString('it-IT')}</span>
                                        </div>
                                    </div>

                                    {sub.documents && sub.documents.length > 0 && (
                                        <div className="pt-4 mt-2 border-t border-[var(--dash-border)] space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Receipt className="w-3.5 h-3.5 text-[var(--dash-accent)]" />
                                                <span className="text-[10px] uppercase font-black tracking-widest text-[var(--dash-heading)]">Documenti Scaricabili</span>
                                            </div>
                                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                                {sub.documents.map((doc) => (
                                                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--dash-card)] border border-[var(--dash-border)] hover:bg-[var(--dash-placeholder)] transition-colors group/doc">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {doc.type === 'invoice' ? (
                                                                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                                            ) : (
                                                                <RefreshCcw className="w-3.5 h-3.5 text-amber-600" />
                                                            )}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[9px] font-black text-[var(--dash-text)] truncate uppercase tracking-tight">
                                                                    {doc.type === 'invoice' ? 'Fattura' : 'Nota Credito'}
                                                                </span>
                                                                <span className="text-[8px] text-[var(--dash-muted)] font-bold">
                                                                    {new Date(doc.date * 1000).toLocaleDateString('it-IT')} • €{doc.amount.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="w-8 h-8 rounded-xl hover:bg-[var(--dash-card)] hover:shadow-sm"
                                                            onClick={() => window.open(doc.url || undefined, '_blank')}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5 text-[var(--dash-muted-light)] group-hover/doc:text-[var(--dash-heading)]" />
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
                                                className="flex-1 h-10 text-[10px] border-[var(--dash-border)] hover:bg-[var(--dash-card)] text-[var(--dash-heading)] gap-2 font-black uppercase tracking-widest rounded-2xl"
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
                                                    "flex-1 h-10 text-[10px] border-[var(--dash-accent-border)] hover:bg-[var(--dash-accent-soft)] text-[var(--dash-accent)] gap-2 font-black uppercase tracking-widest rounded-2xl",
                                                    !isRefundAllowed && "opacity-40 cursor-not-allowed border-[var(--dash-border)] text-[var(--dash-muted-light)]"
                                                )}
                                                onClick={() => isRefundAllowed && setRefundDialog({ open: true, id: sub.id, type: 'subscription' })}
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
                                    <div className="w-full flex items-center justify-center gap-2 text-[8px] text-[var(--dash-muted-light)] mt-2 uppercase tracking-[0.2em] font-black">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/50" />
                                        Pagamento Sicuro Stripe
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    }) : (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-[var(--dash-accent-border)] rounded-[2.5rem] bg-[var(--dash-placeholder)]/50 w-full">
                            <CreditCard className="w-12 h-12 text-[var(--dash-muted-light)] mx-auto mb-4" />
                            <h3 className="text-xl font-black text-[var(--dash-heading)] italic uppercase tracking-tighter mb-2">Nessun abbonamento trovato</h3>
                            <p className="text-[var(--dash-muted)] max-w-sm mx-auto font-medium">I record filtrati appariranno qui.</p>
                        </div>
                    )}
                </div>

                {totalSubPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8">
                        <Button
                            variant="ghost"
                            disabled={subPage === 1}
                            onClick={() => setSubPage(p => p - 1)}
                            className="rounded-xl font-bold text-[var(--dash-heading)]"
                        >
                            Indietro
                        </Button>
                        <span className="text-sm font-bold text-[var(--dash-accent)]">
                            Pagina {subPage} di {totalSubPages}
                        </span>
                        <Button
                            variant="ghost"
                            disabled={subPage === totalSubPages}
                            onClick={() => setSubPage(p => p + 1)}
                            className="rounded-xl font-bold text-[var(--dash-heading)]"
                        >
                            Avanti
                        </Button>
                    </div>
                )}
            </div>

            {/* One-Time Purchases Section */}
            <div className="space-y-8">
                <div className="flex items-center justify-between border-b border-[var(--dash-accent-border)] pb-4">
                    <h3 className="text-xl font-bold text-[var(--dash-text)]">Acquisti Singoli</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={purchaseFilter === 'all' ? 'secondary' : 'ghost'}
                            onClick={() => { setPurchaseFilter('all'); setPurchasePage(1); }}
                            className="h-8 text-xs font-bold rounded-lg text-[var(--dash-heading)]"
                        >
                            Tutti
                        </Button>
                        <Button
                            variant={purchaseFilter === 'delivered' ? 'secondary' : 'ghost'}
                            onClick={() => { setPurchaseFilter('delivered'); setPurchasePage(1); }}
                            className={cn(
                                "h-8 text-xs font-bold rounded-lg gap-2",
                                purchaseFilter === 'delivered' && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            )}
                        >
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Completati
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedPurchases.length > 0 ? paginatedPurchases.map((purchase) => (
                        <Card key={purchase.id} className="bg-[var(--dash-card)] border-[var(--dash-accent-border)] shadow-xl overflow-hidden group rounded-[2rem]">
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
                                    <div className="w-full h-full bg-[var(--dash-placeholder)] flex items-center justify-center">
                                        <PackageIcon className="w-10 h-10 text-[var(--dash-muted-light)]" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--dash-accent)]" />
                            </div>
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg font-black text-[var(--dash-heading)] line-clamp-1 italic uppercase tracking-tight">{purchase.packages?.name}</CardTitle>
                                    <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold border border-brand/20 uppercase">Acquistato</span>
                                </div>
                                <CardDescription className="text-[var(--dash-muted)] text-xs mt-1 italic font-medium leading-tight">
                                    {purchase.packages?.description || 'Accesso completo al pacchetto.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 text-sm text-[var(--dash-muted)]">
                                    <div className="w-8 h-8 rounded-full bg-[var(--dash-card)] flex items-center justify-center border border-[var(--dash-border)]">
                                        <CreditCard className="w-4 h-4 text-[var(--dash-accent)]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-wider">Prezzo Pagato</span>
                                        <span className="font-bold text-[var(--dash-text)]">€ {purchase.amount ? (purchase.amount / 100).toFixed(2) : purchase.packages?.price.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-[var(--dash-muted)]">
                                    <div className="w-8 h-8 rounded-full bg-[var(--dash-card)] flex items-center justify-center border border-[var(--dash-border)]">
                                        <Calendar className="w-4 h-4 text-[var(--dash-accent)]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-wider">Data Acquisto</span>
                                        <span className="font-bold text-[var(--dash-text)]">{new Date(purchase.created_at).toLocaleDateString('it-IT')}</span>
                                    </div>
                                </div>

                                {purchase.documents && purchase.documents.length > 0 && (
                                    <div className="pt-4 mt-2 border-t border-[var(--dash-border)] space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Receipt className="w-3.5 h-3.5 text-[var(--dash-accent)]" />
                                            <span className="text-[10px] uppercase font-black tracking-widest text-[var(--dash-heading)]">Documenti Scaricabili</span>
                                        </div>
                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                            {purchase.documents.map((doc) => (
                                                <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--dash-card)] border border-[var(--dash-border)] hover:bg-[var(--dash-placeholder)] transition-colors group/doc">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] font-black text-[var(--dash-text)] truncate uppercase tracking-tight">
                                                                Fattura
                                                            </span>
                                                            <span className="text-[8px] text-[var(--dash-muted)] font-bold">
                                                                {new Date(doc.date * 1000).toLocaleDateString('it-IT')} • €{doc.amount.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="w-8 h-8 rounded-xl hover:bg-[var(--dash-card)] hover:shadow-sm"
                                                        onClick={() => window.open(doc.url || undefined, '_blank')}
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5 text-[var(--dash-muted-light)] group-hover/doc:text-[var(--dash-heading)]" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-3">
                                <div className="flex items-center gap-2 w-full mt-2">
                                    {(!purchase.refund_requests || purchase.refund_requests.length === 0) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "flex-1 h-10 text-[10px] border-[var(--dash-accent-border)] hover:bg-[var(--dash-accent-soft)] text-[var(--dash-accent)] gap-2 font-black uppercase tracking-widest rounded-2xl",
                                                (() => {
                                                    const createdAt = new Date(purchase.created_at).getTime();
                                                    const now = new Date().getTime();
                                                    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
                                                    return diffDays > 4;
                                                })() && "opacity-40 cursor-not-allowed border-[var(--dash-border)] text-[var(--dash-muted-light)]"
                                            )}
                                            onClick={() => {
                                                const createdAt = new Date(purchase.created_at).getTime();
                                                const now = new Date().getTime();
                                                const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
                                                if (diffDays <= 4) {
                                                    setRefundDialog({ open: true, id: purchase.id, type: 'purchase' });
                                                }
                                            }}
                                        >
                                            <RefreshCcw className="w-3.5 h-3.5" />
                                            Rimborso
                                        </Button>
                                    )}
                                </div>
                                {purchase.refund_requests && purchase.refund_requests.length > 0 && (
                                    <div className="w-full">
                                        <div className={cn(
                                            "h-10 flex items-center justify-center gap-2 px-3 rounded-2xl border text-[9px] font-black uppercase tracking-tighter",
                                            purchase.refund_requests[0].status === 'pending' ? "border-amber-500/20 bg-amber-500/5 text-amber-600" :
                                                purchase.refund_requests[0].status === 'approved' ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" :
                                                    "border-red-500/20 bg-red-500/5 text-red-600"
                                        )}>
                                            {purchase.refund_requests[0].status === 'pending' ? <Clock className="w-3 h-3" /> :
                                                purchase.refund_requests[0].status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
                                                    <XCircle className="w-3 h-3" />}
                                            {purchase.refund_requests[0].status === 'pending' ? 'In attesa rimborso' :
                                                purchase.refund_requests[0].status === 'approved' ? 'Rimborso approvato' :
                                                    'Rimborso rifiutato'}
                                        </div>
                                    </div>
                                )}
                                <div className="w-full flex items-center justify-center gap-2 text-[8px] text-[var(--dash-muted-light)] mt-2 uppercase tracking-[0.2em] font-black">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-brand/50" />
                                    Accesso Permanente Sbloccato
                                </div>
                            </CardFooter>
                        </Card>
                    )) : (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-[var(--dash-accent-border)] rounded-[2.5rem] bg-[var(--dash-placeholder)]/50 w-full">
                            <PackageIcon className="w-12 h-12 text-[var(--dash-muted-light)] mx-auto mb-4" />
                            <h3 className="text-xl font-black text-[var(--dash-heading)] italic uppercase tracking-tighter mb-2">Nessun acquisto trovato</h3>
                            <p className="text-[var(--dash-muted)] max-w-sm mx-auto font-medium">I record filtrati appariranno qui.</p>
                        </div>
                    )}
                </div>

                {totalPurchasePages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8">
                        <Button
                            variant="ghost"
                            disabled={purchasePage === 1}
                            onClick={() => setPurchasePage(p => p - 1)}
                            className="rounded-xl font-bold text-[var(--dash-heading)]"
                        >
                            Indietro
                        </Button>
                        <span className="text-sm font-bold text-[var(--dash-accent)]">
                            Pagina {purchasePage} di {totalPurchasePages}
                        </span>
                        <Button
                            variant="ghost"
                            disabled={purchasePage === totalPurchasePages}
                            onClick={() => setPurchasePage(p => p + 1)}
                            className="rounded-xl font-bold text-[var(--dash-heading)]"
                        >
                            Avanti
                        </Button>
                    </div>
                )}
            </div>

            <div className="p-8 bg-[var(--dash-accent-soft)] border border-[var(--dash-accent-border)] rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                <div className="p-4 bg-[var(--dash-card)] rounded-2xl shadow-sm border border-[var(--dash-accent-border)]">
                    <Clock className="w-6 h-6 text-[var(--dash-accent)]" />
                </div>
                <div>
                    <h4 className="font-black text-[var(--dash-heading)] uppercase italic tracking-tight">Supporto e Rimborsi</h4>
                    <p className="text-sm text-[var(--dash-muted)] mt-2 leading-relaxed font-medium">
                        Le richieste di rimborso vengono elaborate manualmente entro 48 ore lavorative.
                        Assicurati di inserire una motivazione valida per facilitare l&apos;operazione.
                        Puoi annullare l&apos;abbonamento o cambiare metodo di pagamento cliccando sul pulsante in alto a destra.
                    </p>
                </div>
            </div>

            {/* Modals */}
            <Dialog open={refundDialog.open} onOpenChange={(open) => !open && setRefundDialog({ open: false, id: null, type: 'subscription' })}>
                <DialogContent className="bg-[var(--dash-card)] border-[var(--dash-border)] text-[var(--dash-text)] max-w-md rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-[var(--dash-heading)]">
                            <RefreshCcw className="w-6 h-6 text-[var(--dash-accent)]" />
                            Richiedi Rimborso
                        </DialogTitle>
                        <DialogDescription className="text-[var(--dash-muted)] font-medium">
                            Spiegaci il motivo della tua richiesta. Verrai ricontattato via email.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-[var(--dash-muted-light)] tracking-[0.2em] ml-1">Motivazione</label>
                            <Textarea
                                placeholder="Esempio: Errore nell'acquisto, duplicato, etc..."
                                className="min-h-[140px] bg-[var(--dash-card)] border-[var(--dash-border)] rounded-2xl focus:ring-[var(--dash-accent)] focus:border-[var(--dash-accent)] text-[var(--dash-text)] font-medium"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-brand/5 border border-brand/10 rounded-2xl">
                            <AlertCircle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[var(--dash-heading)] leading-relaxed font-bold">
                                Una volta inviata, la richiesta verrà esaminata dallo staff. Manterrai l&apos;accesso fino alla risoluzione.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setRefundDialog({ open: false, id: null, type: 'subscription' })}
                            className="rounded-2xl text-[var(--dash-muted)] font-bold hover:bg-[var(--dash-card)]"
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={handleRefundSubmit}
                            disabled={isSubmittingRefund || !refundReason.trim()}
                            className="bg-[var(--dash-heading)] hover:bg-[var(--dash-heading)]/90 text-white font-black uppercase italic tracking-widest rounded-2xl px-8 h-12 shadow-lg"
                        >
                            {isSubmittingRefund ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Invia Richiesta'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, subId: null })}>
                <DialogContent className="bg-[var(--dash-card)] border-[var(--dash-border)] text-[var(--dash-text)] max-w-sm rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl">
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <XCircle className="w-10 h-10 text-white" />
                        </div>

                        <div className="space-y-2">
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-[var(--dash-heading)]">
                                Conferma Fine
                            </DialogTitle>
                            <DialogDescription className="text-[var(--dash-muted)] font-medium text-sm">
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
                                className="w-full text-[var(--dash-muted-light)] hover:text-[var(--dash-heading)] h-12 rounded-2xl font-bold"
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
