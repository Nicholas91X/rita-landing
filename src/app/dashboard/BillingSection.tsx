'use client'

import { useState, useEffect } from 'react'
import { getUserSubscriptionInfo } from '@/app/actions/user'
import { createPortalSession } from '@/app/actions/stripe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, ExternalLink, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'

export default function BillingSection() {
    const [subscriptions, setSubscriptions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [portalLoading, setPortalLoading] = useState(false)

    useEffect(() => {
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
        fetchSubs()
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subscriptions.length > 0 ? subscriptions.map((sub: any) => (
                    <Card key={sub.id} className="bg-white/5 backdrop-blur-md border-white/5 shadow-2xl overflow-hidden group">
                        <div className={sub.status === 'active' ? 'h-1.5 w-full bg-emerald-500' : 'h-1.5 w-full bg-neutral-700'} />
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl font-bold text-white line-clamp-1">{sub.packages?.name}</CardTitle>
                                {sub.status === 'active' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20 uppercase">Attivo</span>
                                ) : sub.status === 'trialing' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20 uppercase">In Prova</span>
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
                                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Prossimo Rinnovo</span>
                                    <span className="font-mono">{new Date(sub.next_invoice).toLocaleDateString('it-IT')}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2 pb-6 px-6">
                            <div className="w-full flex items-center gap-2 text-[10px] text-neutral-400">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Fatturato tramite Stripe
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
                    <h4 className="font-bold text-white">Hai domande sui rimborsi?</h4>
                    <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
                        I rimborsi possono essere gestiti contattando direttamente il nostro supporto.
                        Ricorda che puoi annullare il rinnovo in qualsiasi momento dal portale Stripe cliccando su "Gestisci su Stripe".
                    </p>
                </div>
            </div>
        </div>
    )
}
