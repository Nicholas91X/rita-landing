// src/hooks/useVideoPlaybackLock.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useVideoPlaybackLock } from "./useVideoPlaybackLock"

vi.mock("@/lib/video-playback-lock", () => ({
  getDeviceInfo: vi.fn(() => ({ id: "device-1", label: "Chrome Windows" })),
  callClaim: vi.fn(),
  callHeartbeat: vi.fn(),
  callRelease: vi.fn(),
}))

describe("useVideoPlaybackLock", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("admin bypass: onPlay returns owned state without fetching", async () => {
    const { callClaim } = await import("@/lib/video-playback-lock")
    const { result } = renderHook(() => useVideoPlaybackLock("v1", true))
    await act(async () => { await result.current.onPlay() })
    expect(result.current.state).toBe("owned")
    expect(callClaim).not.toHaveBeenCalled()
  })

  it("on claim 200 transitions idle → owned", async () => {
    const { callClaim } = await import("@/lib/video-playback-lock")
    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useVideoPlaybackLock("v1", false))
    await act(async () => { await result.current.onPlay() })
    expect(result.current.state).toBe("owned")
  })

  it("on claim 409 blockedBy transitions to blocked + exposes device label", async () => {
    const { callClaim } = await import("@/lib/video-playback-lock")
    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      blockedBy: { deviceLabel: "Safari iOS" },
    })
    const { result } = renderHook(() => useVideoPlaybackLock("v1", false))
    await act(async () => { await result.current.onPlay() })
    expect(result.current.state).toBe("blocked")
    expect(result.current.blockedBy?.deviceLabel).toBe("Safari iOS")
  })

  it("takeover() calls claim with force=true", async () => {
    const { callClaim } = await import("@/lib/video-playback-lock")
    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      blockedBy: { deviceLabel: "Safari iOS" },
    })
    const { result } = renderHook(() => useVideoPlaybackLock("v1", false))
    await act(async () => { await result.current.onPlay() })

    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    await act(async () => { await result.current.takeover() })
    expect(callClaim).toHaveBeenLastCalledWith(expect.objectContaining({ force: true }))
    expect(result.current.state).toBe("owned")
  })

  it("on heartbeat 409 takenOver transitions owned → taken-over", async () => {
    const { callClaim, callHeartbeat } = await import("@/lib/video-playback-lock")
    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    ;(callHeartbeat as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, takenOver: true, byDevice: { deviceLabel: "Safari iOS" },
    })
    const { result } = renderHook(() => useVideoPlaybackLock("v1", false))
    await act(async () => { await result.current.onPlay() })
    expect(result.current.state).toBe("owned")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await waitFor(() => {
      expect(result.current.state).toBe("taken-over")
    })
    expect(result.current.blockedBy?.deviceLabel).toBe("Safari iOS")
  })

  it("onEnded calls release and transitions to idle", async () => {
    const { callClaim, callRelease } = await import("@/lib/video-playback-lock")
    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useVideoPlaybackLock("v1", false))
    await act(async () => { await result.current.onPlay() })
    act(() => { result.current.onEnded() })
    expect(callRelease).toHaveBeenCalledWith({ videoId: "v1", deviceId: "device-1" })
    expect(result.current.state).toBe("idle")
  })

  it("onPause stops heartbeat without calling release", async () => {
    const { callClaim, callHeartbeat, callRelease } = await import("@/lib/video-playback-lock")
    ;(callClaim as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    ;(callHeartbeat as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useVideoPlaybackLock("v1", false))
    await act(async () => { await result.current.onPlay() })

    act(() => { result.current.onPause() })
    ;(callHeartbeat as ReturnType<typeof vi.fn>).mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(callHeartbeat).not.toHaveBeenCalled()
    expect(callRelease).not.toHaveBeenCalled()
  })
})
