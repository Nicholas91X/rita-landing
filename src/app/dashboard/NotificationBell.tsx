'use client'

import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { getUserNotifications, markUserNotificationAsRead } from '@/app/actions/user'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = async () => {
        const data = await getUserNotifications()
        setNotifications(data)
        setUnreadCount(data.filter((n: any) => !n.is_read).length)
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
        const { success } = await markUserNotificationAsRead(id)
        if (success) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-white/10 rounded-xl transition-all h-10 w-10">
                    <Bell className="w-5 h-5 text-white" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-brand text-white border-2 border-[#001F3D] animate-in zoom-in-50 duration-300">
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
                        <div className="px-3 py-8 text-center">
                            <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-20" />
                            <p className="text-xs text-neutral-500 font-medium">Nessuna notifica</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <DropdownMenuItem
                                key={n.id}
                                className={cn(
                                    "flex flex-col items-start gap-1 p-3 rounded-xl transition-all cursor-default focus:bg-white/5",
                                    !n.is_read && "bg-white/5 border-l-2 border-brand"
                                )}
                            >
                                <div className="flex w-full items-start justify-between gap-2">
                                    <div className="flex items-start gap-2">
                                        {n.type === 'refund_approved' ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                        )}
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-black uppercase text-white leading-tight">{n.title}</span>
                                            <p className="text-[11px] text-neutral-300 leading-snug line-clamp-3">
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>
                                    {!n.is_read && (
                                        <button
                                            onClick={(e) => handleMarkAsRead(n.id, e)}
                                            className="text-[9px] font-black uppercase text-brand hover:text-white transition-colors underline underline-offset-2 shrink-0"
                                        >
                                            Letta
                                        </button>
                                    )}
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
