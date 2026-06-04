// src/app/actions/admin_actions/broadcasts.ts
"use server"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, broadcastLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"
import { sendToAll } from "@/lib/push/dispatch"
import { sendCommunityBatch } from "@/lib/email"
import { buildUnsubscribeUrl } from "@/lib/marketing-consent"
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
  if (input.targetType === "lead") {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("account_type", "lead")
      .is("email_unsubscribed_at", null)
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

export async function getBroadcastTargets(): Promise<{
  levels: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string }>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertAdmin(user.id))) return { levels: [], packages: [] }
  const admin = await createServiceRoleClient()
  const [lv, pk] = await Promise.all([
    admin.from("levels").select("id, name").order("name"),
    admin.from("packages").select("id, name").order("name"),
  ])
  return {
    levels: (lv.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string })),
    packages: (pk.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string })),
  }
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
  emailSent: number
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

  let emailSent = 0
  if (parsed.channels.email) {
    const { data: recips } = await admin
      .from("profiles")
      .select("id, email, full_name, email_unsubscribed_at")
      .in("id", ids)
      .is("email_unsubscribed_at", null)
      .not("email", "is", null)
    const list = (recips ?? []) as Array<{ id: string; email: string; full_name: string | null }>
    if (list.length > 0) {
      const recipients = await Promise.all(
        list.map(async (r) => ({
          email: r.email,
          name: r.full_name ?? "",
          unsubscribeUrl: await buildUnsubscribeUrl(r.id),
        })),
      )
      // Resend batch caps at 100 per call; chunk for safety.
      for (let i = 0; i < recipients.length; i += 100) {
        await sendCommunityBatch(
          recipients.slice(i, i + 100),
          parsed.title,
          parsed.emailBody ?? parsed.body,
          parsed.url.startsWith("/") ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.fitandsmile.it"}${parsed.url}` : parsed.url,
          "SCOPRI",
        )
      }
      emailSent = recipients.length
    }
  }

  return { ok: true, data: { recipients: ids.length, inApp, pushSent, pushSkipped, pushFailed, emailSent } }
}
