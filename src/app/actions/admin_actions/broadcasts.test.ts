// src/app/actions/admin_actions/broadcasts.test.ts
import { describe, it, expect } from "vitest"
import { broadcastSchema } from "./broadcasts.schemas"

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
})
