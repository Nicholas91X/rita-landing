import { describe, it, expect, vi, beforeEach } from 'vitest'

const { isAdminMock } = vi.hoisted(() => ({ isAdminMock: vi.fn() }))
vi.mock('@/utils/supabase/admin', () => ({
  isAdmin: isAdminMock,
}))

type QueryResult = {
  count?: number | null
  data?: unknown
  error?: { message: string } | null
}

type AdminFromBuilder = ReturnType<typeof makeFromBuilder>

function makeFromBuilder(initial: QueryResult = { count: 0, data: [], error: null }) {
  const state = {
    table: '' as string,
    filters: [] as Array<{ op: string; args: unknown[] }>,
    rangeArgs: null as null | [number, number],
    orderArgs: null as null | [string, { ascending: boolean }],
    selectArgs: null as null | [string, Record<string, unknown> | undefined],
    updatePayload: null as null | Record<string, unknown>,
    upsertPayload: null as null | unknown,
    result: initial as QueryResult,
  }
  const chain: Record<string, unknown> = {
    _state: state,
    select: vi.fn((cols: string, opts?: Record<string, unknown>) => {
      state.selectArgs = [cols, opts]
      return chain
    }),
    eq: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'eq', args: [col, val] })
      return chain
    }),
    neq: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'neq', args: [col, val] })
      return chain
    }),
    gte: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'gte', args: [col, val] })
      return chain
    }),
    lte: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'lte', args: [col, val] })
      return chain
    }),
    lt: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'lt', args: [col, val] })
      return chain
    }),
    is: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'is', args: [col, val] })
      return chain
    }),
    not: vi.fn((col: string, op: string, val: unknown) => {
      state.filters.push({ op: 'not', args: [col, op, val] })
      return chain
    }),
    or: vi.fn((expr: string) => {
      state.filters.push({ op: 'or', args: [expr] })
      return chain
    }),
    ilike: vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'ilike', args: [col, val] })
      return chain
    }),
    order: vi.fn((col: string, opts: { ascending: boolean }) => {
      state.orderArgs = [col, opts]
      return chain
    }),
    range: vi.fn((from: number, to: number) => {
      state.rangeArgs = [from, to]
      return chain
    }),
    single: vi.fn(() => Promise.resolve(state.result)),
    maybeSingle: vi.fn(() => Promise.resolve(state.result)),
    update: vi.fn((payload: Record<string, unknown>) => {
      state.updatePayload = payload
      return chain
    }),
    upsert: vi.fn((payload: unknown) => {
      state.upsertPayload = payload
      return chain
    }),
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(state.result).then(resolve),
  }
  return chain as AdminFromBuilder & {
    _state: typeof state
  }
}

function makeServiceClient(tableHandlers: Record<string, () => AdminFromBuilder>) {
  return {
    from: vi.fn((table: string) => {
      const handler = tableHandlers[table]
      if (!handler) throw new Error(`Unexpected table: ${table}`)
      return handler()
    }),
  }
}

const { serviceClientFactory } = vi.hoisted(() => ({
  serviceClientFactory: { current: (): unknown => ({ from: () => null }) },
}))
vi.mock('@/utils/supabase/server', () => ({
  createServiceRoleClient: vi.fn(async () => serviceClientFactory.current()),
  createClient: vi.fn(async () => ({ auth: { getUser: vi.fn() } })),
}))

import {
  getLeadKPIs,
  getLeadsList,
  extendLeadWindow,
  exportLeadsCSV,
} from './leads'

