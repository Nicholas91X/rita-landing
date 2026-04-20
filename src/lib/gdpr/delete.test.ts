import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { signDeletionToken, verifyDeletionToken } from "./delete"

describe("deletion tokens", () => {
  const originalEnv = process.env.GDPR_DELETE_SECRET
  beforeEach(() => {
    process.env.GDPR_DELETE_SECRET = "test-secret-at-least-32-bytes-long-xxxxxx"
  })
  afterEach(() => {
    process.env.GDPR_DELETE_SECRET = originalEnv
  })

  it("round-trips a userId", async () => {
    const token = await signDeletionToken("user-123")
    const payload = await verifyDeletionToken(token)
    expect(payload.userId).toBe("user-123")
  })

  it("rejects a tampered token", async () => {
    const token = await signDeletionToken("user-123")
    const tampered = token.slice(0, -3) + "xxx"
    await expect(verifyDeletionToken(tampered)).rejects.toThrow()
  })

  it("rejects an expired token", async () => {
    const token = await signDeletionToken("user-123", -1)
    await expect(verifyDeletionToken(token)).rejects.toThrow()
  })
})
