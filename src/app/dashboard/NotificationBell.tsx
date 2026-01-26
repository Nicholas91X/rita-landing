'use client'

import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, XCircle, Clock, Trophy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getUserNotifications, markUserNotificationAsRead } from '@/app/actions/user'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
interface UserNotification {
    id: string
    type: 'achievement' | 'refund_approved' | 'refund_rejected' | string
    title: string
    message: string
    is_read: boolean
    created_at: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<UserNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const router = useRouter()

    const fetchNotifications = async () => {
        const data = await getUserNotifications()
        // Only show unread notifications
        const unread = data.filter((n: UserNotification) => !n.is_read)
        setNotifications(unread)
        setUnreadCount(unread.length)
    }

    useEffect(() => {
        fetchNotifications()
        // Poll every 30 seconds for new notifications
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Optimistic update
        setNotifications(prev => prev.filter(n => n.id !== id))
        setUnreadCount(prev => Math.max(0, prev - 1))

        const { success } = await markUserNotificationAsRead(id)
        if (!success) {
            // Revert if failed
            fetchNotifications()
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-white/10 rounded-xl transition-all h-10 w-10">
                    <Bell className="w-5 h-5 text-white" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-[#7f554f] text-white border-2 border-[#001F3D] animate-in zoom-in-50 duration-300">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-[#001F3D]/95 backdrop-blur-xl border-white/10 p-2 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between px-3 py-2 mb-2 border-b border-white/10">
                    <span className="text-xs font-black uppercase tracking-widest text-white">Notifiche</span>
                    {unreadCount > 0 && <span className="text-[10px] text-neutral-400 font-bold uppercase">{unreadCount} nuove</span>}
                </div>
                <div className="max-h-96 overflow-y-auto space-y-1">
                    {notifications.length === 0 ? (
                        <div className="px-3 py-8 text-center text-white/50">
                            <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-20" />
                            <p className="text-xs font-medium">Nessuna nuova notifica</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <DropdownMenuItem
                                key={n.id}
                                onSelect={async () => {
                                    // Mark as read and then redirect
                                    await markUserNotificationAsRead(n.id)
                                    router.push('/dashboard?tab=profile')
                                    fetchNotifications() // Update locally
                                }}
                                className="flex flex-col items-start gap-1 p-3 rounded-xl transition-all cursor-pointer focus:bg-white/10 bg-white/5 border-l-2 border-brand"
                            >
                                <div className="flex w-full items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="mt-1 shrink-0">
                                            {n.type === 'achievement' ? (
                                                <Trophy className="w-4 h-4 text-yellow-500" />
                                            ) : n.type === 'refund_approved' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-red-500" />
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                            <span className="text-[11px] font-black uppercase text-white leading-tight break-words">{n.title}</span>
                                            <p className="text-[11px] text-neutral-300 leading-snug line-clamp-3">
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleMarkAsRead(n.id, e)}
                                        className="text-[9px] font-black uppercase text-white hover:text-white transition-all bg-white/5 hover:bg-brand/20 px-2 py-1 rounded-md border border-brand/20 shrink-0 self-start"
                                    >
                                        Letta
                                    </button>
                                </div>
                                <span className="text-[9px] text-neutral-500 font-bold mt-1 uppercase">
                                    {new Date(n.created_at).toLocaleDateString('it-IT')}
                                </span>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
