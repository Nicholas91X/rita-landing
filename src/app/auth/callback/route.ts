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
