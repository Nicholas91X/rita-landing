'use client'

import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, Trophy, Loader2, Megaphone } from 'lucide-react'
import { getUserNotifications, markUserNotificationAsRead } from '@/app/actions/user'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

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
            logger.error('Failed to fetch notifications', error)
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
        } catch {
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
        } catch {
            fetchNotifications()
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-[var(--dash-muted-light)]">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Caricamento notifiche...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--dash-heading)] tracking-tight">Le tue Notifiche</h2>
                    <p className="text-[var(--dash-muted)] mt-1">Resta aggiornato sui tuoi progressi e comunicazioni.</p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <Button
                        onClick={handleMarkAllAsRead}
                        variant="ghost"
                        size="sm"
                        className="text-[var(--dash-accent)] hover:bg-[var(--dash-accent-soft)] font-bold"
                    >
                        Segna tutte come lette
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {notifications.length === 0 ? (
                    <Card className="bg-[var(--dash-card)] border-[var(--dash-accent-border)] shadow-sm rounded-2xl p-12 text-center">
                        <Bell className="w-12 h-12 text-[var(--dash-accent)]/20 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-[var(--dash-text)]">Nessuna notifica</h3>
                        <p className="text-[var(--dash-muted)] mt-1">Ti avviseremo quando ci saranno novità per te.</p>
                    </Card>
                ) : (
                    notifications.map((n) => (
                        <Card
                            key={n.id}
                            className={`bg-[var(--dash-card)] border-[var(--dash-accent-border)] shadow-sm rounded-2xl overflow-hidden transition-all ${!n.is_read ? 'border-l-4 border-l-[var(--dash-accent)]' : 'opacity-80'}`}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl shrink-0 ${n.type === 'achievement' ? 'bg-yellow-50 text-yellow-600' :
                                        n.type === 'broadcast' ? 'bg-[var(--dash-accent-soft)] text-[var(--dash-accent)]' :
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
                                            <h4 className={`font-bold transition-colors ${!n.is_read ? 'text-[var(--dash-text)]' : 'text-[var(--dash-muted)]'}`}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[10px] text-[var(--dash-muted-light)] font-bold uppercase shrink-0">
                                                {new Date(n.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--dash-muted)] leading-relaxed">
                                            {n.message}
                                        </p>
                                        {!n.is_read && (
                                            <Button
                                                onClick={() => handleMarkAsRead(n.id)}
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-0 text-xs text-[var(--dash-accent)] hover:bg-transparent hover:underline mt-2"
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
