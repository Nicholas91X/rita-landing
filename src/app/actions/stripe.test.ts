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

describe("createCheckoutSession — idempotency", () => {
  beforeEach(() => vi.resetModules())

  it("reuses cached URL on duplicate call within 60s", async () => {
    const stripeCreateSpy = vi.fn()

    vi.doMock("stripe", () => {
      const StripeConstructor = function () {
        return {
          checkout: { sessions: { create: stripeCreateSpy } },
        }
      }
      return { default: StripeConstructor }
    })

    vi.doMock("@/lib/security/ttl-idempotency", () => ({
      claimWithTtl: vi.fn(async () => ({ fresh: false, payload: "https://checkout.stripe.com/cached" })),
      cacheResult: vi.fn(),
    }))

    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => ({ get: () => "https://example.com" })),
    }))

    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "u1", email: "t@example.com" } } }) },
        from: (table: string) => {
          if (table === "packages") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "pkg-1",
                      name: "Pilates",
                      price: 2990,
                      stripe_price_id: "price_xyz",
                      payment_mode: "payment",
                    },
                    error: null,
                  }),
                }),
              }),
            }
          }
          // profiles and user_subscriptions
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }
        },
      }),
      createServiceRoleClient: vi.fn(),
    }))

    const redirectCalls: string[] = []
    vi.doMock("next/navigation", () => ({
      redirect: vi.fn((url: string) => {
        redirectCalls.push(url)
        throw new Error("NEXT_REDIRECT")
      }),
    }))

    const { createCheckoutSession } = await import("./stripe")

    await expect(createCheckoutSession("pkg-1")).rejects.toThrow("NEXT_REDIRECT")
    expect(stripeCreateSpy).not.toHaveBeenCalled()
    expect(redirectCalls).toContain("https://checkout.stripe.com/cached")
  })
})
