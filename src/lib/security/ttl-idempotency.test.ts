// src/lib/security/ttl-idempotency.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@upstash/redis", () => {
  const store = new Map<string, { value: string; expiresAt: number }>()
  return {
    Redis: {
      fromEnv: vi.fn(() => ({
        set: vi.fn(async (key: string, value: string, opts?: { nx?: boolean; ex?: number }) => {
          const now = Date.now()
          const existing = store.get(key)
          if (existing && existing.expiresAt > now && opts?.nx) return null
          const expiresAt = opts?.ex ? now + opts.ex * 1000 : now + 3600_000
          store.set(key, { value, expiresAt })
          return "OK"
        }),
        get: vi.fn(async (key: string) => {
          const v = store.get(key)
          if (!v || v.expiresAt < Date.now()) {
            store.delete(key)
            return null
          }
          return v.value
        }),
      })),
    },
  }
})

describe("claimWithTtl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns { fresh: true } on first call for a key", async () => {
    const { claimWithTtl } = await import("./ttl-idempotency")
    const r = await claimWithTtl("test-key-1", { ttlSeconds: 60 })
    expect(r.fresh).toBe(true)
  })

  it("returns { fresh: false } on second call within TTL", async () => {
    const { claimWithTtl } = await import("./ttl-idempotency")
    await claimWithTtl("test-key-2", { ttlSeconds: 60 })
    const second = await claimWithTtl("test-key-2", { ttlSeconds: 60 })
    expect(second.fresh).toBe(false)
  })

  it("stores and returns cached payload on duplicate", async () => {
    const { claimWithTtl } = await import("./ttl-idempotency")
    await claimWithTtl("test-key-3", { ttlSeconds: 60, payload: "https://stripe.com/checkout/abc" })
    const second = await claimWithTtl("test-key-3", { ttlSeconds: 60 })
    expect(second.fresh).toBe(false)
    expect(second.payload).toBe("https://stripe.com/checkout/abc")
  })
})
