// src/app/actions/push.ts
"use server"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { toggleBroadcast } from "@/lib/push/preferences"
import { parseUserAgent } from "@/lib/user-agent"

export interface DeviceRow {
  id: string
  browser: string
  os: string
  created_at: string
  last_used_at: string | null
  last_error: string | null
}

export async function getMyPrefs(): Promise<{ pushBroadcastEnabled: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data } = await supabase
    .from("user_notification_prefs")
    .select("push_broadcast_enabled")
    .eq("user_id", user.id)
    .maybeSingle()
  return { pushBroadcastEnabled: data?.push_broadcast_enabled ?? true }
}

export async function setBroadcastEnabled(enabled: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  await toggleBroadcast(supabase, user.id, enabled)
}

export async function getMyDevices(): Promise<DeviceRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, user_agent, created_at, last_used_at, last_error")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  return (data ?? []).map((d) => {
    const parsed = parseUserAgent(d.user_agent)
    return {
      id: d.id,
      browser: parsed.browser,
      os: parsed.os,
      created_at: d.created_at,
      last_used_at: d.last_used_at,
      last_error: d.last_error,
    }
  })
}

export async function revokeMyDevice(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = await createServiceRoleClient()
  await admin.from("push_subscriptions").delete().eq("id", id).eq("user_id", user.id)
}
