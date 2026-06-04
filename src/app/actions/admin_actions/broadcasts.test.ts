// src/app/actions/admin_actions/broadcasts.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── hoisted mocks ────────────────────────────────────────────────────────────

const { sendCommunityBatchMock } = vi.hoisted(() => ({
  sendCommunityBatchMock: vi.fn().mockResolvedValue({ data: {}, error: null }),
}))
vi.mock("@/lib/email", () => ({
  sendCommunityBatch: sendCommunityBatchMock,
}))

vi.mock("@/lib/marketing-consent", () => ({
  buildUnsubscribeUrl: vi.fn(async (userId: string) => `https://x/api/unsubscribe?token=${userId}`),
}))

vi.mock("@/lib/push/dispatch", () => ({
  sendToAll: vi.fn().mockResolvedValue({ sent: 0, skipped: 0, failed: 0 }),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {},
  broadcastLimiter: vi.fn(() => ({})),
}))

// State for the supabase mock — each test controls what rows come back.
// The mock simulates `email_unsubscribed_at IS NULL` filtering by checking
// if `.is("email_unsubscribed_at", null)` was called in the chain.
type Profile = {
  id: string
  email: string | null
  full_name: string | null
  email_unsubscribed_at: string | null
  account_type?: string
}

type MockState = {
  adminRows: Profile[]
  isAdmin: boolean
  auditInsertError: { message: string } | null
  inAppInsertError: { message: string } | null
}

const { state } = vi.hoisted(() => ({
  state: {
    adminRows: [] as Profile[],
    isAdmin: true,
    auditInsertError: null,
    inAppInsertError: null,
  } satisfies MockState,
}))

// Build a chainable query builder for `profiles` that tracks which filters
// have been applied so we can simulate server-side filtering in `then`.
function buildProfilesQuery() {
  let filterUnsubNull = false
  let filterEmail = false // .not("email", "is", null) → only keep rows with email

  const q: Record<string, unknown> = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    // .is("email_unsubscribed_at", null) → filter to subscribed-only
    is: vi.fn((col: string, val: unknown) => {
      if (col === "email_unsubscribed_at" && val === null) filterUnsubNull = true
      return q
    }),
    // .not("email", "is", null) → filter to rows with email
    not: vi.fn((col: string) => {
      if (col === "email") filterEmail = true
      return q
    }),
    in: vi.fn(() => q),
    then: (resolve: (v: unknown) => unknown) => {
      let rows = state.adminRows
      if (filterUnsubNull) {
        rows = rows.filter((r) => r.email_unsubscribed_at === null)
      }
      if (filterEmail) {
        rows = rows.filter((r) => r.email !== null)
      }
      return Promise.resolve({ data: rows, error: null }).then(resolve)
    },
  }
  return q
}

function buildServiceClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "admins") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: state.isAdmin ? { user_id: "admin-1" } : null,
            error: null,
          }),
        }
      }
      if (table === "profiles") {
        return buildProfilesQuery()
      }
      if (table === "push_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }
      }
      if (table === "admin_notifications") {
        return {
          insert: vi.fn().mockResolvedValue({ error: state.auditInsertError }),
        }
      }
      if (table === "user_notifications") {
        return {
          insert: vi.fn().mockResolvedValue({ error: state.inAppInsertError }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      }
    }),
  }
}

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }),
    },
  })),
  createServiceRoleClient: vi.fn(async () => buildServiceClient()),
}))

import { broadcastSchema } from "./broadcasts.schemas"
import { sendBroadcast } from "./broadcasts"

// ─── schema tests ─────────────────────────────────────────────────────────────

