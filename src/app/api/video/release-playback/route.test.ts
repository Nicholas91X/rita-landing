import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const redisStore = new Map<string, { value: string; expiresAt: number }>()

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      get: vi.fn(async (key: string) => {
        const v = redisStore.get(key)
        if (!v || v.expiresAt < Date.now()) return null
        return v.value
      }),
      del: vi.fn(async (key: string) => { redisStore.delete(key); return 1 }),
    })),
  },
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video/release-playback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockAuth(userId: string | null, isAdminFlag = false) {
  return async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: isAdminFlag ? { user_id: userId } : null,
              error: null,
            }),
          }),
        }),
      }),
    })
  }
}

describe("POST /api/video/release-playback", () => {
  beforeEach(() => {
    redisStore.clear()
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    await mockAuth(null)()
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(401)
  })

  it("deletes Redis key when caller matches current lock", async () => {
    await mockAuth("user-1")()
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d1device", deviceLabel: "Chrome Windows", videoId: "v1", startedAt: Date.now() }),
      expiresAt: Date.now() + 60000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(200)
    expect(redisStore.has("playing:user-1")).toBe(false)
  })

  it("does NOT delete when another device holds the lock", async () => {
    await mockAuth("user-1")()
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d2device", deviceLabel: "Safari iOS", videoId: "v1", startedAt: Date.now() }),
      expiresAt: Date.now() + 60000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(200)
    expect(redisStore.has("playing:user-1")).toBe(true)
  })

  it("admin call is a no-op", async () => {
    await mockAuth("admin-1", true)()
    redisStore.set("playing:admin-1", {
      value: JSON.stringify({ deviceId: "d1device", deviceLabel: "Chrome Windows", videoId: "v1", startedAt: Date.now() }),
      expiresAt: Date.now() + 60000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(200)
    expect(redisStore.has("playing:admin-1")).toBe(true)
  })
})
