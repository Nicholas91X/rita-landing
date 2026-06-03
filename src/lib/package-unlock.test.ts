import { describe, it, expect } from 'vitest'
import { computeUnlockStatus, type UnlockablePackage } from './package-unlock'

const COURSE = 'course-pilates'
const bali: UnlockablePackage = { id: 'bali', name: 'BALI', course_id: COURSE, order_index: 0 }
const ny: UnlockablePackage = { id: 'ny', name: 'NEW YORK', course_id: COURSE, order_index: 1 }
const siviglia: UnlockablePackage = { id: 'siv', name: 'SIVIGLIA', course_id: COURSE, order_index: 2 }
// Lone packages in their own course (lead / 1:1).
const lead: UnlockablePackage = { id: 'lead', name: 'Rituale', course_id: 'course-free', order_index: 0 }
const oneToOne: UnlockablePackage = { id: 'oto', name: 'Rinascita', course_id: 'course-perso', order_index: 0 }

const ALL = [bali, ny, siviglia, lead, oneToOne]

describe('computeUnlockStatus', () => {
    it('first package in a chain is always unlocked', () => {
        const r = computeUnlockStatus(bali, ALL, new Set())
        expect(r.isLocked).toBe(false)
        expect(r.lockedBy).toBeNull()
    })

    it('second package is locked until the first is completed', () => {
        const r = computeUnlockStatus(ny, ALL, new Set())
        expect(r.isLocked).toBe(true)
        expect(r.lockedBy).toBe('BALI')
    })

    it('second package unlocks once the first is completed', () => {
        const r = computeUnlockStatus(ny, ALL, new Set(['bali']))
        expect(r.isLocked).toBe(false)
        expect(r.lockedBy).toBeNull()
    })

    it('third package names the nearest incomplete predecessor', () => {
        // Bali done, NY not done → Siviglia blocked by NY (the nearest gap).
        const r = computeUnlockStatus(siviglia, ALL, new Set(['bali']))
        expect(r.isLocked).toBe(true)
        expect(r.lockedBy).toBe('NEW YORK')
    })

    it('third package unlocks when all predecessors are completed', () => {
        const r = computeUnlockStatus(siviglia, ALL, new Set(['bali', 'ny']))
        expect(r.isLocked).toBe(false)
    })

    it('a package alone in its course is never locked (lead)', () => {
        expect(computeUnlockStatus(lead, ALL, new Set()).isLocked).toBe(false)
    })

    it('a package alone in its course is never locked (1:1)', () => {
        expect(computeUnlockStatus(oneToOne, ALL, new Set()).isLocked).toBe(false)
    })

    it('does not let another course’s completion unlock a chain', () => {
        // Completing the lead package must not unlock NEW YORK.
        const r = computeUnlockStatus(ny, ALL, new Set(['lead', 'oto']))
        expect(r.isLocked).toBe(true)
        expect(r.lockedBy).toBe('BALI')
    })
})