describe("broadcastSchema", () => {
  it("requires targetId when targetType is package", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao", body: "Messaggio test",
      url: "/dashboard",
      targetType: "package",
      channels: { inApp: true, push: true, email: false },
    })
    expect(r.success).toBe(false)
  })

  it("passes with all + channels", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao", body: "Messaggio test",
      url: "/dashboard",
      targetType: "all",
      channels: { inApp: true, push: true, email: false },
    })
    expect(r.success).toBe(true)
  })

  it("rejects url not starting with /", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao", body: "Messaggio test",
      url: "https://evil.com",
      targetType: "all",
      channels: { inApp: true, push: true, email: false },
    })
    expect(r.success).toBe(false)
  })

  it("passes with lead target (no targetId required)", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao Community", body: "Messaggio test ok",
      url: "/dashboard",
      targetType: "lead",
      channels: { inApp: false, push: false, email: true },
    })
    expect(r.success).toBe(true)
  })

  it("accepts emailBody up to 2000 chars", () => {
    const r = broadcastSchema.safeParse({
      title: "Titolo ok", body: "Corpo breve ok.",
      emailBody: "a".repeat(2000),
      url: "/dashboard",
      targetType: "all",
      channels: { inApp: true, push: false, email: true },
    })
    expect(r.success).toBe(true)
  })

  it("rejects emailBody over 2000 chars", () => {
    const r = broadcastSchema.safeParse({
      title: "Titolo ok", body: "Corpo breve ok.",
      emailBody: "a".repeat(2001),
      url: "/dashboard",
      targetType: "all",
      channels: { inApp: true, push: false, email: true },
    })
    expect(r.success).toBe(false)
  })

  it("rejects title over 80 chars", () => {
    const r = broadcastSchema.safeParse({
      title: "a".repeat(81), body: "Corpo ok.",
      url: "/dashboard",
      targetType: "all",
      channels: { inApp: true, push: false, email: false },
    })
    expect(r.success).toBe(false)
  })
})

// ─── email channel tests ──────────────────────────────────────────────────────

describe("sendBroadcast — canale email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isAdmin = true
    state.adminRows = []
    state.auditInsertError = null
    state.inAppInsertError = null
    process.env.NEXT_PUBLIC_SITE_URL = "https://x"
    process.env.GDPR_DELETE_SECRET = "test-secret-32-chars-long-enough!!"
  })

  it("canale email: invia solo ai lead iscritti via sendCommunityBatch", async () => {
    // Two leads: one subscribed (email_unsubscribed_at null), one unsubscribed.
    // resolveRecipientIds filters on email_unsubscribed_at IS NULL → returns u1 only.
    // Email channel query also filters on IS NULL → same result.
    state.adminRows = [
      { id: "u1", email: "mara@e.com", full_name: "Mara", email_unsubscribed_at: null, account_type: "lead" },
      { id: "u2", email: "gone@e.com", full_name: "Gone", email_unsubscribed_at: "2026-01-01T00:00:00Z", account_type: "lead" },
    ]

    const result = await sendBroadcast({
      title: "Nuovo video",
      body: "Corpo breve qui ok",
      emailBody: "Testo lungo per l'email.",
      url: "/dashboard",
      targetType: "lead",
      channels: { inApp: false, push: false, email: true },
    })

    expect(result.ok).toBe(true)
    expect(sendCommunityBatchMock).toHaveBeenCalledOnce()
    // Recipients list contains only the subscribed lead
    const recipients = sendCommunityBatchMock.mock.calls[0][0] as Array<{ email: string }>
    expect(recipients).toHaveLength(1)
    expect(recipients[0].email).toBe("mara@e.com")
  })

  it("canale email: non chiama sendCommunityBatch se nessun destinatario con email", async () => {
    // Lead has no email — email channel should skip sending
    state.adminRows = [
      { id: "u3", email: null, full_name: "NoMail", email_unsubscribed_at: null, account_type: "lead" },
    ]

    const result = await sendBroadcast({
      title: "Nuovo video",
      body: "Corpo breve qui ok",
      url: "/dashboard",
      targetType: "lead",
      channels: { inApp: false, push: false, email: true },
    })

    // sendCommunityBatch should not be called when no valid recipients
    expect(sendCommunityBatchMock).not.toHaveBeenCalled()
    if (result.ok) {
      expect(result.data.emailSent).toBe(0)
    }
  })

  it("canale email: emailSent è incluso nel risultato", async () => {
    state.adminRows = [
      { id: "u4", email: "anna@e.com", full_name: "Anna", email_unsubscribed_at: null, account_type: "lead" },
    ]

    const result = await sendBroadcast({
      title: "Test email ok",
      body: "Corpo breve qui ok",
      url: "/dashboard",
      targetType: "lead",
      channels: { inApp: false, push: false, email: true },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.emailSent).toBe(1)
    }
  })
})