describe('admin lead actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAdminMock.mockResolvedValue(true)
  })

  describe('getLeadKPIs', () => {
    it('rejects non-admin callers', async () => {
      isAdminMock.mockResolvedValue(false)
      await expect(getLeadKPIs()).rejects.toThrow(/unauthorized/i)
    })

    it('returns KPI shape with conversion rate', async () => {
      const calls: AdminFromBuilder[] = []
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => {
          // active=4, expired=2, upgrades=3, ever=10 → conv = 0.3
          const counts = [4, 2, 3, 10]
          const idx = calls.length
          const builder = makeFromBuilder({ count: counts[idx], data: [], error: null })
          calls.push(builder)
          return builder
        },
      })

      const kpis = await getLeadKPIs()
      expect(kpis.activeLeads).toBe(4)
      expect(kpis.expiredLeads).toBe(2)
      expect(kpis.totalUpgrades).toBe(3)
      expect(kpis.conversionRate).toBeCloseTo(0.3, 5)
    })

    it('returns conversionRate 0 when no leads ever existed', async () => {
      const counts = [0, 0, 0, 0]
      let i = 0
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => makeFromBuilder({ count: counts[i++], data: [], error: null }),
      })
      const kpis = await getLeadKPIs()
      expect(kpis.conversionRate).toBe(0)
    })
  })

  describe('getLeadsList', () => {
    it('rejects non-admin callers', async () => {
      isAdminMock.mockResolvedValue(false)
      await expect(getLeadsList()).rejects.toThrow(/unauthorized/i)
    })

    it('returns leads with default filter (all)', async () => {
      const fakeLeads = [
        { id: 'u1', email: 'a@e.com', full_name: 'Mario', account_type: 'lead',
          lead_expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
          upgraded_from_lead_at: null, lead_source: 'landing',
          created_at: '2026-05-20T00:00:00Z', marketing_consent_at: null },
      ]
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => makeFromBuilder({ count: 1, data: fakeLeads, error: null }),
      })
      const { leads, total } = await getLeadsList()
      expect(total).toBe(1)
      expect(leads[0].email).toBe('a@e.com')
    })

    it('filters by status=active', async () => {
      let captured: AdminFromBuilder | null = null
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => {
          const b = makeFromBuilder({ count: 0, data: [], error: null })
          captured = b
          return b
        },
      })
      await getLeadsList({ status: 'active' })
      const ops = captured!._state.filters.map(f => f.op + ':' + f.args[0])
      expect(ops).toContain('eq:account_type')
      expect(ops).toContain('gte:lead_expires_at')
    })

    it('filters by status=converted', async () => {
      let captured: AdminFromBuilder | null = null
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => {
          const b = makeFromBuilder({ count: 0, data: [], error: null })
          captured = b
          return b
        },
      })
      await getLeadsList({ status: 'converted' })
      const notFilters = captured!._state.filters.filter(f => f.op === 'not')
      expect(notFilters.length).toBeGreaterThan(0)
      expect(notFilters[0].args[0]).toBe('upgraded_from_lead_at')
    })

    it('applies search filter (sanitized)', async () => {
      let captured: AdminFromBuilder | null = null
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => {
          const b = makeFromBuilder({ count: 0, data: [], error: null })
          captured = b
          return b
        },
      })
      await getLeadsList({ search: 'mario' })
      const orFilters = captured!._state.filters.filter(f => f.op === 'or')
      expect(orFilters.length).toBeGreaterThan(0)
      expect(String(orFilters[orFilters.length - 1].args[0])).toMatch(/mario/i)
    })

    it('strips unsafe characters from search', async () => {
      let captured: AdminFromBuilder | null = null
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => {
          const b = makeFromBuilder({ count: 0, data: [], error: null })
          captured = b
          return b
        },
      })
      await getLeadsList({ search: 'mar*io,%' })
      const orFilters = captured!._state.filters.filter(f => f.op === 'or')
      const arg = String(orFilters[orFilters.length - 1].args[0])
      // The sanitized term should be "mario" — `*` , `,` and `%` are stripped
      // from the user input itself, so we expect the dangerous pattern
      // `mar*io` to no longer appear and the literal `%mario%` to be the only
      // place a `%` survives (as part of our intentional ilike wildcard).
      expect(arg).not.toContain('mar*io')
      expect(arg).toContain('%mario%')
    })
  })

  describe('extendLeadWindow', () => {
    it('rejects non-admin', async () => {
      isAdminMock.mockResolvedValue(false)
      await expect(extendLeadWindow('u1', 7)).rejects.toThrow(/unauthorized/i)
    })

    it('rejects out-of-range days', async () => {
      await expect(extendLeadWindow('u1', 0)).rejects.toThrow()
      await expect(extendLeadWindow('u1', 31)).rejects.toThrow()
    })

    it('extends from existing expiry when in the future', async () => {
      const future = new Date(Date.now() + 5 * 86400000).toISOString()
      let updateBuilder: AdminFromBuilder | null = null
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => {
          if (!updateBuilder) {
            updateBuilder = makeFromBuilder({
              data: { lead_expires_at: future },
              error: null,
            })
            return updateBuilder
          }
          return makeFromBuilder({ data: null, error: null })
        },
      })
      const { newExpiry } = await extendLeadWindow('u1', 7)
      const expected = new Date(new Date(future).getTime() + 7 * 86400000).toISOString()
      expect(newExpiry).toBe(expected)
    })

    it('extends from now when expiry is in the past', async () => {
      const past = new Date(Date.now() - 86400000).toISOString()
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => makeFromBuilder({
          data: { lead_expires_at: past },
          error: null,
        }),
      })
      const { newExpiry } = await extendLeadWindow('u1', 3)
      const diffMs = new Date(newExpiry).getTime() - Date.now()
      expect(diffMs).toBeGreaterThan(2.9 * 86400000)
      expect(diffMs).toBeLessThan(3.1 * 86400000)
    })
  })

  describe('exportLeadsCSV', () => {
    it('rejects non-admin', async () => {
      isAdminMock.mockResolvedValue(false)
      await expect(exportLeadsCSV({})).rejects.toThrow(/unauthorized/i)
    })

    it('produces a CSV with headers and an escaped row', async () => {
      const fakeLeads = [
        {
          id: 'u1',
          email: 'a@example.com',
          full_name: 'Mario "Big" Rossi',
          account_type: 'lead',
          lead_expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
          upgraded_from_lead_at: null,
          lead_source: 'landing',
          created_at: '2026-05-20T00:00:00Z',
          marketing_consent_at: '2026-05-20T00:00:00Z',
        },
      ]
      serviceClientFactory.current = () => makeServiceClient({
        profiles: () => makeFromBuilder({ count: 1, data: fakeLeads, error: null }),
      })

      const csv = await exportLeadsCSV({})
      const [header, row] = csv.split('\n')
      expect(header).toContain('Email')
      expect(header).toContain('Nome')
      expect(header).toContain('Status')
      expect(header).toContain('Lead Source')
      expect(row).toContain('a@example.com')
      // The double-quote inside the name must be escaped (RFC 4180)
      expect(row).toContain('Mario ""Big"" Rossi')
      expect(row).toContain('active')
      expect(row).toContain('yes') // marketing consent
    })
  })
})
