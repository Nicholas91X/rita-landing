// src/lib/push/dispatch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./send", () => ({
  sendPush: vi.fn(),
}))
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({ exists: vi.fn() })) },
}))

function makeSupabase(subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
  const deleteFn = vi.fn().mockResolvedValue({ error: null })
  const updateFn = vi.fn().mockResolvedValue({ error: null })
  const select = vi.fn().mockReturnValue({
    eq: () => Promise.resolve({ data: subscriptions, error: null }),
  })
  const prefsSelect = vi.fn().mockReturnValue({
    eq: () => ({ maybeSingle: () => Promise.resolve({ data: { push_broadcast_enabled: true }, error: null }) }),
  })
  return {
    from: vi.fn((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select,
          delete: () => ({ eq: (..._a: unknown[]) => { void _a; return Promise.resolve({ error: null }) } }),
          update: () => ({ eq: (..._a: unknown[]) => { void _a; updateFn(); return Promise.resolve({ error: null }) } }),
        }
      }
      if (table === "user_notification_prefs") {
        return { select: prefsSelect }
      }
      return {}
    }),
    _delete: deleteFn,
    _update: updateFn,
  }
}

describe("sendToUser", () => {
  beforeEach(() => { vi.resetAllMocks() })

  it("sends push to each subscription and returns sent count", async () => {
    const { sendPush } = await import("./send")
    ;(sendPush as ReturnType<typeof vi.fn>).mockResolvedValue({ statusCode: 201 })
    const supabase = makeSupabase([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "e2", p256dh: "p2", auth: "a2" },
    ])
    const { sendToUser } = await import("./dispatch")
    const result = await sendToUser(supabase as never, "user-1", { title: "T", body: "B" }, { category: "transactional" })
    expect(sendPush).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(2)
  })

  it("skips broadcast when preference disabled", async () => {
    const supabase = makeSupabase([{ id: "s1", endpoint: "e1", p256dh: "p", auth: "a" }])
    supabase.from = vi.fn((table: string) => {
      if (table === "user_notification_prefs") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { push_broadcast_enabled: false }, error: null }) }) }) }
      }
      if (table === "push_subscriptions") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "s1" }], error: null }) }) }
      }
      return {}
    }) as never
    const { sendToUser } = await import("./dispatch")
    const result = await sendToUser(supabase as never, "user-1", { title: "T", body: "B" }, { category: "broadcast" })
    expect(result.sent).toBe(0)
    expect(result.skipped).toBeGreaterThan(0)
  })

  it("deletes subscription on 410 Gone", async () => {
    const { sendPush } = await import("./send")
    const err = Object.assign(new Error("gone"), { statusCode: 410 })
    ;(sendPush as ReturnType<typeof vi.fn>).mockRejectedValue(err)

    const deleteCalls: unknown[] = []
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "user_notification_prefs") {
          return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }
        }
        if (table === "push_subscriptions") {
          return {
            select: () => ({ eq: () => Promise.resolve({ data: [{ id: "s1", endpoint: "e", p256dh: "p", auth: "a" }], error: null }) }),
            delete: () => ({ eq: (col: string, val: string) => { deleteCalls.push([col, val]); return Promise.resolve({ error: null }) } }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }
        }
        return {}
      }),
    }
    const { sendToUser } = await import("./dispatch")
    await sendToUser(supabase as never, "user-1", { title: "T", body: "B" }, { category: "transactional" })
    expect(deleteCalls.length).toBeGreaterThan(0)
  })
})
