import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { hibpCheck, assertPasswordNotLeaked, LeakedPasswordError } from "./password"

describe("hibpCheck", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 0 for a password not in breach data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "AAAAAA1:3\nBBBBBB2:5\n",
    })
    const count = await hibpCheck("not-really-pwned-random-xyz-42")
    expect(count).toBe(0)
  })

  it("returns breach count when the suffix matches", async () => {
    // SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9999999\nOTHER:1\n",
    })
    const count = await hibpCheck("password")
    expect(count).toBe(9999999)
  })

  it("fail-open on non-ok response (returns 0)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "" })
    const count = await hibpCheck("anything")
    expect(count).toBe(0)
  })

  it("fail-open on fetch rejection (returns 0)", async () => {
    fetchMock.mockRejectedValue(new Error("network"))
    const count = await hibpCheck("anything")
    expect(count).toBe(0)
  })

  it("sends only the first 5 chars of SHA-1 hash (k-anonymity)", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" })
    await hibpCheck("password")
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe("https://api.pwnedpasswords.com/range/5BAA6")
    const calledOpts = fetchMock.mock.calls[0][1] as RequestInit
    expect((calledOpts.headers as Record<string, string>)["Add-Padding"]).toBe("true")
  })
})

describe("assertPasswordNotLeaked", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not throw when count is below threshold", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" })
    await expect(assertPasswordNotLeaked("safe-unique-password")).resolves.toBeUndefined()
  })

  it("throws LeakedPasswordError when threshold met", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "1E4C9B93F3F0682250B6CF8331B7EE68FD8:500\n",
    })
    await expect(assertPasswordNotLeaked("password")).rejects.toThrow(LeakedPasswordError)
  })
})
