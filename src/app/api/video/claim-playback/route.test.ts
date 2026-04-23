// src/app/api/video/claim-playback/route.test.ts
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
      del: vi.fn(async (key: string) => { redisStore.delete(key); return 1 }),
    })),
  },
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

vi.mock("@/lib/security/ratelimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/ratelimit")>(
    "@/lib/security/ratelimit",
  )
  return {
    ...actual,
    enforceRateLimit: vi.fn(async () => undefined),
    videoPlaybackClaimLimiter: vi.fn(() => ({}) as never),
  }
})

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video/claim-playback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/video/claim-playback", () => {
  beforeEach(() => {
    redisStore.clear()
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    const { createClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device", deviceLabel: "Chrome Windows" }))
    expect(res.status).toBe(401)
  })

  it("admin user bypasses lock and returns 200 without writing Redis", async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { user_id: "admin-1" }, error: null }),
          }),
        }),
      }),
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device", deviceLabel: "Chrome Windows" }))
    expect(res.status).toBe(200)
    expect(redisStore.size).toBe(0)
  })

  it("acquires lock when key is absent", async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device", deviceLabel: "Chrome Windows" }))
    expect(res.status).toBe(200)
    const stored = JSON.parse(redisStore.get("playing:user-1")!.value)
    expect(stored.deviceId).toBe("d1device")
    expect(stored.videoId).toBe("v1")
  })

  it("re-claim by same device + same video returns 200 and refreshes TTL", async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d1device", deviceLabel: "Chrome Windows", videoId: "v1", startedAt: Date.now() - 10000 }),
      expiresAt: Date.now() + 60000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device", deviceLabel: "Chrome Windows" }))
    expect(res.status).toBe(200)
  })

  it("returns 409 blockedBy when a different device holds the lock", async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d2device", deviceLabel: "Safari iOS", videoId: "v1", startedAt: Date.now() }),
      expiresAt: Date.now() + 60000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device", deviceLabel: "Chrome Windows" }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.blockedBy.deviceLabel).toBe("Safari iOS")
  })

  it("force=true overwrites existing lock", async () => {
    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
    redisStore.set("playing:user-1", {
      value: JSON.stringify({ deviceId: "d2device", deviceLabel: "Safari iOS", videoId: "v1", startedAt: Date.now() }),
      expiresAt: Date.now() + 60000,
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ videoId: "v1", deviceId: "d1device", deviceLabel: "Chrome Windows", force: true }))
    expect(res.status).toBe(200)
    const stored = JSON.parse(redisStore.get("playing:user-1")!.value)
    expect(stored.deviceId).toBe("d1device")
  })
})
