// src/app/api/video/heartbeat-playback/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const redisStore = new Map<string, { value: string; expiresAt: number }>()

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      get: vi.fn(async (key: string) => {
        const v = redisStore.get(key)
        if (!v || v.expiresAt < Date.now()) { redisStore.delete(key); return null }
        return v.value
      }),
      set: vi.fn(async (key: string, value: string, opts?: { ex?: number }) => {
        redisStore.set(key, { value, expiresAt: Date.now() + (opts?.ex ?? 3600) * 1000 })
        return "OK"
      }),
    })),
  },
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video/heartbeat-playback", {
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

describe("POST /api/video/heartbeat-playback", () => {
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

  it("admin always returns ok", async () => {
    await mockAuth("admin-1", true)()
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(200)
  })

  it("refreshes TTL when key matches same device + same video", async () => {
    await mockAuth("user-1")()
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d1device", deviceLabel: "Chrome Windows", videoId: "v1", startedAt: Date.now() - 10000 }),
      expiresAt: Date.now() + 30000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(200)
  })

  it("returns 409 takenOver with byDevice when key has different device", async () => {
    await mockAuth("user-1")()
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d2device", deviceLabel: "Safari iOS", videoId: "v1", startedAt: Date.now() }),
      expiresAt: Date.now() + 30000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.takenOver).toBe(true)
    expect(body.byDevice.deviceLabel).toBe("Safari iOS")
  })

  it("returns 409 takenOver with byDevice=null when key is absent", async () => {
    await mockAuth("user-1")()
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.takenOver).toBe(true)
    expect(body.byDevice).toBeNull()
  })

  it("returns 409 when videoId differs (user switched video on another device)", async () => {
    await mockAuth("user-1")()
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d1device", deviceLabel: "Chrome Windows", videoId: "v2", startedAt: Date.now() }),
      expiresAt: Date.now() + 30000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device" }))
    expect(res.status).toBe(409)
  })
})
