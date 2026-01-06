'use client'

import { useState, useEffect } from 'react'
import { getStripeDashboardData } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CreditCard, RefreshCcw, ArrowRight, User, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

    const loadData = async () => {
        setLoading(true)
        try {
            const result = await getStripeDashboardData()
            setData(result as StripeData)
        } catch (error) {
            toast.error('Errore nel caricamento dei dati Stripe')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-neutral-400">Recupero dati da Stripe...</p>
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                    Pannello Stripe
                </h2>
                <Button variant="outline" size="sm" onClick={loadData} className="border-neutral-700 bg-neutral-900">
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Aggiorna
                </Button>
            </div>

            {/* BALANCE OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            Disponibile nel Saldo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-500">
                            € {data.balance.available.toFixed(2)}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">Disponibile per il bonifico</p>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            Saldo in Arrivo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-500">
                            € {data.balance.pending.toFixed(2)}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">Transazioni in elaborazione</p>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 md:col-span-2 lg:col-span-1 border-dashed opacity-70">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-neutral-800 rounded-lg">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm font-medium">Stripe Dashboard</div>
                                <p className="text-xs text-neutral-500">Gestisci rimborsi e dispute</p>
                            </div>
                            <ArrowRight className="w-4 h-4 ml-auto text-neutral-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* RECENT PAYMENTS */}
                <div className="xl:col-span-7 space-y-4">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-lg font-semibold">Transazioni Recenti</h3>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-neutral-800/50 text-neutral-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Data</th>
                                        <th className="px-6 py-3 font-medium">Cliente</th>
                                        <th className="px-6 py-3 font-medium">Importo</th>
                                        <th className="px-6 py-3 font-medium text-right">Stato</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {data.payments.map((p) => (
                                        <tr key={p.id} className="hover:bg-neutral-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-neutral-400 font-mono text-[10px]">
                                                {formatDate(p.created)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3 h-3 text-neutral-500" />
                                                    <span className="truncate max-w-[150px]">{p.email || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-neutral-100">
                                                € {p.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${p.status === 'succeeded'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    : p.status === 'refunded'
                                                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                    }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ACTIVE SUBSCRIPTIONS */}
                <div className="xl:col-span-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-lg font-semibold">Abbonamenti</h3>
                    </div>

                    <div className="space-y-3">
                        {data.subscriptions.map((s) => (
                            <div key={s.id} className={`p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-all group ${s.status === 'canceled' ? 'opacity-50' : ''}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.status === 'active' ? 'bg-emerald-500/10' : 'bg-neutral-800'
                                            }`}>
                                            {s.status === 'active' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <Clock className="w-4 h-4 text-neutral-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{s.email}</div>
                                            <div className="text-[10px] text-neutral-500 font-mono">{s.id}</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${s.status === 'active'
                                            ? 'bg-emerald-500/10 text-emerald-500'
                                            : s.status === 'canceled'
                                                ? 'bg-rose-500/10 text-rose-500'
                                                : 'bg-neutral-800 text-neutral-400'
                                        }`}>
                                        {s.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-t border-neutral-800 pt-3">
                                    <div className="space-y-1">
                                        <div className="text-xs text-neutral-500 flex items-center gap-1">
                                            {s.status === 'canceled' ? (
                                                <>Terminato / Annullato</>
                                            ) : (
                                                <>
                                                    <Clock className="w-3 h-3" />
                                                    Rinnovo: {formatDate(s.next_invoice)}
                                                </>
                                            )}
                                        </div>
                                        <div className="text-lg font-bold">€ {s.amount.toFixed(2)} <span className="text-[10px] text-neutral-500 font-normal">/ {s.interval === 'month' ? 'mese' : s.interval}</span></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
