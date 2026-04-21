// src/lib/push/dispatch.ts
import type { SupabaseClient } from "@supabase/supabase-js"
import { Redis } from "@upstash/redis"
import { sendPush } from "./send"
import { getPrefs } from "./preferences"
import type { PushPayload, PushCategory, DispatchResult } from "./types"

let _redis: Redis | null = null
function getRedis(): Redis {
  return (_redis ??= Redis.fromEnv())
}

interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  last_error_at?: string | null
}

export interface DispatchOptions {
  category: PushCategory
  idempotencyKey?: string
}

export async function sendToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  if (opts.category === "broadcast") {
    const prefs = await getPrefs(supabase, userId)
    if (!prefs.push_broadcast_enabled) {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
      return { sent: 0, skipped: data?.length ?? 0, failed: 0 }
    }
    const active = await getRedis().exists(`active:${userId}`)
    if (active) {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
      return { sent: 0, skipped: data?.length ?? 0, failed: 0 }
    }
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, last_error_at")
    .eq("user_id", userId)
  if (error) throw error
  if (!subs || subs.length === 0) return { sent: 0, skipped: 0, failed: 0 }

  let sent = 0, skipped = 0, failed = 0
  for (const sub of subs as StoredSubscription[]) {
    try {
      await sendPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString(), last_error: null, last_error_at: null })
        .eq("id", sub.id)
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        skipped++
        continue
      }
      failed++
      const prevErrAt = sub.last_error_at ? new Date(sub.last_error_at).getTime() : 0
      const now = Date.now()
      if (prevErrAt && now - prevErrAt < 7 * 24 * 3600 * 1000) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
      } else {
        await supabase
          .from("push_subscriptions")
          .update({
            last_error: (err as Error).message?.slice(0, 500) ?? "unknown",
            last_error_at: new Date().toISOString(),
          })
          .eq("id", sub.id)
      }
    }
  }
  return { sent, skipped, failed }
}

export interface BroadcastFilter {
  subscribedTo?: string
  level?: string
}

export async function sendToAll(
  supabase: SupabaseClient,
  payload: PushPayload,
  filter?: BroadcastFilter,
): Promise<DispatchResult> {
  const userIds = await resolveBroadcastUserIds(supabase, filter)
  let sent = 0, skipped = 0, failed = 0
  for (const userId of userIds) {
    const r = await sendToUser(supabase, userId, payload, { category: "broadcast" })
    sent += r.sent; skipped += r.skipped; failed += r.failed
  }
  return { sent, skipped, failed }
}

async function resolveBroadcastUserIds(
  supabase: SupabaseClient,
  filter?: BroadcastFilter,
): Promise<string[]> {
  if (!filter || (!filter.subscribedTo && !filter.level)) {
    const { data } = await supabase.from("profiles").select("id")
    return (data ?? []).map((r) => r.id as string)
  }
  if (filter.subscribedTo) {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("package_id", filter.subscribedTo)
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
  }
  if (filter.level) {
    const { data: pkgs } = await supabase
      .from("packages")
      .select("id")
      .eq("level_id", filter.level)
    const pkgIds = (pkgs ?? []).map((r) => r.id as string)
    const { data } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .in("package_id", pkgIds)
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
  }
  return []
}
