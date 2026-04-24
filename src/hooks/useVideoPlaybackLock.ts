// src/hooks/useVideoPlaybackLock.ts
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  getDeviceInfo,
  callClaim,
  callHeartbeat,
  callRelease,
} from "@/lib/video-playback-lock"

export type LockState = "idle" | "owned" | "blocked" | "taken-over" | "error"

export interface UseVideoPlaybackLockResult {
  state: LockState
  blockedBy: { deviceLabel: string } | null
  retryAfterSec: number | null
  // onPlay / takeover return the resulting lock state so the caller can
  // force-pause the underlying iframe when the result is anything other than
  // 'owned'. The hook has no handle on the DOM iframe itself.
  onPlay: () => Promise<LockState>
  onPause: () => void
  onEnded: () => void
  takeover: () => Promise<LockState>
  dismissError: () => void
}

// Fires every 10s (was 30s). Device losing the lock now detects takeover
// within one tick, so "Continua qui" on device B pauses device A in ≤10s
// instead of ≤30s. Upstash cost at 10s cadence: ~360 commands per
// video-user-hour, well within free-tier budget (10k/day).
const HEARTBEAT_INTERVAL_MS = 10_000

export function useVideoPlaybackLock(
  videoId: string,
  adminBypass: boolean,
): UseVideoPlaybackLockResult {
  const [state, setState] = useState<LockState>("idle")
  const [blockedBy, setBlockedBy] = useState<{ deviceLabel: string } | null>(null)
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null)

  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceInfoRef = useRef<ReturnType<typeof getDeviceInfo> | null>(null)
  const videoIdRef = useRef(videoId)
  videoIdRef.current = videoId
  // Mirror of state for use inside callbacks without triggering useCallback
  // recomputations. Updated synchronously on every render.
  const stateRef = useRef<LockState>("idle")
  stateRef.current = state
  // Client-side cooldown (epoch ms). While in the future, onPlay refuses to
  // call the API. The 'error' state sticks around for the whole cooldown
  // (instead of being auto-dismissed), so the onPlay guard can short-circuit
  // purely on state and the caller reliably sees a non-'owned' result to
  // trigger a pause.
  const rateLimitedUntilRef = useRef<number>(0)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current)
      heartbeatTimer.current = null
    }
  }, [])

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current || adminBypass) return
    heartbeatTimer.current = setInterval(async () => {
      if (!deviceInfoRef.current) return
      const res = await callHeartbeat({
        videoId: videoIdRef.current,
        deviceId: deviceInfoRef.current.id,
      })
      if ("error" in res && res.error) {
        // network flake — keep trying; don't pause user for transient errors
        return
      }
      if (res.ok) return
      // takenOver or lock missing → transition to taken-over and stop heartbeat
      stopHeartbeat()
      setBlockedBy("takenOver" in res ? (res.byDevice ?? null) : null)
      setState("taken-over")
    }, HEARTBEAT_INTERVAL_MS)
  }, [adminBypass, stopHeartbeat])

  const scheduleCooldownClear = useCallback((ms: number) => {
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(() => {
      rateLimitedUntilRef.current = 0
      cooldownTimer.current = null
      // Drop error state back to idle so the block dialog can reappear on the
      // next play attempt. retryAfterSec clears too.
      setRetryAfterSec(null)
      if (stateRef.current === "error") setState("idle")
    }, ms)
  }, [])

  const onPlay = useCallback(async (): Promise<LockState> => {
    if (!deviceInfoRef.current) deviceInfoRef.current = getDeviceInfo()

    if (adminBypass) {
      setState("owned")
      return "owned"
    }

    // Guard: onPlay fires on every Bunny 'play' postMessage, which can be
    // emitted in rapid succession during seek, buffering, or autoresume. If
    // we're already owned (heartbeat keeps TTL fresh), blocked (dialog is
    // showing), taken-over (dialog is showing), or error (cooldown active),
    // a re-claim is redundant and can exhaust the 10/min rate limit.
    if (stateRef.current === "owned" ||
        stateRef.current === "blocked" ||
        stateRef.current === "taken-over" ||
        stateRef.current === "error") {
      return stateRef.current
    }

    // Defensive: even if state somehow drifted to 'idle' during cooldown
    // (e.g. stale closure, manual dismissError call), refuse the claim.
    if (Date.now() < rateLimitedUntilRef.current) {
      return "error"
    }

    const res = await callClaim({
      videoId: videoIdRef.current,
      deviceId: deviceInfoRef.current.id,
      deviceLabel: deviceInfoRef.current.label,
      force: false,
    })

    if (res.ok) {
      setBlockedBy(null)
      setRetryAfterSec(null)
      setState("owned")
      startHeartbeat()
      return "owned"
    }

    if ("rateLimited" in res && res.rateLimited) {
      rateLimitedUntilRef.current = Date.now() + res.retryAfterSec * 1000
      scheduleCooldownClear(res.retryAfterSec * 1000)
      setRetryAfterSec(res.retryAfterSec)
      setState("error")
      return "error"
    }

    if ("blockedBy" in res && res.blockedBy) {
      setBlockedBy(res.blockedBy)
      setState("blocked")
      return "blocked"
    }

    setState("error")
    return "error"
  }, [adminBypass, startHeartbeat, scheduleCooldownClear])

  const onPause = useCallback(() => {
    stopHeartbeat()
    // state stays 'owned' so resume within TTL is a no-op re-claim
  }, [stopHeartbeat])

  const onEnded = useCallback(() => {
    stopHeartbeat()
    if (!adminBypass && deviceInfoRef.current) {
      callRelease({
        videoId: videoIdRef.current,
        deviceId: deviceInfoRef.current.id,
      })
    }
    setState("idle")
    setBlockedBy(null)
  }, [adminBypass, stopHeartbeat])

  const takeover = useCallback(async (): Promise<LockState> => {
    if (!deviceInfoRef.current) deviceInfoRef.current = getDeviceInfo()
    const res = await callClaim({
      videoId: videoIdRef.current,
      deviceId: deviceInfoRef.current.id,
      deviceLabel: deviceInfoRef.current.label,
      force: true,
    })
    if (res.ok) {
      setBlockedBy(null)
      setRetryAfterSec(null)
      setState("owned")
      startHeartbeat()
      return "owned"
    }
    if ("rateLimited" in res && res.rateLimited) {
      rateLimitedUntilRef.current = Date.now() + res.retryAfterSec * 1000
      scheduleCooldownClear(res.retryAfterSec * 1000)
      setRetryAfterSec(res.retryAfterSec)
      setState("error")
      return "error"
    }
    setState("error")
    return "error"
  }, [startHeartbeat, scheduleCooldownClear])

  const dismissError = useCallback(() => {
    // Only valid dismissal target is the "altro dispositivo" dialog (blocked /
    // taken-over). The rate-limit 'error' state is controlled by the cooldown
    // timer and must NOT be dismissed manually — otherwise a scrub during the
    // cooldown would re-enter onPlay with state='idle' and (were it not for
    // the rateLimitedUntilRef guard) fire fresh claims.
    if (stateRef.current === "error") return
    setRetryAfterSec(null)
    setState("idle")
  }, [])

  useEffect(() => {
    return () => {
      stopHeartbeat()
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
      if (!adminBypass && deviceInfoRef.current) {
        callRelease({
          videoId: videoIdRef.current,
          deviceId: deviceInfoRef.current.id,
        })
      }
    }
  }, [adminBypass, stopHeartbeat])

  return {
    state,
    blockedBy,
    retryAfterSec,
    onPlay,
    onPause,
    onEnded,
    takeover,
    dismissError,
  }
}
