// src/lib/video-playback-lock.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"

describe("getDeviceInfo", () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        _store: new Map<string, string>(),
        getItem(k: string) { return this._store.get(k) ?? null },
        setItem(k: string, v: string) { this._store.set(k, v) },
        removeItem(k: string) { this._store.delete(k) },
        clear() { this._store.clear() },
      },
      configurable: true,
    })
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" },
      configurable: true,
    })
  })

  it("generates a new UUID when localStorage key is absent", async () => {
    const { getDeviceInfo } = await import("./video-playback-lock")
    const info = getDeviceInfo()
    expect(info.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem("video_device_id")).toBe(info.id)
  })

  it("returns the stable stored UUID on subsequent calls", async () => {
    const { getDeviceInfo } = await import("./video-playback-lock")
    const a = getDeviceInfo()
    const b = getDeviceInfo()
    expect(a.id).toBe(b.id)
  })

  it("returns a label derived from navigator.userAgent", async () => {
    const { getDeviceInfo } = await import("./video-playback-lock")
    const info = getDeviceInfo()
    expect(info.label).toBe("Chrome Windows")
  })

  it("falls back to an in-memory UUID when localStorage throws", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem() { return null },
        setItem() { throw new Error("QuotaExceeded") },
        removeItem() {},
        clear() {},
      },
      configurable: true,
    })
    const { getDeviceInfo } = await import("./video-playback-lock")
    const a = getDeviceInfo()
    const b = getDeviceInfo()
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(a.id).toBe(b.id)
  })
})
