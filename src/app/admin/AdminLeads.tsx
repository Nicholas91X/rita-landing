'use client'

import { useCallback, useEffect, useState } from 'react'
import {
    Download,
    Loader2,
    Mail,
    Search,
    UserPlus,
    CalendarPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
    getLeadKPIs,
    getLeadsList,
    extendLeadWindow,
    exportLeadsCSV,
    type LeadKPIs,
    type LeadRow,
    type LeadStatus,
} from '@/app/actions/admin_actions/leads'
import { logger } from '@/lib/logger'

type StatusFilter = LeadStatus | ''

function deriveStatus(lead: LeadRow): 'convertito' | 'attivo' | 'scaduto' {
    if (lead.upgraded_from_lead_at) return 'convertito'
    if (lead.lead_expires_at && new Date(lead.lead_expires_at) > new Date()) {
        return 'attivo'
    }
    return 'scaduto'
}

function statusBadgeClass(status: 'convertito' | 'attivo' | 'scaduto'): string {
    switch (status) {
        case 'convertito':
            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        case 'attivo':
            return 'bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20'
        case 'scaduto':
        default:
            return 'bg-red-500/10 text-red-400 border-red-500/20'
    }
}

export default function AdminLeads() {
    const [kpis, setKpis] = useState<LeadKPIs | null>(null)
    const [leads, setLeads] = useState<LeadRow[]>([])
    const [total, setTotal] = useState(0)
    const [filter, setFilter] = useState<StatusFilter>('')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [extendingId, setExtendingId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [k, list] = await Promise.all([
                getLeadKPIs(),
                getLeadsList({
                    status: filter || undefined,
                    search: search || undefined,
                }),
            ])
            setKpis(k)
            setLeads(list.leads)
            setTotal(list.total)
        } catch (err) {
            logger.error('Failed to load leads', err)
            toast.error('Errore nel caricamento dei lead')
        } finally {
            setLoading(false)
        }
    }, [filter, search])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData()
        }, 300)
        return () => clearTimeout(timer)
    }, [fetchData])

    const handleExport = async () => {
        setExporting(true)
        try {
            const csv = await exportLeadsCSV({
                status: filter || undefined,
                search: search || undefined,
            })
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success('Export CSV scaricato')
        } catch (err) {
            logger.error('CSV export failed', err)
            toast.error('Errore durante l\'export CSV')
        } finally {
            setExporting(false)
        }
    }

    const handleExtend = async (lead: LeadRow) => {
        setExtendingId(lead.id)
        try {
            const { newExpiry } = await extendLeadWindow(lead.id, 7)
            toast.success(
                `Finestra estesa fino al ${format(new Date(newExpiry), 'd MMM yyyy', { locale: it })}`,
            )
            await fetchData()
        } catch (err) {
            logger.error('Extend lead window failed', err)
            toast.error('Errore durante l\'estensione')
        } finally {
            setExtendingId(null)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Lead Magnet</h2>
                    <p className="text-xs text-neutral-200 mt-1">
                        Monitora il funnel del &quot;Rituale della Leggerezza&quot;
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                    label="Lead attivi"
                    value={kpis?.activeLeads ?? 0}
                    loading={!kpis}
                    accent="brand"
                />
                <KpiCard
                    label="Lead scaduti"
                    value={kpis?.expiredLeads ?? 0}
                    loading={!kpis}
                    accent="red"
                />
                <KpiCard
                    label="Upgrade totali"
                    value={kpis?.totalUpgrades ?? 0}
                    loading={!kpis}
                    accent="emerald"
                />
                <KpiCard
                    label="Conversion rate"
                    value={kpis ? `${(kpis.conversionRate * 100).toFixed(1)}%` : '—'}
                    loading={!kpis}
                    accent="brand"
                />
            </div>

            {/* Filters bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as StatusFilter)}
                    className="h-10 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
                >
                    <option value="">Tutti</option>
                    <option value="active">Attivi</option>
                    <option value="expired">Scaduti</option>
                    <option value="converted">Convertiti</option>
                </select>
                <div className="relative flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                        placeholder="Cerca per email o nome..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-neutral-900 border-neutral-800 focus:ring-[var(--brand)]/20 text-white placeholder:text-neutral-400 h-10 rounded-lg"
                    />
                </div>
                <Button
                    onClick={handleExport}
                    disabled={exporting || leads.length === 0}
                    className="h-10 bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white font-black uppercase tracking-widest text-[10px] rounded-lg"
                >
                    {exporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    Export CSV
                </Button>
            </div>

            {/* Leads table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-800/50 text-white text-xs uppercase tracking-widest font-black">
                            <tr>
                                <th className="px-6 py-3">Nome</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Scade</th>
                                <th className="px-6 py-3 text-center">Marketing</th>
                                <th className="px-6 py-3 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="h-6 w-6 text-[var(--brand)] animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <UserPlus className="h-10 w-10 text-neutral-700 mx-auto mb-3" />
                                        <p className="text-white font-bold italic">Nessun lead trovato</p>
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead) => {
                                    const status = deriveStatus(lead)
                                    const isConverted = status === 'convertito'
                                    return (
                                        <tr
                                            key={lead.id}
                                            className="hover:bg-neutral-800/30 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white truncate max-w-[200px]">
                                                        {lead.full_name || '—'}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold">
                                                        #{lead.id.slice(0, 8)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-neutral-200">
                                                    <Mail className="h-3 w-3 text-neutral-400" />
                                                    <span className="text-sm font-medium truncate max-w-[220px]">
                                                        {lead.email || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadgeClass(
                                                        status,
                                                    )}`}
                                                >
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-neutral-300 text-xs">
                                                {lead.lead_expires_at
                                                    ? format(
                                                          new Date(lead.lead_expires_at),
                                                          'd MMM yyyy',
                                                          { locale: it },
                                                      )
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {lead.marketing_consent_at ? (
                                                    <span className="text-emerald-400 text-xs font-bold">
                                                        Sì
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-500 text-xs">
                                                        No
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleExtend(lead)}
                                                    disabled={
                                                        isConverted || extendingId === lead.id
                                                    }
                                                    className="h-8 px-3 text-[10px] text-neutral-300 hover:text-white hover:bg-neutral-800 border border-white/5 font-black uppercase tracking-widest disabled:opacity-30"
                                                    title={
                                                        isConverted
                                                            ? 'Lead già convertito'
                                                            : 'Estendi finestra di 7 giorni'
                                                    }
                                                >
                                                    {extendingId === lead.id ? (
                                                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                                    ) : (
                                                        <CalendarPlus className="h-3 w-3 mr-2" />
                                                    )}
                                                    +7gg
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && leads.length > 0 && (
                    <div className="px-6 py-3 bg-neutral-900/50 border-t border-neutral-800">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                            {leads.length} di {total} lead
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

function KpiCard({
    label,
    value,
    loading,
    accent,
}: {
    label: string
    value: number | string
    loading: boolean
    accent: 'brand' | 'emerald' | 'red'
}) {
    const accentClass =
        accent === 'emerald'
            ? 'text-emerald-400'
            : accent === 'red'
              ? 'text-red-400'
              : 'text-[var(--brand)]'
    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                {label}
            </p>
            <p className={`text-3xl font-black mt-2 ${accentClass}`}>
                {loading ? '—' : value}
            </p>
        </div>
    )
}
