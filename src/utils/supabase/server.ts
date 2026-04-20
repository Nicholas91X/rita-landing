import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { createClient as createBaseClient } from '@supabase/supabase-js'

export async function createClient(options?: { preventVerifierDeletion?: boolean }) {
    const cookieStore = await cookies()

    // Forward the real browser User-Agent + client IP to Supabase Auth so
    // auth.sessions records useful metadata instead of "node" + edge IPs.
    let forwardedUa: string | undefined
    let forwardedXff: string | undefined
    try {
        const h = await headers()
        forwardedUa = h.get('user-agent') ?? undefined
        forwardedXff = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? undefined
    } catch {
        // headers() is not available in all contexts (eg unit tests); skip silently.
    }

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
                            // If preventVerifierDeletion is strictly true, skip any changes to the verifier cookie
                            // This usually happens when Supabase tries to delete it after exchange
                            if (options?.preventVerifierDeletion && name.endsWith('-code-verifier')) {
                                return
                            }
                            cookieStore.set(name, value, cookieOptions)
                        })
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
            global: {
                headers: {
                    ...(forwardedUa ? { 'User-Agent': forwardedUa } : {}),
                    ...(forwardedXff ? { 'x-forwarded-for': forwardedXff } : {}),
                },
            },
        }
    )
}

export async function createServiceRoleClient() {
    return createBaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
    )
}
