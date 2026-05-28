import { describe, it, expect, vi } from "vitest"
import { RateLimitError, enforceRateLimit, leadFormLimiter } from "./ratelimit"
import type { Ratelimit } from "@upstash/ratelimit"

function makeMockLimiter(result: {
  success: boolean
  limit: number
  remaining: number
  reset: number
}): Ratelimit {
  return {
    limit: vi.fn().mockResolvedValue(result),
  } as unknown as Ratelimit
}

describe("enforceRateLimit", () => {
  it("passes when success is true", async () => {
    const limiter = makeMockLimiter({
      success: true,
      limit: 5,
      remaining: 3,
      reset: Date.now() + 60000,
    })
    await expect(enforceRateLimit(limiter, "key")).resolves.toBeUndefined()
  })

  it("throws RateLimitError with metadata when success is false", async () => {
    const reset = Date.now() + 60000
    const limiter = makeMockLimiter({
      success: false,
      limit: 5,
      remaining: 0,
      reset,
    })
    try {
      await enforceRateLimit(limiter, "key")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).reset).toBe(reset)
      expect((err as RateLimitError).limit).toBe(5)
    }
  })

  it("passes the provided key to limiter.limit()", async () => {
    const limiter = makeMockLimiter({
      success: true,
      limit: 5,
      remaining: 5,
      reset: Date.now(),
    })
    await enforceRateLimit(limiter, "my-key")
    expect(limiter.limit).toHaveBeenCalledWith("my-key")
  })
})

describe("leadFormLimiter", () => {
  it("returns a limiter for the email scope", () => {
    const l = leadFormLimiter("email")
    expect(l).toBeDefined()
    expect(typeof l.limit).toBe("function")
  })

  it("returns a limiter for the ip scope", () => {
    const l = leadFormLimiter("ip")
    expect(l).toBeDefined()
    expect(typeof l.limit).toBe("function")
  })

  it("returns the same instance for the same scope (memoized)", () => {
    expect(leadFormLimiter("email")).toBe(leadFormLimiter("email"))
    expect(leadFormLimiter("ip")).toBe(leadFormLimiter("ip"))
  })
})
