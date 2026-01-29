import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createBaseClient } from '@supabase/supabase-js'

export async function createClient(options?: { preventVerifierDeletion?: boolean }) {
    const cookieStore = await cookies()

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
        }
    )
}

export async function createServiceRoleClient() {
    return createBaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
    )
}
