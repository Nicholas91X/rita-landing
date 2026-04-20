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

type RpcSessionRow = {
  id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  updated_at: string | null
  not_after: string | null
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

  // auth schema is not exposed via PostgREST; use SECURITY DEFINER RPC instead.
  const admin = await createServiceRoleClient()
  const { data, error } = await admin.rpc("list_user_sessions", { p_user_id: user.id })

  if (error) {
    console.error("listMySessions RPC error:", error)
    return { ok: false, message: "Errore durante il caricamento delle sessioni" }
  }

  const rows = (data ?? []) as RpcSessionRow[]
  const sessions: SessionInfo[] = rows.map((s) => ({
    id: s.id,
    user_agent: s.user_agent ?? "Sconosciuto",
    ip: s.ip ?? "—",
    last_active_at: s.updated_at ?? s.created_at,
    is_current: s.id === currentSessionId,
  }))

  return { ok: true, data: sessions }
}

export async function revokeSession(sessionId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  const admin = await createServiceRoleClient()
  const { data, error } = await admin.rpc("revoke_user_session", {
    p_session_id: sessionId,
    p_user_id: user.id,
  })

  if (error) {
    console.error("revokeSession RPC error:", error)
    return { ok: false, message: "Errore durante la revoca" }
  }
  if (!data) {
    return { ok: false, message: "Sessione non trovata" }
  }

  return { ok: true, data: undefined }
}

export async function revokeAllOtherSessions(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  const { error } = await supabase.auth.signOut({ scope: "others" })
  if (error) {
    console.error("signOut(others) error:", error)
    return { ok: false, message: "Errore durante la revoca delle sessioni" }
  }

  return { ok: true, data: undefined }
}
