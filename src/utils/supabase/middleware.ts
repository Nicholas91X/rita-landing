import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // 2. PROTECTED ROUTES PROTECTION
    const url = new URL(request.url)

    // Check if path is protected
    const isProtectedRoute = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin')

    if (isProtectedRoute && !user) {
        // Redirect to login if unauthenticated
        const redirectUrl = new URL('/login', request.url)
        return NextResponse.redirect(redirectUrl)
    }

    // 3. ADMIN PROTECTION (Optional: can also be done here or in page/layout)
    if (url.pathname.startsWith('/admin') && user) {
        // Check if user is admin
        const { data: admin } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', user.id)
            .single()

        if (!admin) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return supabaseResponse
}
