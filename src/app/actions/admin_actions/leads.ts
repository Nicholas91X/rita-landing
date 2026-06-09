'use server'

import { createServiceRoleClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import { isPrelaunch } from '@/lib/prelaunch'

export type LeadStatus = 'active' | 'expired' | 'converted'

export interface LeadListFilters {
  status?: LeadStatus
  search?: string
  limit?: number
  offset?: number
}

export interface LeadRow {
  id: string
  email: string | null
  full_name: string | null
  account_type: 'lead' | 'standard'
  lead_expires_at: string | null
  upgraded_from_lead_at: string | null
  lead_source: string | null
  created_at: string
  marketing_consent_at: string | null
}

async function requireAdmin() {
  const ok = await isAdmin()
  if (!ok) throw new Error('Unauthorized')
}

function sanitizeSearch(input: string): string {
  // Strip characters that have meaning inside Supabase `.or()` filter expressions
  // or that would break the ilike pattern in unexpected ways.
  return input.replace(/[%_\\*(),.]/g, '').trim()
}

export interface LeadKPIs {
  activeLeads: number
  expiredLeads: number
  totalUpgrades: number
  conversionRate: number
}

export async function getLeadKPIs(): Promise<LeadKPIs> {
  await requireAdmin()
  const admin = await createServiceRoleClient()
  const now = new Date().toISOString()

  // "Active" = a lead whose access hasn't expired. A NULL lead_expires_at means
  // no expiry (open Community access, e.g. pre-launch) → counts as active.
  const { count: activeLeads } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_type', 'lead')
    .or(`lead_expires_at.is.null,lead_expires_at.gte.${now}`)

  // "Expired" = past its window. NULL expiry is NOT expired (it never expires),
  // and `lt` already excludes NULLs in Postgres, so this stays correct.
  const { count: expiredLeads } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_type', 'lead')
    .lt('lead_expires_at', now)

  const { count: totalUpgrades } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('upgraded_from_lead_at', 'is', null)

  const { count: everLead } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or('account_type.eq.lead,upgraded_from_lead_at.not.is.null')

  const conversionRate = everLead && everLead > 0
    ? (totalUpgrades ?? 0) / everLead
    : 0

  return {
    activeLeads: activeLeads ?? 0,
    expiredLeads: expiredLeads ?? 0,
    totalUpgrades: totalUpgrades ?? 0,
    conversionRate,
  }
}

export interface LeadsListResult {
  leads: LeadRow[]
  total: number
}

const LEAD_LIST_COLUMNS =
  'id, email, full_name, account_type, lead_expires_at, upgraded_from_lead_at, lead_source, created_at, marketing_consent_at'

export async function getLeadsList(
  filters: LeadListFilters = {},
): Promise<LeadsListResult> {
  await requireAdmin()
  const admin = await createServiceRoleClient()
  const now = new Date().toISOString()
  const limit = Math.min(filters.limit ?? 50, 10000)
  const offset = filters.offset ?? 0

  let query = admin
    .from('profiles')
    .select(LEAD_LIST_COLUMNS, { count: 'exact' })

  if (filters.status === 'active') {
    // NULL lead_expires_at = no expiry (open Community access) → still active.
    query = query.eq('account_type', 'lead').or(`lead_expires_at.is.null,lead_expires_at.gte.${now}`)
  } else if (filters.status === 'expired') {
    query = query.eq('account_type', 'lead').lt('lead_expires_at', now)
  } else if (filters.status === 'converted') {
    query = query.not('upgraded_from_lead_at', 'is', null)
  } else {
    query = query.or('account_type.eq.lead,upgraded_from_lead_at.not.is.null')
  }

  if (filters.search) {
    const safe = sanitizeSearch(filters.search)
    if (safe.length > 0) {
      query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`)
    }
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  return {
    leads: (data ?? []) as LeadRow[],
    total: count ?? 0,
  }
}

export interface ExtendLeadWindowResult {
  newExpiry: string
}

export async function extendLeadWindow(
  userId: string,
  days: number,
): Promise<ExtendLeadWindowResult> {
  await requireAdmin()
  // In pre-launch leads have no expiry (open Community access); extending a
  // window that doesn't exist would re-introduce a countdown. The UI already
  // hides the action for no-expiry leads — this is the server-side backstop.
  if (isPrelaunch()) {
    throw new Error('In pre-lancio i lead non hanno una scadenza da estendere.')
  }
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    throw new Error('Days must be between 1 and 30')
  }

  const admin = await createServiceRoleClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('lead_expires_at')
    .eq('id', userId)
    .single()

  const now = new Date()
  const currentExpiry = profile?.lead_expires_at
    ? new Date(profile.lead_expires_at)
    : null
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now
  const newExpiry = new Date(base.getTime() + days * 86400000)

  await admin
    .from('profiles')
    .update({ lead_expires_at: newExpiry.toISOString() })
    .eq('id', userId)

  return { newExpiry: newExpiry.toISOString() }
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

function statusOf(lead: LeadRow): 'converted' | 'active' | 'expired' {
  if (lead.upgraded_from_lead_at) return 'converted'
  // NULL lead_expires_at = no expiry (open Community access) → active, not expired.
  if (lead.lead_expires_at == null) return 'active'
  if (new Date(lead.lead_expires_at) > new Date()) return 'active'
  return 'expired'
}

export async function exportLeadsCSV(
  filters: LeadListFilters = {},
): Promise<string> {
  await requireAdmin()
  const { leads } = await getLeadsList({ ...filters, limit: 10000 })

  const headers = [
    'Email',
    'Nome',
    'Status',
    'Lead Source',
    'Marketing Consent',
    'Created At',
    'Lead Expires At',
    'Upgraded At',
  ]
  const rows = leads.map(lead => [
    lead.email ?? '',
    lead.full_name ?? '',
    statusOf(lead),
    lead.lead_source ?? '',
    lead.marketing_consent_at ? 'yes' : 'no',
    lead.created_at,
    lead.lead_expires_at ?? '',
    lead.upgraded_from_lead_at ?? '',
  ])

  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
}
