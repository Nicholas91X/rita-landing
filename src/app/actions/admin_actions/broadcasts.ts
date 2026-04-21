// src/app/actions/admin_actions/broadcasts.ts
"use server"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, broadcastLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"
import { sendToAll } from "@/lib/push/dispatch"
import { broadcastSchema, type BroadcastInput } from "./broadcasts.schemas"
import type { ActionResult } from "@/lib/security/types"

async function assertAdmin(userId: string): Promise<boolean> {
  const admin = await createServiceRoleClient()
  const { data } = await admin.from("admins").select("user_id").eq("user_id", userId).maybeSingle()
  return !!data
}

async function resolveRecipientIds(
  admin: Awaited<ReturnType<typeof createServiceRoleClient>>,
  input: Pick<BroadcastInput, "targetType" | "targetId">,
): Promise<string[]> {
  if (input.targetType === "all") {
    const { data } = await admin.from("profiles").select("id")
    return (data ?? []).map((r) => r.id as string)
  }
  if (input.targetType === "package") {
    const { data } = await admin.from("user_subscriptions").select("user_id").eq("package_id", input.targetId!)
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
  }
  // level
  const { data: pkgs } = await admin.from("packages").select("id").eq("level_id", input.targetId!)
  const pkgIds = (pkgs ?? []).map((r) => r.id as string)
  if (pkgIds.length === 0) return []
  const { data } = await admin.from("user_subscriptions").select("user_id").in("package_id", pkgIds)
  return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
}

export async function countBroadcastRecipients(
  input: Pick<BroadcastInput, "targetType" | "targetId">,
): Promise<{ total: number; withPush: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertAdmin(user.id))) return { total: 0, withPush: 0 }

  const admin = await createServiceRoleClient()
  const ids = await resolveRecipientIds(admin, input)
  if (ids.length === 0) return { total: 0, withPush: 0 }

  const { data: subs } = await admin.from("push_subscriptions").select("user_id").in("user_id", ids)
  const usersWithPush = new Set((subs ?? []).map((r) => r.user_id as string))
  return { total: ids.length, withPush: usersWithPush.size }
}

export async function sendBroadcast(input: BroadcastInput): Promise<ActionResult<{
  recipients: number
  inApp: number
  pushSent: number
  pushSkipped: number
  pushFailed: number
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autenticato" }
  if (!(await assertAdmin(user.id))) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(broadcastLimiter(), user.id)
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, message: err.message, retryAfter: err.retryAfter }
    throw err
  }

  let parsed: BroadcastInput
  try { parsed = validate(broadcastSchema, input) }
  catch (err) {
    if (err instanceof ValidationError) return { ok: false, message: "Validazione fallita", fieldErrors: err.fieldErrors }
    throw err
  }

  const admin = await createServiceRoleClient()
  const ids = await resolveRecipientIds(admin, parsed)
  if (ids.length === 0) return { ok: false, message: "Nessun destinatario" }

  // Audit log
  await admin.from("admin_notifications").insert({
    user_id: user.id,
    type: "broadcast_sent",
    data: {
      title: parsed.title,
      targetType: parsed.targetType,
      targetId: parsed.targetId ?? null,
      recipients: ids.length,
      channels: parsed.channels,
    },
  })

  let inApp = 0
  if (parsed.channels.inApp) {
    const rows = ids.map((id) => ({
      user_id: id,
      type: "broadcast",
      title: parsed.title,
      message: parsed.body,
    }))
    const { error } = await admin.from("user_notifications").insert(rows)
    if (!error) inApp = rows.length
  }

  let pushSent = 0, pushSkipped = 0, pushFailed = 0
  if (parsed.channels.push) {
    const filter = parsed.targetType === "all" ? undefined
      : parsed.targetType === "package" ? { subscribedTo: parsed.targetId! }
      : { level: parsed.targetId! }
    const r = await sendToAll(admin, { title: parsed.title, body: parsed.body, url: parsed.url, tag: `broadcast-${Date.now()}` }, filter)
    pushSent = r.sent; pushSkipped = r.skipped; pushFailed = r.failed
  }

  return { ok: true, data: { recipients: ids.length, inApp, pushSent, pushSkipped, pushFailed } }
}
