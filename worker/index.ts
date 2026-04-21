// worker/index.ts
// Merged into the Workbox-generated SW by @ducanh2912/next-pwa at build.
// Runs in ServiceWorkerGlobalScope. KEEP PushPayload IN SYNC with src/lib/push/types.ts.

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
}

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: "Rita", body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icon-192.png",
      badge: payload.badge ?? "/icon-192.png",
      tag: payload.tag,
      renotify: !!payload.tag,
      data: { url: payload.url ?? "/dashboard", ...(payload.data ?? {}) },
    }),
  )
})

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const target = data?.url ?? "/dashboard"
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (const c of clients) {
        if (c.url.startsWith(self.location.origin)) {
          await c.focus()
          if ("navigate" in c) {
            try { await (c as WindowClient).navigate(target) } catch { /* ignore */ }
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

self.addEventListener("pushsubscriptionchange", (event: Event) => {
  event.waitUntil(
    (async () => {
      try {
        const resp = await fetch("/api/push/vapid-public")
        const vapidKey = await resp.text()
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSub.toJSON()),
        })
      } catch {
        // Surfaced on next dispatch as 410 if re-subscribe fails
      }
    })(),
  )
})

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
