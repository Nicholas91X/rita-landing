import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import type { SupabaseClient, User } from '@supabase/supabase-js'

const VALID_OTP_TYPES = ['signup', 'magiclink', 'email', 'recovery', 'invite', 'email_change'] as const
type OtpType = typeof VALID_OTP_TYPES[number]

function isValidOtpType(t: string | null): t is OtpType {
    return t !== null && (VALID_OTP_TYPES as readonly string[]).includes(t)
}

// Decides if this is the user's very first authenticated visit. Supabase
// stamps last_sign_in_at on every successful login; on the first one it
// equals created_at. BUT Supabase writes created_at and last_sign_in_at in
// separate operations, so even on a genuine first OAuth signup they differ
// by microseconds — an exact-equality check wrongly reports fresh=false.
// Instead, treat the user as "fresh" when the account was created very
// recently: a real signup has created_at seconds ago, a re-login has it
// days/weeks ago, so a generous window has zero false positives.
// Generous window: a real OAuth signup lands within seconds, a genuine
// re-login happens hours/days later, so anything in between is safely
// treated as "fresh". The atomic claim on welcome_email_sent_at is the
// true once-ever guarantee, so widening this never risks a double welcome.
const FRESH_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
function isFreshUser(user: User): boolean {
    const createdMs = new Date(user.created_at).getTime()
    if (Number.isNaN(createdMs)) return false
    return Date.now() - createdMs < FRESH_WINDOW_MS
}

// Atomically claims the right to send the welcome email. Returns true only
// to the request that flips welcome_email_sent_at from NULL → now(). Any
// concurrent caller (Stripe retries, double-tap, refresh) will see the
// flag already set and skip.
async function claimWelcomeEmail(admin: SupabaseClient, userId: string): Promise<boolean> {
    const { data, error } = await admin
        .from('profiles')
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq('id', userId)
        .is('welcome_email_sent_at', null)
        .select('id')
        .maybeSingle()
    if (error) {
        console.error('[auth-callback] welcome-email claim failed', error.message)
        return false
    }
    return !!data
}

