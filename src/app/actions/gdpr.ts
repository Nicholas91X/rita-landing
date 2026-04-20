"use server"

import { headers } from "next/headers"
import { Resend } from "resend"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { exportUserData } from "@/lib/gdpr/export"
import { signDeletionToken, verifyDeletionToken, executeAccountDeletion } from "@/lib/gdpr/delete"
import { logGdprAction } from "@/lib/gdpr/audit"
import { enforceRateLimit, exportLimiter, deleteLimiter, RateLimitError } from "@/lib/security/ratelimit"
import type { ActionResult } from "@/lib/security/types"

const resend = new Resend(process.env.RESEND_API_KEY || "placeholder")

export async function requestDataExport(): Promise<ActionResult<{ downloadUrl: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(exportLimiter(), `export:${user.id}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Hai raggiunto il limite di esportazioni. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    // fail-open on Upstash outage
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const blob = await exportUserData(user.id, user.email ?? null)

  const admin = await createServiceRoleClient()
  const path = `${user.id}/export-${Date.now()}.zip`
  const { error: uploadErr } = await admin.storage
    .from("user-exports")
    .upload(path, blob, { contentType: "application/zip" })
  if (uploadErr) {
    console.error("user-exports upload failed:", uploadErr)
    return { ok: false, message: "Errore durante la generazione dell'esportazione." }
  }

  const { data: signed } = await admin.storage
    .from("user-exports")
    .createSignedUrl(path, 60 * 15)
  if (!signed?.signedUrl) {
    return { ok: false, message: "Errore durante la generazione del link." }
  }

  await logGdprAction({
    userId: user.id,
    action: "export",
    ipAddress: ip,
    metadata: { path },
  })

  return { ok: true, data: { downloadUrl: signed.signedUrl } }
}

export async function requestAccountDeletionGdpr(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(deleteLimiter(), `delete:${user.id}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Richiesta già inviata. Riprova tra ${err.retryAfter} secondi se non hai ricevuto l'email.`,
        retryAfter: err.retryAfter,
      }
    }
    // fail-open
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const token = await signDeletionToken(user.id)
  const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm-deletion?token=${encodeURIComponent(token)}`

  try {
    await resend.emails.send({
      from: "Rita Workout <noreply@fitandsmile.it>",
      to: user.email,
      subject: "Conferma la cancellazione del tuo account",
      html: `
        <p>Ciao,</p>
        <p>Hai richiesto la cancellazione del tuo account su Rita Workout. Per completare l'operazione clicca sul link qui sotto (valido 15 minuti):</p>
        <p><a href="${confirmUrl}">Conferma cancellazione</a></p>
        <p>Se non sei stato tu a fare questa richiesta, ignora questa email — il tuo account non verrà toccato.</p>
        <p>Una volta cancellato, l'account non può essere ripristinato.</p>
      `,
    })
  } catch (err) {
    console.error("Deletion email send failed:", err)
    return { ok: false, message: "Errore invio email. Riprova." }
  }

  await logGdprAction({
    userId: user.id,
    action: "delete_request",
    ipAddress: ip,
  })

  return { ok: true, data: undefined }
}

export async function confirmAccountDeletion(token: string): Promise<ActionResult<void>> {
  let payload
  try {
    payload = await verifyDeletionToken(token)
  } catch {
    return { ok: false, message: "Link non valido o scaduto. Richiedi una nuova cancellazione." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== payload.userId) {
    return { ok: false, message: "Devi essere loggato con l'account da cancellare per confermare." }
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  await executeAccountDeletion(user.id, ip)

  // Sign out to clear cookies
  await supabase.auth.signOut()

  return { ok: true, data: undefined }
}
