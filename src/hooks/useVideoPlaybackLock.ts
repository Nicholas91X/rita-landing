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
  onPlay: () => Promise<void>
  onPause: () => void
  onEnded: () => void
  takeover: () => Promise<void>
  dismissError: () => void
}

const HEARTBEAT_INTERVAL_MS = 30_000

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

  const onPlay = useCallback(async () => {
    if (!deviceInfoRef.current) deviceInfoRef.current = getDeviceInfo()

    if (adminBypass) {
      setState("owned")
      return
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
      return
    }

    if ("rateLimited" in res && res.rateLimited) {
      setRetryAfterSec(res.retryAfterSec)
      setState("error")
      return
    }

    if ("blockedBy" in res && res.blockedBy) {
      setBlockedBy(res.blockedBy)
      setState("blocked")
      return
    }

    setState("error")
  }, [adminBypass, startHeartbeat])

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

  const takeover = useCallback(async () => {
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
      return
    }
    if ("rateLimited" in res && res.rateLimited) {
      setRetryAfterSec(res.retryAfterSec)
      setState("error")
      return
    }
    setState("error")
  }, [startHeartbeat])

  const dismissError = useCallback(() => {
    setRetryAfterSec(null)
    setState("idle")
  }, [])

  useEffect(() => {
    return () => {
      stopHeartbeat()
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
