// src/lib/push/preferences.ts
import type { SupabaseClient } from "@supabase/supabase-js"

export interface NotificationPrefs {
  push_broadcast_enabled: boolean
}

const defaults: NotificationPrefs = {
  push_broadcast_enabled: true,
}

export async function getPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("user_notification_prefs")
    .select("push_broadcast_enabled")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data ?? defaults
}

export async function toggleBroadcast(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.from("user_notification_prefs").upsert({
    user_id: userId,
    push_broadcast_enabled: enabled,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
