'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, Search, FileText, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { uploadClientDocument } from '@/app/actions/admin'
import Link from 'next/link'

type OneTimeClient = {
    id: string
    user_id: string
    package_id: string
    status: 'pending_appointment' | 'processing_plan' | 'delivered' | 'refunded'
    created_at: string
    admin_notes: string | null
    document_url: string | null
    profiles: {
        full_name: string
        email: string
    }
    packages: {
        name: string
    }
}

export default function OneToOneClients() {
    const [clients, setClients] = useState<OneTimeClient[]>([])
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    useEffect(() => {
        loadClients()
    }, [])

    async function loadClients() {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('one_time_purchases')
                .select(`
                    *,
                    profiles:user_id (full_name, email),
                    packages:package_id (name)
                `)
                .neq('status', 'refunded')
                .order('created_at', { ascending: false })

            if (error) throw error
            setClients(data as unknown as OneTimeClient[])
        } catch (error: unknown) {
            console.error('Error loading clients:', error)
            toast.error('Errore nel caricamento clienti')
        } finally {
            setLoading(false)
        }
    }

    async function updateStatus(id: string, newStatus: string) {
        setUpdatingId(id)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('one_time_purchases')
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error

            setClients(clients.map(c => c.id === id ? { ...c, status: newStatus as OneTimeClient['status'] } : c))
            toast.success('Stato aggiornato')
        } catch {
            toast.error('Errore aggiornamento')
        } finally {
            setUpdatingId(null)
        }
    }

    async function updateDocumentUrl(id: string, url: string) {
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('one_time_purchases')
                .update({ document_url: url })
                .eq('id', id)

            if (error) throw error

            setClients(clients.map(c => c.id === id ? { ...c, document_url: url } : c))
            toast.success('Link salvato')
        } catch {
            toast.error('Errore salvataggio link')
        }
    }

    if (loading) return <div className="text-center p-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-white" /></div>

    return (
        <div className="space-y-6">
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6 items-center gap-4">
                <Search className="w-5 h-5 text-neutral-400" />
                <Input placeholder="Cerca cliente..." className="bg-transparent border-none text-white focus-visible:ring-0 max-w-sm" />
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-neutral-800/50">
                        <TableRow className="border-neutral-700 hover:bg-neutral-800/50">
                            <TableHead className="text-neutral-300 font-bold uppercase text-[11px] tracking-wider">Cliente</TableHead>
                            <TableHead className="text-neutral-300 font-bold uppercase text-[11px] tracking-wider">Pacchetto</TableHead>
                            <TableHead className="text-neutral-300 font-bold uppercase text-[11px] tracking-wider">Data Acquisto</TableHead>
                            <TableHead className="text-neutral-300 font-bold uppercase text-[11px] tracking-wider">Stato</TableHead>
                            <TableHead className="text-neutral-300 font-bold uppercase text-[11px] tracking-wider min-w-[400px]">Link Documento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client) => (
                            <TableRow key={client.id} className="border-neutral-800 hover:bg-neutral-800/20 transition-colors">
                                <TableCell className="font-medium text-white">
                                    <div className="flex flex-col">
                                        <span>{client.profiles?.full_name || 'Anonimo'}</span>
                                        <span className="text-xs text-neutral-500">{client.profiles?.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-neutral-300">
                                    <Badge variant="outline" className="bg-neutral-800 border-neutral-700 text-neutral-300">
                                        {client.packages?.name || 'Sconosciuto'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-neutral-400 text-xs">
                                    {new Date(client.created_at).toLocaleDateString('it-IT')}
                                </TableCell>
                                <TableCell>
                                    <Select
                                        disabled={updatingId === client.id}
                                        value={client.status || 'pending_appointment'}
                                        onValueChange={(val) => updateStatus(client.id, val)}
                                    >
                                        <SelectTrigger className={`w-[180px] h-8 text-xs font-bold border-none ${client.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                                            client.status === 'processing_plan' ? 'bg-amber-500/10 text-amber-500' :
                                                'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                            <SelectItem value="pending_appointment">📅 In attesa App.</SelectItem>
                                            <SelectItem value="processing_plan">⚙️ In Lavorazione</SelectItem>
                                            <SelectItem value="delivered">✅ Consegnato</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2 items-center">
                                        <div className="relative flex-1">
                                            <Input
                                                defaultValue={client.document_url || ''}
                                                className="h-8 bg-black/20 border-neutral-700 text-xs text-neutral-300 pr-8"
                                                placeholder="Link o Upload..."
                                                onBlur={(e) => {
                                                    if (e.target.value !== client.document_url) {
                                                        updateDocumentUrl(client.id, e.target.value)
                                                    }
                                                }}
                                            />
                                            {client.document_url && (
                                                <Link href={client.document_url} target="_blank" className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="file"
                                                id={`file-${client.id}`}
                                                className="hidden"
                                                accept=".pdf,.doc,.docx"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0]
                                                    if (!file) return

                                                    const toastId = toast.loading('Caricamento file...')
                                                    // Call server action directly
                                                    try {
                                                        const formData = new FormData()
                                                        formData.append('file', file)
                                                        formData.append('clientId', client.id)

                                                        const res = await uploadClientDocument(formData)

                                                        if (res.success) {
                                                            setClients(clients.map(c => c.id === client.id ? { ...c, document_url: res.url } : c))
                                                            toast.success('File caricato con successo', { id: toastId })
                                                        }
                                                    } catch (err) {
                                                        console.error(err)
                                                        toast.error('Errore caricamento', { id: toastId })
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 hover:bg-neutral-800 text-neutral-400 hover:text-white"
                                                onClick={() => document.getElementById(`file-${client.id}`)?.click()}
                                                title="Carica PDF"
                                            >
                                                <UploadCloud className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {clients.length === 0 && !loading && (
                    <div className="p-12 text-center text-neutral-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Nessun cliente 1:1 trovato.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
