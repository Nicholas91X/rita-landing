"use server"

import { decodeJwt } from "jose"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import type { ActionResult } from "@/lib/security/types"

export type SessionInfo = {
  id: string
  user_agent: string
  ip: string
  last_active_at: string
  is_current: boolean
}

async function getCurrentSessionId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  try {
    const claims = decodeJwt(token) as { session_id?: string }
    return claims.session_id ?? null
  } catch {
    return null
  }
}

export async function listMySessions(): Promise<ActionResult<SessionInfo[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  const currentSessionId = await getCurrentSessionId()

  // Supabase Auth doesn't expose a session-list admin API in this SDK version,
  // so we query auth.sessions directly with the service-role client.
  const admin = await createServiceRoleClient()
  const { data, error } = await admin
    .schema("auth")
    .from("sessions")
    .select("id, user_agent, ip, updated_at, created_at, not_after")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("listMySessions query error:", error)
    return { ok: false, message: "Errore durante il caricamento delle sessioni" }
  }

  const now = Date.now()
  const sessions = (data ?? [])
    .filter((s) => !s.not_after || new Date(s.not_after).getTime() > now)
    .map((s) => ({
      id: s.id as string,
      user_agent: (s.user_agent as string) ?? "Sconosciuto",
      ip: (s.ip as string) ?? "—",
      last_active_at: (s.updated_at as string) ?? (s.created_at as string),
      is_current: s.id === currentSessionId,
    }))

  return { ok: true, data: sessions }
}

export async function revokeSession(sessionId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  const admin = await createServiceRoleClient()
  // Verify ownership before deleting (prevents revoking other users' sessions).
  const { data: owned, error: ownErr } = await admin
    .schema("auth")
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (ownErr || !owned) {
    return { ok: false, message: "Sessione non trovata" }
  }

  const { error } = await admin
    .schema("auth")
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (error) {
    console.error("revokeSession delete error:", error)
    return { ok: false, message: "Errore durante la revoca" }
  }

  return { ok: true, data: undefined }
}

export async function revokeAllOtherSessions(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  // scope:'others' logs out every session except the current one.
  const { error } = await supabase.auth.signOut({ scope: "others" })
  if (error) {
    console.error("signOut(others) error:", error)
    return { ok: false, message: "Errore durante la revoca delle sessioni" }
  }

  return { ok: true, data: undefined }
}
