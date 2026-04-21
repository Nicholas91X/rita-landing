// src/lib/push/client.ts
// Client-side helpers for the push subscription flow. Browser-only.

export interface SubscribeResult {
  ok: boolean
  reason?: "unsupported" | "permission-denied" | "storage-failed" | "sw-not-ready"
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export async function requestAndSubscribe(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: "permission-denied" }

  const reg = await navigator.serviceWorker.ready
  if (!reg) return { ok: false, reason: "sw-not-ready" }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return { ok: false, reason: "sw-not-ready" }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  })
  if (!res.ok) return { ok: false, reason: "storage-failed" }
  return { ok: true }
}

export async function unsubscribeCurrent(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return true
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await fetch("/api/push/unsubscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  })
  return true
}

export async function subscribeIfMissing(): Promise<void> {
  if (!isPushSupported()) return
  if (Notification.permission !== "granted") return
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return
  await requestAndSubscribe()
}
