'use server'

import { headers } from 'next/headers'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sendLeadMagicLinkEmail, sendLeadInternalNotification } from '@/lib/email'
import {
  enforceRateLimit,
  leadFormLimiter,
  RateLimitError,
} from '@/lib/security/ratelimit'
import {
  validate,
  ValidationError,
  formDataToObject,
} from '@/lib/security/validation'
import {
  assertPasswordNotLeaked,
  LeakedPasswordError,
} from '@/lib/security/password'
import { leadFormSchema, upgradeLeadSchema } from './lead.schemas'
import type { ActionResult } from '@/lib/security/types'

export async function requestLeadMagicLink(
  formData: FormData,
): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(leadFormSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        ok: false,
        message: 'Dati non validi',
        fieldErrors: err.fieldErrors,
      }
    }
    throw err
  }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  try {
    await enforceRateLimit(leadFormLimiter('email'), `lead:email:${parsed.email}`)
    await enforceRateLimit(leadFormLimiter('ip'), `lead:ip:${ip}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppe richieste. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    // fail-open on Upstash outage
  }

  const admin = await createServiceRoleClient()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fitandsmile.it'

  // Create the lead user up-front. generateLink({type:'magiclink'}) does NOT
  // create users — for a never-seen email Supabase returns an anti-enumeration
  // placeholder token that always fails verifyOtp ("invalid or has expired").
  // email_confirm:true skips the separate confirmation step (a lead is already
  // proving ownership by clicking the magic link). The lead metadata is read by
  // the handle_new_user trigger to set account_type='lead' on the profile.
  const { error: createErr } = await admin.auth.admin.createUser({
    email: parsed.email,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.full_name,
      account_type: 'lead',
      lead_source: parsed.lead_source ?? 'landing',
      // terms_accepted is required to submit the form, so record the consent
      // timestamp for GDPR audit. The handle_new_user trigger persists it.
      terms_accepted_at: new Date().toISOString(),
      marketing_consent_at: parsed.marketing_consent
        ? new Date().toISOString()
        : null,
    },
  })

  // An already-registered email is fine: an existing user (standard, or a
  // returning lead) simply gets a passwordless login link. No new lead grant —
  // the callback's provisionLeadIfNeeded only acts on account_type='lead' rows
  // whose window hasn't been opened yet.
  const alreadyExists = createErr
    ? /already|exist|registered/i.test(createErr.message)
    : false
  if (createErr && !alreadyExists) {
    console.error('[lead] createUser failed', createErr.message)
    return {
      ok: false,
      message: 'Errore durante la registrazione. Riprova.',
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: parsed.email,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error || !data?.properties?.hashed_token) {
    console.error('[lead] generateLink failed', error?.message)
    return {
      ok: false,
      message: 'Errore durante la generazione del link. Riprova.',
    }
  }

  const magicUrl = `${siteUrl}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`

  try {
    await sendLeadMagicLinkEmail(parsed.email, parsed.full_name, magicUrl)
  } catch (err) {
    console.error('[lead] magic link email send failed', err)
    return {
      ok: false,
      message: "Errore durante l'invio dell'email. Riprova.",
    }
  }

  // Internal team notification — best-effort, never blocks the lead's flow.
  try {
    await sendLeadInternalNotification({
      name: parsed.full_name,
      email: parsed.email,
      marketingConsent: !!parsed.marketing_consent,
      source: parsed.lead_source ?? 'landing',
    })
  } catch (err) {
    console.error('[lead] internal notification send failed', err)
  }

  return { ok: true, data: undefined }
}

export async function upgradeLeadToStandard(
  formData: FormData,
): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(upgradeLeadSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        ok: false,
        message: 'Dati non validi',
        fieldErrors: err.fieldErrors,
      }
    }
    throw err
  }

  try {
    await assertPasswordNotLeaked(parsed.password)
  } catch (err) {
    if (err instanceof LeakedPasswordError) {
      return {
        ok: false,
        message: 'Questa password è compromessa. Scegline una diversa.',
        fieldErrors: { password: ['Password compromessa'] },
      }
    }
    // fail-open on HIBP outage
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Non autorizzato' }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.password,
  })
  if (updateErr) {
    return { ok: false, message: updateErr.message }
  }

  const admin = await createServiceRoleClient()
  await admin
    .from('profiles')
    .update({
      account_type: 'standard',
      upgraded_from_lead_at: new Date().toISOString(),
      lead_expires_at: null,
    })
    .eq('id', user.id)

  return { ok: true, data: undefined }
}

export async function markCompletionModalShown(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const admin = await createServiceRoleClient()
  await admin
    .from('profiles')
    .update({ completion_modal_shown_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('completion_modal_shown_at', null)
}
