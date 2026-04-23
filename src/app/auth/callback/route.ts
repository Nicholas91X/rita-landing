import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        // Check for email_change type to preserve verifier
        const type = searchParams.get('type')
        // Pass option to prevent deletion of verifier cookie during exchange
        const supabase = await createClient({ preventVerifierDeletion: type === 'email_change' })

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Send welcome email for new signups (not email changes)
            if (type !== 'email_change') {
                try {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user?.email) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', user.id)
                            .single()
                        await sendWelcomeEmail(user.email, profile?.full_name || '')
                    }
                } catch {
                    // Welcome email failure should not block auth flow
                }
            }

            // Sub-3 sanity check: Google OAuth signup flow must have carried terms=1.
            // The UI already enforces this, but catch URL-crafting attackers here too.
            const source = searchParams.get('source')
            const terms = searchParams.get('terms')
            if (source === 'google') {
                const { data: { user: oauthUser } } = await supabase.auth.getUser()
                if (oauthUser) {
                    const createdMs = new Date(oauthUser.created_at).getTime()
                    const isFreshUser = Math.abs(Date.now() - createdMs) < 2000
                    if (isFreshUser && terms !== '1') {
                        // Delete the freshly-created user so they can retry cleanly after
                        // accepting terms. Service-role client; regular client cannot
                        // touch auth.users directly.
                        try {
                            const { createServiceRoleClient } = await import('@/utils/supabase/server')
                            const admin = await createServiceRoleClient()
                            await admin.auth.admin.deleteUser(oauthUser.id)
                        } catch (err) {
                            console.error('[auth-callback] failed to delete unconsented user', err)
                        }
                        return NextResponse.redirect(`${origin}/login?error=terms-missing`)
                    }
                }
            }

            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        } else {
            console.error('[Auth Callback] Exchange failed:', error.message)
            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_code`)
}
