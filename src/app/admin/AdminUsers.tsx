'use client'

import { useState, useEffect } from 'react'
import { getAdminUsers, getUserHistory } from '@/app/actions/admin_actions/users'
import { CardContent } from '@/components/ui/card'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search,
    User,
    History,
    ChevronRight,
    Loader2,
    Mail,
    Calendar,
    ArrowUpRight,
    Clock,
    CreditCard,
    Undo2
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'

interface AdminUser {
    id: string
    email: string
    full_name: string
    avatar_url?: string | null
    total_operations: number
}

interface HistoryOperation {
    type: 'subscription' | 'refund_request' | 'purchase'
    title: string
    date: string
    status: string
    amount: number
}

export default function AdminUsers() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [history, setHistory] = useState<HistoryOperation[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Pagination constants
    const ITEMS_PER_PAGE = 10

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [totalCount, setTotalCount] = useState<number>(0)
    const [historyPage, setHistoryPage] = useState<number>(1)

    // Reset pagination and reload when searching
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1)
            loadUsers(1, searchTerm)
        }, 300) // Debounce search
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Reload when page changes
    useEffect(() => {
        loadUsers(currentPage, searchTerm)
    }, [currentPage])

    // Reset history pagination when changing user
    useEffect(() => {
        setHistoryPage(1)
    }, [selectedUser])

    async function loadUsers(page: number = currentPage, search: string = searchTerm) {
        setLoading(true)
        try {
            const result = await getAdminUsers(page, ITEMS_PER_PAGE, search)
            setUsers((result.data as AdminUser[]) || [])
            setTotalCount(result.totalCount)
        } catch (error) {
            logger.error('Failed to load users:', error)
        } finally {
            setLoading(false)
        }
    }

    async function viewHistory(user: AdminUser) {
        setSelectedUser(user)
        setLoadingHistory(true)
        try {
            const data = await getUserHistory(user.id)
            setHistory((data as HistoryOperation[]) || [])
        } catch (error) {
            logger.error('Failed to load history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }


    // Pagination logic for users
    const totalUserPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
    const paginatedUsers = users // Data is already paginated from server

    // Pagination logic for history
    const totalHistoryPages = Math.ceil(history.length / ITEMS_PER_PAGE)
    const paginatedHistory = history.slice(
        (historyPage - 1) * ITEMS_PER_PAGE,
        historyPage * ITEMS_PER_PAGE
    )

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="h-10 w-10 text-[var(--brand)] animate-spin" />
                <p className="text-white font-bold italic animate-pulse">CARICAMENTO UTENTI...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Gestione Utenti</h2>
                    <p className="text-xs text-neutral-200 mt-1">Visualizza e monitora l&apos;attività dei tuoi iscritti</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <Input
                            placeholder="Cerca per nome o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-neutral-900 border-neutral-800 focus:ring-[var(--brand)]/20 text-white placeholder:text-neutral-400 h-10 rounded-lg"
                        />
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-800/50 text-white text-xs uppercase tracking-widest font-black">
                            <tr>
                                <th className="px-6 py-3">Utente</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3 text-center">Operazioni</th>
                                <th className="px-6 py-3 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {paginatedUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border border-[var(--brand)]/20 shrink-0 overflow-hidden relative">
                                                {user.avatar_url ? (
                                                    <Image
                                                        src={user.avatar_url}
                                                        alt={user.full_name || 'Avatar'}
                                                        fill
                                                        className="object-cover"
                                                        sizes="32px"
                                                    />
                                                ) : (
                                                    <User className="h-4 w-4 text-[var(--brand)]" />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-white truncate max-w-[200px]">{user.full_name || 'N/A'}</span>
                                                <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold">#{user.id.slice(0, 8)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-neutral-200">
                                            <Mail className="h-3 w-3 text-neutral-400" />
                                            <span className="text-sm font-medium truncate max-w-[220px]">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] text-[10px] font-bold border border-[var(--brand)]/20">
                                            {user.total_operations} op.
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => viewHistory(user)}
                                            className="h-8 px-3 text-[10px] text-neutral-300 hover:text-white hover:bg-neutral-800 border border-white/5 font-black uppercase tracking-widest"
                                        >
                                            <History className="h-3 w-3 mr-2" />
                                            Storico
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {users.length === 0 && (
                    <div className="py-16 text-center bg-neutral-900 border-t border-neutral-800">
                        <User className="h-10 w-10 text-neutral-700 mx-auto mb-3" />
                        <p className="text-white font-bold italic">Nessun utente trovato</p>
                    </div>
                )}

                {/* Main Pagination */}
                {totalUserPages > 1 && (
                    <div className="px-6 py-4 bg-neutral-900/50 border-t border-neutral-800 flex items-center justify-between gap-4">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                            Pagina <span className="text-white">{currentPage}</span> di <span className="text-white">{totalUserPages}</span>
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0 bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20"
                            >
                                <ChevronRight className="h-4 w-4 rotate-180" />
                            </Button>

                            {Array.from({ length: totalUserPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalUserPages || Math.abs(p - currentPage) <= 1)
                                .map((p, i, arr) => (
                                    <div key={p} className="flex items-center">
                                        {i > 0 && arr[i - 1] !== p - 1 && <span className="text-neutral-600 mx-1">...</span>}
                                        <Button
                                            variant={currentPage === p ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setCurrentPage(p)}
                                            className={`h-8 w-8 p-0 text-[10px] font-black ${currentPage === p
                                                ? "bg-[var(--brand)] border-[var(--brand)] text-white"
                                                : "bg-neutral-900 border-neutral-800 text-neutral-400"
                                                }`}
                                        >
                                            {p}
                                        </Button>
                                    </div>
                                ))
                            }

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalUserPages, prev + 1))}
                                disabled={currentPage === totalUserPages}
                                className="h-8 w-8 p-0 bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* History Modal */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col bg-[#0a0a0a] border-white/10 p-0 overflow-hidden rounded-[32px] gap-0">
                    <DialogHeader className="p-8 pb-4 relative shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border border-[var(--brand)]/20 shadow-2xl shrink-0 overflow-hidden relative">
                                {selectedUser?.avatar_url ? (
                                    <Image
                                        src={selectedUser.avatar_url}
                                        alt={selectedUser.full_name || 'Avatar'}
                                        fill
                                        className="object-cover"
                                        sizes="56px"
                                    />
                                ) : (
                                    <User className="h-6 w-6 text-[var(--brand)]" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-2xl font-black text-white italic uppercase tracking-tighter truncate">
                                    Storico: {selectedUser?.full_name}
                                </DialogTitle>
                                <DialogDescription className="text-neutral-400 font-bold italic lowercase text-xs truncate">
                                    {selectedUser?.email}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <CardContent className="p-8 pt-0 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                <Loader2 className="h-8 w-8 text-[var(--brand)] animate-spin" />
                                <p className="text-neutral-400 text-[10px] font-black uppercase tracking-widest">
                                    Ricostruzione attività...
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4 relative">
                                {history.length > 0 && <div className="absolute left-[21px] top-4 bottom-4 w-px bg-white/5" />}

                                {paginatedHistory.map((op, idx) => (
                                    <div key={idx} className="relative pl-12 group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#0a0a0a] bg-neutral-800 z-10 group-hover:bg-[var(--brand)] transition-colors" />

                                        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl border ${op.type === 'subscription' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                                        op.type === 'refund_request' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                            'bg-brand/10 border-brand/20 text-brand'
                                                        }`}>
                                                        {op.type === 'subscription' && <CreditCard className="h-4 w-4" />}
                                                        {op.type === 'refund_request' && <Undo2 className="h-4 w-4" />}
                                                        {op.type === 'purchase' && <ArrowUpRight className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase italic tracking-tight">{op.title}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold">
                                                                <Calendar className="h-3 w-3" />
                                                                {format(new Date(op.date), "d MMM yyyy, HH:mm", { locale: it })}
                                                            </div>
                                                            <Badge className={`text-[9px] font-black uppercase px-2 py-0 border-none rounded-sm ${op.status === 'active' || op.status === 'completed' || op.status === 'succeeded' ? 'bg-emerald-500 text-white' :
                                                                op.status === 'canceled' || op.status === 'rejected' ? 'bg-red-500 text-white' :
                                                                    op.status === 'refunded' ? 'bg-blue-500 text-white' :
                                                                        'bg-neutral-600 text-white'
                                                                }`}>
                                                                {op.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                {op.amount > 0 && (
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-[var(--brand)]">€{op.amount}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {history.length === 0 && (
                                    <div className="text-center py-12">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                                            <Clock className="h-6 w-6 text-neutral-600" />
                                        </div>
                                        <p className="text-white font-black uppercase italic tracking-tighter">Nessuna operazione registrata</p>
                                        <p className="text-neutral-400 text-xs font-bold mt-1">L&apos;utente non ha ancora effettuato acquisti o abbonamenti</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>

                    {/* History Pagination & Close */}
                    <div className="p-8 border-t border-white/5 bg-white/5 sm:flex items-center justify-between gap-4 shrink-0">
                        {totalHistoryPages > 1 ? (
                            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest min-w-[100px]">
                                    Pagina {historyPage}/{totalHistoryPages}
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                        disabled={historyPage === 1}
                                        className="h-7 w-7 p-0 bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                                    >
                                        <ChevronRight className="h-3 w-3 rotate-180" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                                        disabled={historyPage === totalHistoryPages}
                                        className="h-7 w-7 p-0 bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : <div />}

                        <Button
                            onClick={() => setSelectedUser(null)}
                            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-8 h-12 font-black uppercase tracking-widest text-[10px]"
                        >
                            Chiudi
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

