// src/lib/video-playback-lock.ts
// Client-side helpers for the per-user video playback lock.
// Server-side endpoint handlers live under src/app/api/video/*.

import { parseUserAgent } from "./user-agent"

export interface DeviceInfo {
  id: string
  label: string
}

const STORAGE_KEY = "video_device_id"
let memoryFallbackId: string | null = null

function generateId(): string {
  // crypto.randomUUID is widely available (Node 19+, all modern browsers);
  // fall back to a timestamp+random combo if it's missing (shouldn't happen
  // in supported environments).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  const parsed = parseUserAgent(ua)
  const label = `${parsed.browser} ${parsed.os}`

  // Try localStorage first. If unavailable or throws (Safari private mode),
  // use a process-lifetime in-memory id.
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return { id: existing, label }
    const fresh = generateId()
    localStorage.setItem(STORAGE_KEY, fresh)
    return { id: fresh, label }
  } catch {
    if (!memoryFallbackId) memoryFallbackId = generateId()
    return { id: memoryFallbackId, label }
  }
}

export interface ClaimRequest {
  videoId: string
  deviceId: string
  deviceLabel: string
  force?: boolean
}

export interface ClaimSuccess { ok: true }
export interface ClaimBlocked { ok: false; blockedBy: { deviceLabel: string } }
export interface ClaimRateLimited { ok: false; rateLimited: true; retryAfterSec: number }
export type ClaimResult = ClaimSuccess | ClaimBlocked | ClaimRateLimited | { ok: false; error: true }

export async function callClaim(req: ClaimRequest): Promise<ClaimResult> {
  try {
    const res = await fetch("/api/video/claim-playback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    })
    if (res.status === 200) return { ok: true }
    if (res.status === 409) {
      const body = await res.json()
      return { ok: false, blockedBy: body.blockedBy }
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "30")
      return { ok: false, rateLimited: true, retryAfterSec: retryAfter }
    }
    return { ok: false, error: true }
  } catch {
    return { ok: false, error: true }
  }
}

export interface HeartbeatRequest {
  videoId: string
  deviceId: string
}

export interface HeartbeatOk { ok: true }
export interface HeartbeatTakenOver { ok: false; takenOver: true; byDevice: { deviceLabel: string } | null }
export type HeartbeatResult = HeartbeatOk | HeartbeatTakenOver | { ok: false; error: true }

export async function callHeartbeat(req: HeartbeatRequest): Promise<HeartbeatResult> {
  try {
    const res = await fetch("/api/video/heartbeat-playback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    })
    if (res.status === 200) return { ok: true }
    if (res.status === 409) {
      const body = await res.json()
      return { ok: false, takenOver: true, byDevice: body.byDevice ?? null }
    }
    return { ok: false, error: true }
  } catch {
    return { ok: false, error: true }
  }
}

export function callRelease(req: HeartbeatRequest): void {
  // Fire-and-forget. Use sendBeacon if available (survives tab close);
  // fall back to fetch keepalive.
  const body = JSON.stringify(req)
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" })
      navigator.sendBeacon("/api/video/release-playback", blob)
      return
    }
  } catch { /* fall through */ }
  try {
    fetch("/api/video/release-playback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => { /* ignore */ })
  } catch { /* ignore */ }
}
