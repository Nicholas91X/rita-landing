// src/app/actions/stripe.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Hoist the spy so we can reference it inside the factory
const stripeUpdateSpy = vi.fn()

vi.mock("stripe", () => ({
  default: function MockStripe() {
    return { subscriptions: { update: stripeUpdateSpy } }
  },
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

vi.mock("@/lib/push/dispatch", () => ({ sendToUser: vi.fn() }))

describe("cancelSubscription — dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("early-returns ok:true without calling Stripe when sub already has cancel_at_period_end=true", async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")

    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  stripe_subscription_id: "stripe-sub-1",
                  current_period_end: "2026-05-22",
                  cancel_at_period_end: true,
                  packages: { name: "BALI" },
                },
                error: null,
              }),
            }),
          }),
        }),
        update: () => ({ eq: async () => ({}) }),
      }),
    })

    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ insert: vi.fn(async () => ({})) }),
    })

    const { cancelSubscription } = await import("./stripe")
    const r = await cancelSubscription({ subscriptionId: "a0000000-0000-4000-8000-000000000001" })

    expect(r.ok).toBe(true)
    expect(stripeUpdateSpy).not.toHaveBeenCalled()
  })
})

describe("requestRefund — dedup", () => {
  beforeEach(() => vi.resetModules())

  it("rejects with 'già in corso' when a pending row exists", async () => {
    vi.doMock("@/lib/security/ratelimit", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/security/ratelimit")>()
      return {
        ...original,
        enforceRateLimit: vi.fn(async () => undefined),
      }
    })

    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "u1", email: "test@example.com" } } }) },
        from: (table: string) => {
          if (table === "user_subscriptions") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    single: async () => ({
                      data: {
                        created_at: new Date().toISOString(),
                        packages: { name: "Pilates" },
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }
          }
          if (table === "refund_requests") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: () => ({
                      maybeSingle: async () => ({
                        data: { id: "existing-id", status: "pending" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }
          }
          return { insert: async () => ({ error: null }) }
        },
      }),
      createServiceRoleClient: vi.fn(),
    }))

    vi.doMock("@/lib/push/dispatch", () => ({ sendToUser: vi.fn() }))

    // Reimport the module fresh after doMock
    const { requestRefund } = await import("./stripe")
    const result = await requestRefund({
      id: "a0000000-0000-4000-8000-000000000001",
      reason: "non più interessato",
      type: "subscription",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/già in corso/)
    }
  })
})
