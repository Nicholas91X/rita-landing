'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { computeUnlockStatus, type UnlockablePackage } from '@/lib/package-unlock'

// Tipi allineati al Database (usano 'name')
export type Package = {
    id: string
    name: string
    title?: string | null
    subtitle?: string | null
    description: string
    course_id: string
    stripe_price_id: string
    price: number;
    image_url: string | null;
    payment_mode?: 'subscription' | 'payment';
    order_index?: number
    isPurchased?: boolean
    /** Sequential unlock: true when an earlier package in the same course
     *  hasn't been completed yet. */
    isLocked?: boolean
    /** Name of the package to complete first, when locked. */
    lockedBy?: string | null
}

export type Course = {
    id: string
    name: string
    level_id: string
    packages: Package[]
}

export type Level = {
    id: string
    name: string
    courses: Course[]
}

type RawPackage = {
    id: string
    name: string
    title: string | null
    subtitle?: string | null
    description: string
    stripe_price_id: string
    price: number
    image_url: string | null
    payment_mode: 'subscription' | 'payment'
    hidden_from_discover: boolean
    order_index: number
}

// Builds the per-package unlock decision within one course (the chain).
// `completedIds` is the set of package ids the user has finished (holds the
// badge for); purchased packages are never shown as locked.
function withUnlock(
    rawPackages: RawPackage[],
    courseId: string,
    completedIds: ReadonlySet<string>,
    purchasedIds: ReadonlySet<string>,
) {
    const chain: UnlockablePackage[] = rawPackages.map((p) => ({
        id: p.id,
        name: p.name,
        course_id: courseId,
        order_index: p.order_index ?? 0,
    }))
    return rawPackages.map((pkg) => {
        const status = computeUnlockStatus(
            { id: pkg.id, name: pkg.name, course_id: courseId, order_index: pkg.order_index ?? 0 },
            chain,
            completedIds,
        )
        const isPurchased = purchasedIds.has(pkg.id)
        return {
            ...pkg,
            isPurchased,
            // A package you already own is never gated.
            isLocked: isPurchased ? false : status.isLocked,
            lockedBy: isPurchased ? null : status.lockedBy,
        }
    })
}

type RawLevel = {
    id: string
    name: string
    courses: Array<{
        id: string
        name: string
        packages: RawPackage[]
    }>
}

export async function getContentHierarchy() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // 1a. Active subscriptions
    const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('package_id, current_period_end')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])

    const nowMs = Date.now()
    const activeSubIds = (subs || [])
        .filter(s => !s.current_period_end || new Date(s.current_period_end).getTime() > nowMs)
        .map(s => s.package_id)

    // 1b. One-time purchases (now also reading status to handle the 'lead' grant)
    const { data: oneTime } = await supabase
        .from('one_time_purchases')
        .select('package_id, status')
        .eq('user_id', user.id)
        .neq('status', 'refunded')

    // 1c. Lead-expiry gating: a lead's 'lead' purchase grant is suppressed
    // when the 14-day window has elapsed.
    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, lead_expires_at')
        .eq('id', user.id)
        .single()

    const isLeadExpired = profile?.account_type === 'lead'
        && profile.lead_expires_at != null
        && new Date(profile.lead_expires_at).getTime() < nowMs

    const purchasedIds = new Set([
        ...activeSubIds,
        ...(oneTime || [])
            .filter((p: { status: string | null }) => !(p.status === 'lead' && isLeadExpired))
            .map((p: { package_id: string }) => p.package_id),
    ])

    // 1d. Completed packages (= user holds the badge) drive sequential unlock.
    const { data: badges } = await supabase
        .from('user_badges')
        .select('package_id')
        .eq('user_id', user.id)
    const completedIds = new Set((badges || []).map((b: { package_id: string }) => b.package_id))

    // 2. Query con i nomi colonne corretti (name invece di title)
    const { data, error } = await supabase
        .from('levels')
        .select(`
            id,
            name,
            courses (
                id,
                name,
                packages (
                    id,
                    name,
                    title,
                    subtitle,
                    description,
                    stripe_price_id,
                    price,
                    image_url,
                    payment_mode,
                    hidden_from_discover,
                    order_index
                )
            )
        `)

    if (error) {
        console.error('Error fetching content hierarchy:', error)
        return []
    }

    const typedData = (data as unknown) as RawLevel[]

    // 3. Compute unlock against the FULL course chain (before hiding), then
    // hide hidden_from_discover packages the user has no access to. This keeps
    // the lead-magnet "Lezioni Gratis" off the Discover surface for everyone
    // except the lead that received the grant.
    const hierarchy = (typedData || []).map((level) => ({
        ...level,
        courses: (level.courses || []).map((course) => ({
            ...course,
            packages: withUnlock(course.packages || [], course.id, completedIds, purchasedIds)
                .filter((pkg) => !pkg.hidden_from_discover || purchasedIds.has(pkg.id)),
        })),
    }))

    return hierarchy as unknown as Level[]
}

export async function getPublicContentHierarchy() {
    const supabase = await createClient()

    // Query con i nomi colonne corretti
    const { data, error } = await supabase
        .from('levels')
        .select(`
            id,
            name,
            courses (
                id,
                name,
                packages (
                    id,
                    name,
                    title,
                    subtitle,
                    description,
                    stripe_price_id,
                    price,
                    image_url,
                    payment_mode,
                    hidden_from_discover,
                    order_index
                )
            )
        `)

    if (error) {
        console.error('Error fetching public content hierarchy:', error)
        return []
    }

    const typedData = (data as unknown) as RawLevel[]

    // Public surface: nobody is logged in, so no package is completed —
    // every non-first package in a chain shows as locked. Hidden packages
    // are never shown publicly.
    const empty = new Set<string>()
    const hierarchy = (typedData || []).map((level) => ({
        ...level,
        courses: (level.courses || []).map((course) => ({
            ...course,
            packages: withUnlock(course.packages || [], course.id, empty, empty)
                .filter((pkg) => !pkg.hidden_from_discover),
        })),
    }))

    return hierarchy as unknown as Level[]
}
