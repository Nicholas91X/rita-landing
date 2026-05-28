import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// Decides if this is the user's very first authenticated visit. Supabase
// stamps last_sign_in_at on every successful login; on the first one it
// equals created_at. Using these two timestamps (instead of a wall-clock
// window) makes the detection robust to network latency.
function isFreshUser(user: User): boolean {
    if (!user.last_sign_in_at) return true
    return user.last_sign_in_at === user.created_at
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

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'
    const type = searchParams.get('type')
    const source = searchParams.get('source')
    const terms = searchParams.get('terms')

    if (!code) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_code`)
    }

    // Preserve verifier cookie during email_change so the second leg of the
    // change-email flow can still validate.
    const supabase = await createClient({ preventVerifierDeletion: type === 'email_change' })
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
        console.error('[auth-callback] exchange failed:', exchangeError.message)
        return NextResponse.redirect(
            `${origin}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`,
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

    // Email-change leg: no welcome, no terms gate. The DB trigger
    // handle_user_email_change keeps profiles.email in sync automatically.
    if (type === 'email_change') {
        return NextResponse.redirect(buildRedirect(next))
    }

    if (!user) {
        // Should not happen if exchangeCodeForSession succeeded, but guard.
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

    // For Google fresh signups that DID carry terms=1, persist the consent
    // timestamp. The trigger only sets terms_accepted_at when it's present in
    // raw_user_meta_data, which is not the case for OAuth signups.
    if (source === 'google' && fresh && terms === '1') {
        const admin = await createServiceRoleClient()
        await admin
            .from('profiles')
            .update({ terms_accepted_at: new Date().toISOString() })
            .eq('id', user.id)
            .is('terms_accepted_at', null)
    }

    // Welcome email: send exactly once per user, ever. The idempotency flag
    // lives on profiles, so even if the callback runs again (Stripe retries,
    // browser back/forward, duplicate tab) the claim fails and we skip.
    if (fresh && user.email) {
        const admin = await createServiceRoleClient()
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
                // Best-effort: the user is already authenticated. Don't fail
                // the callback over a transient Resend hiccup. The claim
                // stays committed so we won't double-send on retry — this is
                // a deliberate trade-off (miss > duplicate).
                console.error('[auth-callback] welcome email send failed', err)
            }
        }
    }

    return NextResponse.redirect(buildRedirect(next))
}
