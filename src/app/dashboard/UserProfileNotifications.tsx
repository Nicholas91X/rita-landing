'use client'

import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, XCircle, Clock, Trophy, Loader2, Megaphone } from 'lucide-react'
import { getUserNotifications, markUserNotificationAsRead } from '@/app/actions/user'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

interface UserNotification {
    id: string
    type: 'achievement' | 'refund_approved' | 'refund_rejected' | 'broadcast' | string
    title: string
    message: string
    is_read: boolean
    created_at: string
}

export default function UserProfileNotifications() {
    const [notifications, setNotifications] = useState<UserNotification[]>([])
    const [loading, setLoading] = useState(true)

    const fetchNotifications = async () => {
        try {
            const data = await getUserNotifications()
            setNotifications(data)
        } catch (error) {
            console.error('Failed to fetch notifications', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchNotifications()
    }, [])

    const handleMarkAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

        try {
            const { success } = await markUserNotificationAsRead(id)
            if (!success) fetchNotifications()
        } catch (error) {
            fetchNotifications()
        }
    }

    const handleMarkAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
        if (unreadIds.length === 0) return

        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))

        try {
            await Promise.all(unreadIds.map(id => markUserNotificationAsRead(id)))
            toast.success('Tutte le notifiche segnate come lette')
        } catch (error) {
            fetchNotifications()
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Caricamento notifiche...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#593e25] tracking-tight">Le tue Notifiche</h2>
                    <p className="text-neutral-500 mt-1">Resta aggiornato sui tuoi progressi e comunicazioni.</p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <Button
                        onClick={handleMarkAllAsRead}
                        variant="ghost"
                        size="sm"
                        className="text-[#846047] hover:bg-[#846047]/10 font-bold"
                    >
                        Segna tutte come lette
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {notifications.length === 0 ? (
                    <Card className="bg-white border-[#846047]/10 shadow-sm rounded-2xl p-12 text-center">
                        <Bell className="w-12 h-12 text-[#846047]/20 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-[#2a2e30]">Nessuna notifica</h3>
                        <p className="text-neutral-500 mt-1">Ti avviseremo quando ci saranno novità per te.</p>
                    </Card>
                ) : (
                    notifications.map((n) => (
                        <Card
                            key={n.id}
                            className={`bg-white border-[#846047]/10 shadow-sm rounded-2xl overflow-hidden transition-all ${!n.is_read ? 'border-l-4 border-l-[#846047]' : 'opacity-80'}`}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl shrink-0 ${n.type === 'achievement' ? 'bg-yellow-50 text-yellow-600' :
                                            n.type === 'broadcast' ? 'bg-[#846047]/10 text-[#846047]' :
                                                n.type === 'refund_approved' ? 'bg-emerald-50 text-emerald-600' :
                                                    'bg-blue-50 text-blue-600'
                                        }`}>
                                        {n.type === 'achievement' ? <Trophy className="w-5 h-5" /> :
                                            n.type === 'broadcast' ? <Megaphone className="w-5 h-5" /> :
                                                n.type === 'refund_approved' ? <CheckCircle2 className="w-5 h-5" /> :
                                                    <Bell className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h4 className={`font-bold transition-colors ${!n.is_read ? 'text-[#2a2e30]' : 'text-neutral-500'}`}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[10px] text-neutral-400 font-bold uppercase shrink-0">
                                                {new Date(n.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-600 leading-relaxed">
                                            {n.message}
                                        </p>
                                        {!n.is_read && (
                                            <Button
                                                onClick={() => handleMarkAsRead(n.id)}
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-0 text-xs text-[#846047] hover:bg-transparent hover:underline mt-2"
                                            >
                                                Segna come letta
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
