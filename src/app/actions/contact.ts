"use server"

import { headers } from "next/headers"
import { Resend } from "resend"
import { contactSchema } from "./contact.schemas"
import { validate, ValidationError, formDataToObject } from "@/lib/security/validation"
import { enforceRateLimit, contactLimiter, RateLimitError } from "@/lib/security/ratelimit"
import type { ActionResult } from "@/lib/security/types"

const resend = new Resend(process.env.RESEND_API_KEY || "placeholder")

export async function submitContact(formData: FormData): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(contactSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Controlla i campi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  try {
    await enforceRateLimit(contactLimiter(), `contact:${ip}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppi messaggi inviati. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    // fail-open on Upstash outage: accept the message
  }

  try {
    await resend.emails.send({
      from: "Rita Workout <noreply@fitandsmile.it>",
      to: "support@fitandsmile.it",
      replyTo: parsed.email,
      subject: `Contatto dal sito: ${parsed.name}`,
      text: `Da: ${parsed.name} <${parsed.email}>\n\n${parsed.message}`,
    })
  } catch (err) {
    console.error("Contact email send failed:", err)
    return { ok: false, message: "Invio fallito, riprova più tardi." }
  }

  return { ok: true, data: undefined }
}
