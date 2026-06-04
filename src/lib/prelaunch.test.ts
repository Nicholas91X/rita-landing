import { describe, it, expect, afterEach } from 'vitest'
import { isPrelaunch } from './prelaunch'

describe('isPrelaunch', () => {
  const orig = process.env.NEXT_PUBLIC_PRELAUNCH_MODE
  afterEach(() => { process.env.NEXT_PUBLIC_PRELAUNCH_MODE = orig })

  it('is true only when the flag is exactly "true"', () => {
    process.env.NEXT_PUBLIC_PRELAUNCH_MODE = 'true'
    expect(isPrelaunch()).toBe(true)
  })
  it('is false when unset', () => {
    delete process.env.NEXT_PUBLIC_PRELAUNCH_MODE
    expect(isPrelaunch()).toBe(false)
  })
  it('is false for any other value', () => {
    process.env.NEXT_PUBLIC_PRELAUNCH_MODE = '1'
    expect(isPrelaunch()).toBe(false)
  })
})
