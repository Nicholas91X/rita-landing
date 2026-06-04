// Marketing consent: set/clear profiles.marketing_consent_at, plus a signed
// token so a recipient can unsubscribe straight from an email link (no login).
// Reuses GDPR_DELETE_SECRET with a distinct `purpose` claim so an unsubscribe
// token can never be replayed as a deletion token.

import { SignJWT, jwtVerify } from 'jose'
import type { SupabaseClient } from '@supabase/supabase-js'

const SECRET_NAME = 'GDPR_DELETE_SECRET'
const PURPOSE = 'marketing-unsubscribe'

function secretKey(): Uint8Array {
    const raw = process.env[SECRET_NAME]
    if (!raw) throw new Error(`Missing env var ${SECRET_NAME}`)
    return new TextEncoder().encode(raw)
}

export async function signUnsubscribeToken(
    userId: string,
    expiresInSeconds = 365 * 24 * 60 * 60, // long-lived: an old email may be opened months later
): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    return await new SignJWT({ purpose: PURPOSE })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt(now)
        .setExpirationTime(now + expiresInSeconds)
        .sign(secretKey())
}

export async function verifyUnsubscribeToken(token: string): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (payload.purpose !== PURPOSE) throw new Error('Wrong token purpose')
    if (!payload.sub) throw new Error('Token missing subject')
    return { userId: payload.sub }
}

/** Set (consent=true → now) or clear (consent=false → null) marketing consent. */
export async function setMarketingConsent(
    admin: SupabaseClient,
    userId: string,
    consent: boolean,
): Promise<void> {
    await admin
        .from('profiles')
        .update({ marketing_consent_at: consent ? new Date().toISOString() : null })
        .eq('id', userId)
}

/** Build the absolute unsubscribe URL for an email recipient. */
export async function buildUnsubscribeUrl(userId: string): Promise<string> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fitandsmile.it'
    const token = await signUnsubscribeToken(userId)
    return `${siteUrl}/api/unsubscribe?token=${token}`
}

/**
 * Master email subscription switch backed by profiles.email_unsubscribed_at.
 * subscribe=false → unsubscribed now + clear marketing consent (one off-switch
 * for all bulk email). subscribe=true → re-subscribe. Transactional email is
 * never gated by this.
 */
export async function setEmailSubscription(
    admin: SupabaseClient,
    userId: string,
    subscribe: boolean,
): Promise<void> {
    await admin
        .from('profiles')
        .update(
            subscribe
                ? { email_unsubscribed_at: null }
                : { email_unsubscribed_at: new Date().toISOString(), marketing_consent_at: null },
        )
        .eq('id', userId)
}

/** True if the user currently receives bulk email (email_unsubscribed_at IS NULL). */
export async function getEmailSubscribed(
    client: SupabaseClient,
    userId: string,
): Promise<boolean> {
    const { data } = await client
        .from('profiles')
        .select('email_unsubscribed_at')
        .eq('id', userId)
        .single()
    return !data?.email_unsubscribed_at
}
