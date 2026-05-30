import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockGenerateLink,
  mockUpdateUser,
  mockSendEmail,
  mockGetUser,
  mockServiceUpdate,
  mockServiceEq,
  mockServiceIs,
  mockServiceFrom,
  mockClientGetUser,
  mockHibp,
} = vi.hoisted(() => ({
  mockGenerateLink: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockSendEmail: vi.fn(),
  mockGetUser: vi.fn(),
  mockServiceUpdate: vi.fn(),
  mockServiceEq: vi.fn(),
  mockServiceIs: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockClientGetUser: vi.fn(),
  mockHibp: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (k: string) => (k === "x-forwarded-for" ? "1.2.3.4" : null),
  })),
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockClientGetUser,
      updateUser: mockUpdateUser,
    },
  })),
  createServiceRoleClient: vi.fn(async () => ({
    auth: {
      admin: { generateLink: mockGenerateLink },
    },
    from: mockServiceFrom,
  })),
}))

vi.mock("@/lib/email", () => ({
  sendLeadMagicLinkEmail: mockSendEmail,
}))

vi.mock("@/lib/security/ratelimit", () => ({
  leadFormLimiter: vi.fn(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60000,
    }),
  })),
  enforceRateLimit: vi.fn(async () => undefined),
  RateLimitError: class extends Error {
    retryAfter = 60
  },
}))

vi.mock("@/lib/security/password", () => ({
  assertPasswordNotLeaked: mockHibp,
  LeakedPasswordError: class extends Error {},
}))

import {
  requestLeadMagicLink,
  upgradeLeadToStandard,
  markCompletionModalShown,
} from "./lead"

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test"

  // default chainable service-role client builder
  const chain = {
    update: mockServiceUpdate.mockReturnThis(),
    eq: mockServiceEq.mockReturnThis(),
    is: mockServiceIs.mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined,
  }
  mockServiceFrom.mockReturnValue(chain)

  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "u-1",
        email: "mario@example.com",
        user_metadata: {},
        created_at: "",
        last_sign_in_at: "",
      },
    },
  })
  mockClientGetUser.mockResolvedValue({
    data: {
      user: { id: "u-1", email: "mario@example.com" },
    },
  })
  mockHibp.mockResolvedValue(undefined)
})

describe("requestLeadMagicLink", () => {
  it("rejects invalid input (bad email, short name)", async () => {
    const fd = new FormData()
    fd.append("full_name", "a")
    fd.append("email", "not-an-email")
    fd.append("terms_accepted", "on")
    const res = await requestLeadMagicLink(fd)
    expect(res.ok).toBe(false)
    if (res.ok === false) {
      expect(res.fieldErrors).toBeDefined()
    }
  })

  it("rejects when terms_accepted is missing", async () => {
    const fd = new FormData()
    fd.append("full_name", "Mario Rossi")
    fd.append("email", "mario@example.com")
    const res = await requestLeadMagicLink(fd)
    expect(res.ok).toBe(false)
  })

  it("generates link and sends Resend email on valid input", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc123" } },
      error: null,
    })
    mockSendEmail.mockResolvedValue(undefined)

    const fd = new FormData()
    fd.append("full_name", "Mario Rossi")
    fd.append("email", "mario@example.com")
    fd.append("terms_accepted", "on")
    fd.append("marketing_consent", "on")

    const res = await requestLeadMagicLink(fd)

    expect(res.ok).toBe(true)
    expect(mockGenerateLink).toHaveBeenCalledOnce()
    const call = mockGenerateLink.mock.calls[0][0]
    expect(call.type).toBe("magiclink")
    expect(call.email).toBe("mario@example.com")
    expect(call.options.data.account_type).toBe("lead")
    expect(call.options.data.full_name).toBe("Mario Rossi")
    expect(typeof call.options.data.marketing_consent_at).toBe("string")
    expect(call.options.data.lead_source).toBe("landing")

    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail.mock.calls[0][2]).toContain("token_hash=abc123")
    expect(mockSendEmail.mock.calls[0][2]).toContain("type=magiclink")
  })

  it("sets marketing_consent_at to null when checkbox not ticked", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: "tok" } },
      error: null,
    })
    mockSendEmail.mockResolvedValue(undefined)

    const fd = new FormData()
    fd.append("full_name", "Mario")
    fd.append("email", "m@e.com")
    fd.append("terms_accepted", "on")

    await requestLeadMagicLink(fd)

    const call = mockGenerateLink.mock.calls[0][0]
    expect(call.options.data.marketing_consent_at).toBeNull()
  })

  it("returns generation error message when generateLink fails", async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    })
    const fd = new FormData()
    fd.append("full_name", "Mario")
    fd.append("email", "m@e.com")
    fd.append("terms_accepted", "on")
    const res = await requestLeadMagicLink(fd)
    expect(res.ok).toBe(false)
  })
})

describe("upgradeLeadToStandard", () => {
  it("rejects invalid password", async () => {
    const fd = new FormData()
    fd.append("password", "short")
    const res = await upgradeLeadToStandard(fd)
    expect(res.ok).toBe(false)
  })

  it("rejects when user is not authenticated", async () => {
    mockClientGetUser.mockResolvedValue({ data: { user: null } })
    const fd = new FormData()
    fd.append("password", "ValidPass123!")
    const res = await upgradeLeadToStandard(fd)
    expect(res.ok).toBe(false)
  })

  it("updates password and flips account_type on success", async () => {
    mockUpdateUser.mockResolvedValue({ error: null })

    const fd = new FormData()
    fd.append("password", "ValidPass123!")
    const res = await upgradeLeadToStandard(fd)

    expect(res.ok).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "ValidPass123!" })
    expect(mockServiceFrom).toHaveBeenCalledWith("profiles")
    expect(mockServiceUpdate).toHaveBeenCalled()
    const updatePayload = mockServiceUpdate.mock.calls[0][0]
    expect(updatePayload.account_type).toBe("standard")
    expect(updatePayload.lead_expires_at).toBeNull()
    expect(typeof updatePayload.upgraded_from_lead_at).toBe("string")
  })
})

describe("markCompletionModalShown", () => {
  it("no-ops when user is unauthenticated", async () => {
    mockClientGetUser.mockResolvedValue({ data: { user: null } })
    await markCompletionModalShown()
    expect(mockServiceFrom).not.toHaveBeenCalled()
  })

  it("updates profiles.completion_modal_shown_at idempotently", async () => {
    await markCompletionModalShown()
    expect(mockServiceFrom).toHaveBeenCalledWith("profiles")
    expect(mockServiceUpdate).toHaveBeenCalled()
    expect(mockServiceIs).toHaveBeenCalledWith(
      "completion_modal_shown_at",
      null,
    )
  })
})
