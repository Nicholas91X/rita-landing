'use client'

import { useState, useEffect } from 'react'
import { getStripeDashboardData, cancelSubscription, refundPayment } from '@/app/actions/admin_actions/sales'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CreditCard, RefreshCcw, ArrowRight, User, Calendar, CheckCircle2, Clock, AlertTriangle, RotateCcw, Search, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type StripeData = {
    balance: {
        available: number
        pending: number
        currency: string
    }
    payments: Array<{
        id: string
        amount: number
        currency: string
        status: string
        email: string
        created: number
        receipt_url: string | null
        card: {
            brand: string
            last4: string
        } | null
    }>
    subscriptions: Array<{
        id: string
        status: string
        amount: number
        interval: string
        email: string
        next_invoice: number
    }>
}

export default function AdminStripe() {
    const [data, setData] = useState<StripeData | null>(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [subscriptionToCancel, setSubscriptionToCancel] = useState<StripeData['subscriptions'][0] | null>(null)
    const [paymentToRefund, setPaymentToRefund] = useState<StripeData['payments'][0] | null>(null)
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
    const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Pagination & Filter State
    const ITEMS_PER_PAGE = 8
    const [paymentPage, setPaymentPage] = useState(1)
    const [subscriptionPage, setSubscriptionPage] = useState(1)
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'succeeded' | 'refunded'>('all')
    const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<'all' | 'active' | 'canceled' | 'trialing'>('all')

    const loadData = async () => {
        setLoading(true)
        try {
            const result = await getStripeDashboardData()
            setData(result as StripeData)
        } catch {
            toast.error('Errore nel caricamento dei dati Stripe')
        } finally {
            setLoading(false)
        }
    }

    const handleCancelClick = (sub: StripeData['subscriptions'][0]) => {
        setSubscriptionToCancel(sub)
        setIsCancelDialogOpen(true)
    }

    const confirmCancel = async () => {
        if (!subscriptionToCancel) return
        setSubmitting(true)
        try {
            await cancelSubscription(subscriptionToCancel.id)
            toast.success('Abbonamento annullato con successo')
            setIsCancelDialogOpen(false)
            loadData()
        } catch {
            toast.error('Errore durante l\'annullamento')
        } finally {
            setSubmitting(false)
        }
    }

    const handleRefundClick = (payment: StripeData['payments'][0]) => {
        setPaymentToRefund(payment)
        setIsRefundDialogOpen(true)
    }

    const confirmRefund = async () => {
        if (!paymentToRefund) return
        setSubmitting(true)
        try {
            await refundPayment(paymentToRefund.id)
            toast.success('Rimborso effettuato con successo')
            setIsRefundDialogOpen(false)
            loadData()
        } catch {
            toast.error('Errore durante il rimborso')
        } finally {
            setSubmitting(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    // Reset page on search or filter
    useEffect(() => {
        setPaymentPage(1)
        setSubscriptionPage(1)
    }, [searchTerm, paymentStatusFilter, subscriptionStatusFilter])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-white font-medium">Recupero dati da Stripe...</p>
            </div>
        )
    }

    if (!data) return null

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const filteredPayments = data.payments.filter(p => {
        const matchesSearch = (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.id || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = paymentStatusFilter === 'all' || p.status === paymentStatusFilter
        return matchesSearch && matchesStatus
    })

    const filteredSubscriptions = data.subscriptions.filter(s => {
        const matchesSearch = (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.id || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = subscriptionStatusFilter === 'all' || s.status === subscriptionStatusFilter
        return matchesSearch && matchesStatus
    })

    // Pagination Logic
    const totalPaymentPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)
    const paginatedPayments = filteredPayments.slice(
        (paymentPage - 1) * ITEMS_PER_PAGE,
        paymentPage * ITEMS_PER_PAGE
    )

    const totalSubscriptionPages = Math.ceil(filteredSubscriptions.length / ITEMS_PER_PAGE)
    const paginatedSubscriptions = filteredSubscriptions.slice(
        (subscriptionPage - 1) * ITEMS_PER_PAGE,
        subscriptionPage * ITEMS_PER_PAGE
    )

    const Pagination = ({ current, total, onPageChange }: { current: number, total: number, onPageChange: (p: number) => void }) => {
        if (total <= 1) return null;

        return (
            <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={current === 1}
                    onClick={() => onPageChange(current - 1)}
                    className="h-9 w-9 p-0 bg-neutral-800 border-white/20 text-white hover:bg-white hover:text-black disabled:opacity-20 transition-all rounded-lg"
                >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                </Button>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800/50 rounded-xl border border-white/10">
                    {Array.from({ length: total }, (_, i) => i + 1).map(p => (
                        <Button
                            key={p}
                            variant={current === p ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => onPageChange(p)}
                            className={`h-7 w-7 p-0 text-[10px] font-black transition-all rounded-lg ${current === p
                                ? 'bg-white text-black shadow-lg'
                                : 'text-white hover:text-white hover:bg-white/10'}`}
                        >
                            {p}
                        </Button>
                    ))}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={current === total}
                    onClick={() => onPageChange(current + 1)}
                    className="h-9 w-9 p-0 bg-neutral-800 border-white/20 text-white hover:bg-white hover:text-black disabled:opacity-20 transition-all rounded-lg"
                >
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white">
                    Pannello Stripe
                </h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <Input
                            placeholder="Cerca per email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-neutral-900 border-neutral-800 focus:ring-emerald-500/20 text-white placeholder:text-neutral-400"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={loadData} className="border-neutral-700 bg-neutral-900 h-10 text-white hover:bg-neutral-800">
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Aggiorna
                    </Button>
                </div>
            </div>

            {/* BALANCE OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-white uppercase tracking-wider">
                            Disponibile nel Saldo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-500">
                            € {data.balance.available.toFixed(2)}
                        </div>
                        <p className="text-xs text-neutral-200 mt-1">Disponibile per il bonifico</p>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-white uppercase tracking-wider">
                            Saldo in Arrivo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500">
                            € {data.balance.pending.toFixed(2)}
                        </div>
                        <p className="text-xs text-neutral-200 mt-1">Transazioni in elaborazione</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* RECENT PAYMENTS */}
                <div className="xl:col-span-7 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-lg font-semibold">Transazioni</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={paymentStatusFilter}
                                onChange={(e) => setPaymentStatusFilter(e.target.value as 'all' | 'succeeded' | 'refunded')}
                                className="bg-neutral-800 border-white/10 text-neutral-300 text-[10px] font-black uppercase tracking-widest px-3 h-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer appearance-none min-w-[120px]"
                            >
                                <option value="all">Tutti gli stati</option>
                                <option value="succeeded">Riuscite</option>
                                <option value="refunded">Rimborsate</option>
                            </select>
                            <span className="text-[10px] text-white font-bold uppercase tracking-widest hidden sm:inline-block">
                                Pagina {paymentPage} / {totalPaymentPages || 1}
                            </span>
                        </div>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-neutral-800/50 text-white text-xs uppercase tracking-widest font-black">
                                    <tr>
                                        <th className="px-6 py-3">Data</th>
                                        <th className="px-6 py-3">Cliente</th>
                                        <th className="px-6 py-3 text-right">Azioni / Stato</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {paginatedPayments.map((p) => (
                                        <tr key={p.id} className="hover:bg-neutral-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-white font-mono text-[10px] font-bold">
                                                {formatDate(p.created)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-3 h-3 text-neutral-300" />
                                                        <span className="truncate max-w-[150px] text-sm font-bold text-white">{p.email || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-semibold text-neutral-100">
                                                            € {p.amount.toFixed(2)}
                                                        </div>
                                                        {p.receipt_url && (
                                                            <a
                                                                href={p.receipt_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] text-emerald-500 hover:underline flex items-center gap-1"
                                                            >
                                                                Ricevuta <ExternalLink className="w-2.5 h-2.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${p.status === 'succeeded'
                                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                        : p.status === 'refunded'
                                                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                    {p.status === 'succeeded' && (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            onClick={() => handleRefundClick(p)}
                                                            className="h-auto p-0 text-[10px] text-neutral-300 hover:text-amber-500 font-bold"
                                                        >
                                                            <RotateCcw className="w-2.5 h-2.5 mr-1" />
                                                            Rimborsa
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredPayments.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-white font-bold italic">
                                                Nessuna transazione trovata
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Pagination
                        current={paymentPage}
                        total={totalPaymentPages}
                        onPageChange={setPaymentPage}
                    />
                </div>

                {/* ACTIVE SUBSCRIPTIONS */}
                <div className="xl:col-span-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-lg font-semibold">Abbonamenti</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={subscriptionStatusFilter}
                                onChange={(e) => setSubscriptionStatusFilter(e.target.value as 'all' | 'active' | 'canceled' | 'trialing')}
                                className="bg-neutral-800 border-white/10 text-neutral-300 text-[10px] font-black uppercase tracking-widest px-3 h-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer appearance-none min-w-[120px]"
                            >
                                <option value="all">Tutti gli stati</option>
                                <option value="active">Attivi</option>
                                <option value="trialing">In Prova</option>
                                <option value="canceled">Annullati</option>
                            </select>
                            <span className="text-[10px] text-white font-bold uppercase tracking-widest hidden sm:inline-block">
                                Pagina {subscriptionPage} / {totalSubscriptionPages || 1}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {paginatedSubscriptions.map((s) => (
                            <div key={s.id} className={`p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-all group ${s.status === 'canceled' ? 'opacity-50' : ''}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-800 text-white'
                                            }`}>
                                            {s.status === 'active' ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                            ) : (
                                                <Clock className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white truncate max-w-[120px] sm:max-w-[180px]">{s.email}</div>
                                            <div className="text-[10px] text-neutral-200 font-mono tracking-tighter uppercase font-bold truncate max-w-[120px] sm:max-w-[180px]">{s.id}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${s.status === 'active'
                                            ? 'bg-emerald-500/10 text-emerald-500'
                                            : s.status === 'canceled'
                                                ? 'bg-rose-500/10 text-rose-500'
                                                : 'bg-neutral-800 text-neutral-400'
                                            }`}>
                                            {s.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end pt-3 border-t border-white/5">
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] text-white font-black uppercase tracking-widest">
                                            {s.status === 'canceled' ? 'Terminato' : `Rinnovo: ${formatDate(s.next_invoice)}`}
                                        </div>
                                        <div className="text-xl font-black text-white">
                                            € {s.amount.toFixed(2)}
                                            <span className="text-xs text-neutral-300 font-bold ml-1">/ {s.interval === 'month' ? 'mese' : s.interval}</span>
                                        </div>
                                    </div>
                                    {s.status === 'active' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCancelClick(s)}
                                            className="h-8 px-3 text-[10px] text-rose-500 hover:text-white hover:bg-rose-600 transition-all bg-rose-500/5 hover:bg-rose-600/20"
                                        >
                                            Annulla
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredSubscriptions.length === 0 && (
                            <div className="p-8 text-center text-white font-bold italic bg-neutral-900 border border-neutral-800 rounded-xl">
                                Nessun abbonamento trovato
                            </div>
                        )}
                    </div>

                    <Pagination
                        current={subscriptionPage}
                        total={totalSubscriptionPages}
                        onPageChange={setSubscriptionPage}
                    />
                </div>
            </div>

            {/* MODAL CONFERMA CANCELLAZIONE */}
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <DialogContent className="max-w-md border-neutral-800 bg-neutral-900 text-white">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-rose-500/10 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                            </div>
                            <DialogTitle className="text-xl">Conferma Annullamento</DialogTitle>
                        </div>
                        <DialogDescription className="text-neutral-400 pt-2">
                            Stai per annullare l&apos;abbonamento attivo per l&apos;utente:
                            <div className="mt-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-800 text-neutral-200 font-medium font-mono text-xs">
                                {subscriptionToCancel?.email}
                            </div>
                            <p className="mt-4 text-xs leading-relaxed">
                                Questa azione è immediata su Stripe. L&apos;utente perderà l&apos;accesso ai contenuti riservati al termine del periodo corrente o immediatamente a seconda della configurazione.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 gap-3 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsCancelDialogOpen(false)}
                            className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                        >
                            Indietro
                        </Button>
                        <Button
                            onClick={confirmCancel}
                            disabled={submitting}
                            className="bg-rose-500 hover:bg-rose-600 text-white border-none min-w-[160px]"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Conferma Annullamento"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL CONFERMA RIMBORSO */}
            <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
                <DialogContent className="max-w-md border-neutral-800 bg-neutral-900 text-white">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <RotateCcw className="w-5 h-5 text-amber-500" />
                            </div>
                            <DialogTitle className="text-xl">Conferma Rimborso</DialogTitle>
                        </div>
                        <DialogDescription className="text-neutral-400 pt-2">
                            Stai per emettere un rimborso completo per la transazione di:
                            <div className="mt-3 space-y-2">
                                <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-800 flex justify-between items-center">
                                    <span className="text-neutral-400 text-xs">Cliente:</span>
                                    <span className="text-neutral-100 font-medium">{paymentToRefund?.email}</span>
                                </div>
                                <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-800 flex justify-between items-center">
                                    <span className="text-neutral-400 text-xs">Importo:</span>
                                    <span className="text-amber-500 font-bold text-lg">€ {paymentToRefund?.amount.toFixed(2)}</span>
                                </div>
                            </div>
                            <p className="mt-4 text-xs leading-relaxed">
                                Il rimborso verrà elaborato immediatamente da Stripe. I fondi torneranno sul metodo di pagamento originale del cliente solitamente entro 5-10 giorni lavorativi.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 gap-3 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsRefundDialogOpen(false)}
                            className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                        >
                            Indietro
                        </Button>
                        <Button
                            onClick={confirmRefund}
                            disabled={submitting}
                            className="bg-amber-600 hover:bg-amber-700 text-white border-none min-w-[160px]"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Conferma Rimborso"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
