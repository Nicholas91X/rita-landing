// src/lib/push/preferences.test.ts
import { describe, it, expect, vi } from "vitest"
import { getPrefs, toggleBroadcast } from "./preferences"

function makeSupabaseMock(opts: {
  selectResult?: { data: unknown; error: unknown }
  upsertResult?: { data: unknown; error: unknown }
}) {
  const upsert = vi.fn().mockResolvedValue(opts.upsertResult ?? { data: null, error: null })
  const eq = vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null })
  const maybeSingle = vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null })
  const from = vi.fn().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle }) }),
    upsert: (...args: unknown[]) => {
      upsert(...args)
      return Promise.resolve(opts.upsertResult ?? { data: null, error: null })
    },
  })
  return { from, upsert, eq, maybeSingle } as const
}

describe("getPrefs", () => {
  it("returns default push_broadcast_enabled=true when no row exists", async () => {
    const supabase = makeSupabaseMock({ selectResult: { data: null, error: null } })
    const prefs = await getPrefs(supabase as never, "user-1")
    expect(prefs.push_broadcast_enabled).toBe(true)
  })

  it("returns stored row when present", async () => {
    const supabase = makeSupabaseMock({
      selectResult: { data: { push_broadcast_enabled: false }, error: null },
    })
    const prefs = await getPrefs(supabase as never, "user-1")
    expect(prefs.push_broadcast_enabled).toBe(false)
  })
})

describe("toggleBroadcast", () => {
  it("upserts with user_id and new value", async () => {
    const supabase = makeSupabaseMock({ upsertResult: { data: null, error: null } })
    await toggleBroadcast(supabase as never, "user-1", false)
    expect(supabase.upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      push_broadcast_enabled: false,
      updated_at: expect.any(String),
    })
  })
})
