'use client'

import { useState, useEffect } from 'react'
import { getAdminNotifications, markNotificationAsRead } from '@/app/actions/admin_actions/users'
import { getRefundRequests, handleRefundRequest } from '@/app/actions/admin_actions/sales'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Bell, RefreshCcw, XCircle, User, Clock, AlertTriangle, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { logger } from '@/lib/logger'

const ITEMS_PER_PAGE = 6

interface AdminNotification {
    id: string
    type: string
    created_at: string
    is_read: boolean
    profiles: { full_name: string; email: string } | null
    data: {
        packageName?: string
        amount?: number
        reason?: string
    } | null
}

interface RefundRequest {
    id: string
    status: string
    reason: string
    created_at: string
    processed_at: string | null
    profiles: { full_name: string; email: string } | null
    user_subscriptions: {
        package_id: string
        packages: { name: string } | null
    } | null
    one_time_purchases: {
        package_id: string
        packages: { name: string } | null
    } | null
}

export default function AdminRequests() {
    const [notifications, setNotifications] = useState<AdminNotification[]>([])
    const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Pagination states
    const [currentPageNotifs, setCurrentPageNotifs] = useState(1)
    const [totalNotifs, setTotalNotifs] = useState(0)
    const [currentPageRefunds, setCurrentPageRefunds] = useState(1)
    const [totalRefunds, setTotalRefunds] = useState(0)

    const loadData = async (silent = false) => {
        try {
            if (!silent) setLoading(true)
            const [notifsResult, refundsResult] = await Promise.all([
                getAdminNotifications(currentPageNotifs, ITEMS_PER_PAGE),
                getRefundRequests(currentPageRefunds, ITEMS_PER_PAGE)
            ])
            setNotifications(notifsResult.data as AdminNotification[])
            setTotalNotifs(notifsResult.totalCount)
            setRefundRequests(refundsResult.data as RefundRequest[])
            setTotalRefunds(refundsResult.totalCount)
        } catch (error) {
            logger.error('Failed to load admin billing data', error)
            if (!silent) toast.error('Errore nel caricamento dei dati')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageNotifs, currentPageRefunds])

    useEffect(() => {
        const supabase = createClient()

        // Listen for changes in refund_requests
        const refundChannel = supabase
            .channel('admin_refund_requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'refund_requests'
            }, () => {
                loadData(true)
            })
            .subscribe()

        // Listen for changes in admin_notifications
        const notifChannel = supabase
            .channel('admin_notifications_sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'admin_notifications'
            }, () => {
                loadData(true)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(refundChannel)
            supabase.removeChannel(notifChannel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleAction = async (requestId: string, status: 'approved' | 'rejected') => {
        try {
            setActionLoading(requestId)

            // Optimistic update
            setRefundRequests(prev => prev.map(req =>
                req.id === requestId ? { ...req, status } : req
            ))

            await handleRefundRequest(requestId, status)
            toast.success(`Richiesta ${status === 'approved' ? 'approvata' : 'rifiutata'}`)

            // Background reload to sync everything exactly
            loadData(true)
        } catch (error: unknown) {
            // Rollback on error
            loadData(true)
            toast.error((error as Error).message || 'Errore durante l\'azione')
        } finally {
            setActionLoading(null)
        }
    }

    const handleMarkAsRead = async (id: string) => {
        try {
            await markNotificationAsRead(id)
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
        } catch (error) {
            logger.error('Mark as read error:', error)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-white font-bold italic">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
                <p className="text-sm font-black animate-pulse tracking-widest uppercase">Caricamento richieste e notifiche...</p>
            </div>
        )
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    // Pagination logic for Notifications
    const totalPagesNotifs = Math.ceil(totalNotifs / ITEMS_PER_PAGE)
    const paginatedNotifs = notifications

    // Pagination logic for Refund Requests
    const totalPagesRefunds = Math.ceil(totalRefunds / ITEMS_PER_PAGE)
    const paginatedRefunds = refundRequests

    return (
        <div className="bg-black space-y-8 max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white/5 rounded-[2.5rem] border border-white/10">
                <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Gestione Fatturazione</h2>
                    <p className="text-white font-bold italic uppercase text-[10px] tracking-widest">Monitora rimborsi e cancellazioni degli utenti</p>
                </div>
            </div>

            <Tabs defaultValue="notifications" className="space-y-6">
                <TabsList className="bg-neutral-900 border border-white/10 p-1 rounded-2xl w-full md:w-auto h-auto grid grid-cols-2 md:inline-flex">
                    <TabsTrigger value="notifications" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-white gap-2 py-2 md:py-1 transition-all text-xs md:text-sm">
                        <Bell className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Notifiche
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 min-w-[20px] justify-center text-[10px]">
                                {unreadCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="refunds" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-white gap-2 py-2 md:py-1 transition-all text-xs md:text-sm">
                        <RefreshCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Richieste Rimborso
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="notifications" className="space-y-4">
                    {paginatedNotifs.length > 0 ? (
                        <>
                            <div className="grid gap-4">
                                {paginatedNotifs.map((n) => (
                                    <Card key={n.id} className={`bg-black border-white/20 backdrop-blur-sm transition-all hover:bg-neutral-900/40 overflow-hidden ${!n.is_read ? 'border-brand/40 bg-brand/5' : ''}`}>
                                        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 items-start">
                                            <div className={`p-3 rounded-2xl shrink-0 ${n.type === 'cancellation' ? 'bg-red-500/10' :
                                                n.type === 'package_purchase' ? 'bg-emerald-500/10' :
                                                    'bg-brand/10'
                                                }`}>
                                                {n.type === 'cancellation' ? (
                                                    <XCircle className="w-6 h-6 text-red-500" />
                                                ) : n.type === 'package_purchase' ? (
                                                    <ShoppingBag className="w-6 h-6 text-emerald-500" />
                                                ) : (
                                                    <RefreshCcw className="w-6 h-6 text-brand" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="font-black italic uppercase tracking-tight text-white text-base md:text-lg">
                                                        {n.type === 'cancellation' ? 'Abbonamento Annullato' :
                                                            n.type === 'package_purchase' ? 'Nuovo Acquisto' :
                                                                'Nuova Richiesta Rimborso'}
                                                    </h3>
                                                    {!n.is_read && <Badge className="bg-brand text-white text-[9px] uppercase font-bold px-2 h-4 border-none shadow-lg shadow-brand/20">Nuova</Badge>}
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <p className="text-sm text-white font-bold break-words">
                                                        Utente: <span className="text-white font-black italic uppercase tracking-tight">{n.profiles?.full_name || 'Utente sconosciuto'}</span>
                                                    </p>
                                                    <p className="text-xs text-neutral-200 italic font-medium break-all">
                                                        {n.profiles?.email}
                                                    </p>
                                                </div>

                                                <div className="bg-white/5 rounded-xl p-3 border border-white/10 mt-2">
                                                    <p className="text-sm text-white leading-relaxed font-medium">
                                                        {n.type === 'cancellation'
                                                            ? `Pacchetto: "${n.data?.packageName || 'N/A'}"`
                                                            : n.type === 'package_purchase'
                                                                ? `Pacchetto: "${n.data?.packageName || 'N/A'}". Importo: €${n.data?.amount || '0'}`
                                                                : `Pacchetto: "${n.data?.packageName || 'N/A'}". Motivazione: "${n.data?.reason || 'Nessuna motivazione fornita'}"`
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="w-full md:w-auto md:text-right flex flex-col justify-between items-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                                                <div className="text-[10px] text-white flex items-center gap-1.5 uppercase font-black tracking-widest whitespace-nowrap self-start md:self-end">
                                                    <Clock className="w-3 h-3 text-brand" />
                                                    {new Date(n.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {!n.is_read && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-[10px] text-white border-white/20 hover:bg-brand hover:text-white hover:border-brand transition-all uppercase font-black tracking-wider px-3 h-7 rounded-lg w-full md:w-auto"
                                                        onClick={() => handleMarkAsRead(n.id)}
                                                    >
                                                        Segna come letta
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            {/* Pagination Controls for Notifications */}
                            {totalPagesNotifs > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-neutral-800 border-white/30 text-white hover:bg-white hover:text-black transition-all rounded-xl w-10 h-10 p-0 shadow-lg"
                                        disabled={currentPageNotifs === 1}
                                        onClick={() => setCurrentPageNotifs(prev => prev - 1)}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                    <span className="text-[10px] font-black italic uppercase text-white px-5 bg-neutral-800 h-10 flex items-center rounded-xl border border-white/30 shadow-lg tracking-widest">
                                        Pagina {currentPageNotifs} / {totalPagesNotifs}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-neutral-800 border-white/30 text-white hover:bg-white hover:text-black transition-all rounded-xl w-10 h-10 p-0 shadow-lg"
                                        disabled={currentPageNotifs === totalPagesNotifs}
                                        onClick={() => setCurrentPageNotifs(prev => prev + 1)}
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-black">
                            <Bell className="w-12 h-12 text-neutral-700 mx-auto mb-4 hover:text-brand transition-colors" />
                            <p className="text-white font-black uppercase italic tracking-tighter text-xl">Nessuna notifica di sistema</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="refunds" className="space-y-4">
                    {paginatedRefunds.length > 0 ? (
                        <>
                            <div className="grid gap-6 lg:grid-cols-2">
                                {paginatedRefunds.map((req) => (
                                    <Card key={req.id} className="bg-black border-white/20 rounded-[2.5rem] overflow-hidden flex flex-col hover:border-white/40 transition-all duration-500 group">
                                        <CardHeader className="bg-white/5 p-6 flex flex-row items-center justify-between border-b border-white/10 group-hover:bg-white/[0.08] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-white/10 rounded-xl">
                                                    <User className="w-5 h-5 text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <CardTitle className="text-sm font-black uppercase italic tracking-tight text-white truncate max-w-[150px] md:max-w-none">
                                                        {req.profiles?.full_name}
                                                    </CardTitle>
                                                    <CardDescription className="text-[10px] text-white font-bold truncate max-w-[150px] md:max-w-none">
                                                        {req.profiles?.email}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <Badge className={`uppercase text-[9px] font-black tracking-widest px-2.5 py-1 rounded-lg border-none ${req.status === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                                                req.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                                    'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                }`}>
                                                {req.status === 'pending' ? 'In Attesa' : req.status === 'approved' ? 'Approvata' : 'Rifiutata'}
                                            </Badge>
                                        </CardHeader>
                                        <CardContent className="p-6 space-y-5 flex-1">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-white tracking-[0.2em] flex items-center gap-1.5 opacity-90">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Motivazione
                                                </label>
                                                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 italic relative">
                                                    <span className="absolute -top-2 left-4 text-3xl text-white/40 font-serif overflow-hidden">&quot;</span>
                                                    <p className="text-sm text-white leading-relaxed pl-2 font-medium">
                                                        {req.reason}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] uppercase font-black text-white/50 tracking-widest block">Pacchetto</label>
                                                    <p className="text-xs text-white font-black italic uppercase tracking-tight truncate">
                                                        {req.user_subscriptions?.packages?.name || req.one_time_purchases?.packages?.name || 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] uppercase font-black text-white/50 tracking-widest block">Data Richiesta</label>
                                                    <p className="text-xs text-white font-black italic uppercase tracking-tight">
                                                        {new Date(req.created_at).toLocaleDateString('it-IT')}
                                                    </p>
                                                </div>
                                                {req.processed_at && (
                                                    <div className="space-y-1 col-span-2 md:col-span-1">
                                                        <label className="text-[9px] uppercase font-black text-brand tracking-widest block">Data {req.status === 'approved' ? 'Approvazione' : 'Rifiuto'}</label>
                                                        <p className="text-xs text-white font-black italic uppercase tracking-tight">
                                                            {new Date(req.processed_at).toLocaleDateString('it-IT')}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                        {req.status === 'pending' && (
                                            <CardFooter className="p-6 pt-0 flex gap-3">
                                                <Button
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-tighter rounded-2xl h-11 transition-all shadow-lg hover:shadow-emerald-600/20"
                                                    onClick={() => handleAction(req.id, 'approved')}
                                                    disabled={!!actionLoading}
                                                >
                                                    {actionLoading === req.id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Approva'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 border-white/20 hover:border-red-500 hover:bg-red-500 text-white font-black uppercase italic tracking-tighter rounded-2xl h-11 transition-all"
                                                    onClick={() => handleAction(req.id, 'rejected')}
                                                    disabled={!!actionLoading}
                                                >
                                                    Rifiuta
                                                </Button>
                                            </CardFooter>
                                        )}
                                    </Card>
                                ))}
                            </div>

                            {/* Pagination Controls for Refund Requests */}
                            {totalPagesRefunds > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-8">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-neutral-800 border-white/30 text-white hover:bg-white hover:text-black transition-all rounded-xl w-10 h-10 p-0 shadow-lg"
                                        disabled={currentPageRefunds === 1}
                                        onClick={() => setCurrentPageRefunds(prev => prev - 1)}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                    <span className="text-[10px] font-black italic uppercase text-white px-5 bg-neutral-800 h-10 flex items-center rounded-xl border border-white/30 shadow-lg tracking-widest">
                                        Pagina {currentPageRefunds} / {totalPagesRefunds}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-neutral-800 border-white/30 text-white hover:bg-white hover:text-black transition-all rounded-xl w-10 h-10 p-0 shadow-lg"
                                        disabled={currentPageRefunds === totalPagesRefunds}
                                        onClick={() => setCurrentPageRefunds(prev => prev + 1)}
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-[2.5rem] bg-black">
                            <RefreshCcw className="w-12 h-12 text-neutral-700 mx-auto mb-4 hover:text-brand transition-colors" />
                            <p className="text-white font-black uppercase italic tracking-tighter text-xl">Nessuna richiesta di rimborso pendente</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