// First-time lead provisioning: insert the auto-grant row for "Lezioni Gratis"
// + set the 14-day expiry window. Idempotent via the unique constraint on
// one_time_purchases(user_id, package_id).
async function provisionLeadIfNeeded(admin: SupabaseClient, userId: string) {
    const leadPackageId = process.env.LEAD_MAGNET_PACKAGE_ID
    if (!leadPackageId) return

    const { data: profile } = await admin
        .from('profiles')
        .select('account_type, lead_expires_at')
        .eq('id', userId)
        .single()

    if (profile?.account_type !== 'lead' || profile.lead_expires_at) return

    await admin.from('one_time_purchases').upsert({
        user_id: userId,
        package_id: leadPackageId,
        item_type: 'package',
        amount: 0,
        status: 'lead',
    }, { onConflict: 'user_id,package_id', ignoreDuplicates: true })

    await admin.from('profiles')
        .update({ lead_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString() })
        .eq('id', userId)
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const tokenHash = searchParams.get('token_hash')
    // Some email clients render HTML entities literally (&amp;) instead of
    // decoding them, so URL params arrive as `amp;type=...` instead of
    // `type=...`. Read both shapes defensively for type/next/source/terms.
    const type = searchParams.get('type') ?? searchParams.get('amp;type')
    const next = (searchParams.get('next') ?? searchParams.get('amp;next')) ?? '/dashboard'
    const source = searchParams.get('source') ?? searchParams.get('amp;source')
    const terms = searchParams.get('terms') ?? searchParams.get('amp;terms')

    if (!code && !tokenHash) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_credentials`)
    }

    // Preserve verifier cookie during email_change so the second leg of the
    // change-email flow can still validate.
    const supabase = await createClient({ preventVerifierDeletion: type === 'email_change' })

    // 1. Exchange the credential. Two flows:
    //    - token_hash + type: email-driven auth (signup confirm, magic link,
    //      email change, recovery, invite). Uses verifyOtp, no PKCE verifier
    //      required — works reliably across browser tabs and mail clients.
    //    - code: OAuth flow (Google). Uses exchangeCodeForSession, the PKCE
    //      verifier cookie set during signInWithOAuth is read transparently.
    let authError: { message: string } | null = null
    if (tokenHash) {
        if (!isValidOtpType(type)) {
            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=invalid_type`)
        }
        const result = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        authError = result.error
    } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code)
        authError = result.error
    }

    if (authError) {
        console.error('[auth-callback] auth exchange failed:', authError.message)
        return NextResponse.redirect(
            `${origin}/auth/auth-code-error?error=${encodeURIComponent(authError.message)}`,
        )
    }

    const { data: { user } } = await supabase.auth.getUser()

    // Build the destination URL once so every redirect path uses the same
    // host-handling rules. Vercel/preview deployments need x-forwarded-host
    // to avoid redirecting to the build-time origin.
    const buildRedirect = (path: string): string => {
        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'
        if (isLocalEnv) return `${origin}${path}`
        if (forwardedHost) return `https://${forwardedHost}${path}`
        return `${origin}${path}`
    }

    // Email-change leg: no welcome, no terms gate, no lead provisioning. The
    // DB trigger handle_user_email_change keeps profiles.email in sync.
    if (type === 'email_change') {
        return NextResponse.redirect(buildRedirect(next))
    }

    if (!user) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_user`)
    }

    const fresh = isFreshUser(user)

    // Google fresh signup without terms: tear down the auth.users row (and
    // its profile row via cascade) so the user can retry properly. The
    // welcome email MUST NOT have been sent yet at this point.
    if (source === 'google' && fresh && terms !== '1') {
        try {
            const admin = await createServiceRoleClient()
            await admin.auth.admin.deleteUser(user.id)
        } catch (err) {
            console.error('[auth-callback] failed to delete unconsented user', err)
        }
        return NextResponse.redirect(`${origin}/login?error=terms-missing`)
    }

    const admin = await createServiceRoleClient()

    // For Google fresh signups that DID carry terms=1, persist the consent
    // timestamp. The trigger only sets terms_accepted_at when it's present in
    // raw_user_meta_data, which is not the case for OAuth signups.
    if (source === 'google' && fresh && terms === '1') {
        await admin
            .from('profiles')
            .update({ terms_accepted_at: new Date().toISOString() })
            .eq('id', user.id)
            .is('terms_accepted_at', null)
    }

    // Lead provisioning: first magic-link callback for a lead account
    // inserts the access grant + 14-day window. provisionLeadIfNeeded
    // is itself idempotent (skips when lead_expires_at is already set),
    // so we don't need an extra "fresh" gate here.
    if (type === 'magiclink') {
        await provisionLeadIfNeeded(admin, user.id)
    }

    // Welcome email: send only on a genuine new signup, never on re-login.
    //   - type === 'signup': the email/password confirmation callback. This
    //     fires ONLY at signup — password re-login goes straight through
    //     signInWithPassword and never reaches this route — so it is always
    //     a new account. (We can't use `fresh` here: verifyOtp has already
    //     moved last_sign_in_at past created_at by the time we run.)
    //   - source === 'google' && fresh: a brand-new Google signup. A Google
    //     RE-login also hits this route with source=google but fresh=false,
    //     which is exactly the case we must NOT welcome.
    // Magic-link leads are intentionally excluded — they get their own custom
    // "ecco i tuoi 3 video" email from requestLeadMagicLink.
    // The atomic claim on welcome_email_sent_at remains as a second guard
    // against duplicate sends on callback retries.
    const isNewSignup = type === 'signup' || (source === 'google' && fresh)
    if (isNewSignup && user.email) {
        const claimed = await claimWelcomeEmail(admin, user.id)
        if (claimed) {
            try {
                const { data: profile } = await admin
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()
                const name =
                    profile?.full_name
                    || (user.user_metadata?.name as string | undefined)
                    || (user.user_metadata?.full_name as string | undefined)
                    || ''
                await sendWelcomeEmail(user.email, name)
            } catch (err) {
                console.error('[auth-callback] welcome email send failed', err)
            }
        }
    }

    return NextResponse.redirect(buildRedirect(next))
}
