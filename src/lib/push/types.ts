// src/lib/push/types.ts
// Contract between server dispatch and service worker push handler.
// KEEP IN SYNC with worker/index.ts (TypeScript does not reach worker files).

export interface PushPayload {
  title: string            // max 50 chars (iOS lockscreen truncates)
  body: string             // max 150 chars (safe across platforms)
  url?: string             // deep-link on click, defaults to /dashboard
  tag?: string             // dedup key; pairs with renotify=true
  icon?: string            // defaults to /icon-192.png
  badge?: string           // defaults to /icon-192.png (iOS ignores)
  data?: Record<string, unknown>
}

export type PushCategory = 'transactional' | 'broadcast'

export interface DispatchResult {
  sent: number
  skipped: number
  failed: number
}
