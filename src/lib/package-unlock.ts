// Sequential package unlocking.
//
// The "chain" is the course: packages within a course form an ordered sequence
// via `order_index`. A package unlocks only once every package BEFORE it in the
// SAME course is completed. A package alone in its course has no predecessor and
// is always unlocked — this is what keeps the lead package and the 1:1
// consultation out of any gating without special-casing them.
//
// "Completed" = the user holds the package's badge (reconcileUserBadges awards
// it once all the package's videos are watched). The caller passes the set of
// completed package ids; this module stays pure and easily testable.

export interface UnlockablePackage {
    id: string
    name: string
    course_id: string | null
    order_index: number
}

export interface UnlockStatus {
    isLocked: boolean
    /** Name of the package that must be completed first, when locked. */
    lockedBy: string | null
}

/**
 * Decide whether `pkg` is locked for a user, given all packages and the set of
 * package ids the user has completed. Locked when the nearest not-yet-completed
 * predecessor in the same course exists; `lockedBy` names that predecessor.
 */
export function computeUnlockStatus(
    pkg: UnlockablePackage,
    allPackages: UnlockablePackage[],
    completedPackageIds: ReadonlySet<string>,
): UnlockStatus {
    const predecessors = allPackages
        .filter(
            (p) =>
                p.course_id === pkg.course_id &&
                p.id !== pkg.id &&
                p.order_index < pkg.order_index,
        )
        .sort((a, b) => a.order_index - b.order_index)

    const blocking = predecessors.find((p) => !completedPackageIds.has(p.id))
    return blocking
        ? { isLocked: true, lockedBy: blocking.name }
        : { isLocked: false, lockedBy: null }
}
