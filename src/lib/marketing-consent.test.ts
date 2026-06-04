import { describe, it, expect, vi } from 'vitest'
import { setEmailSubscription } from './marketing-consent'

function mockAdmin() {
  const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return { admin: { from: vi.fn(() => ({ update })) }, update }
}

describe('setEmailSubscription', () => {
  it('unsubscribe → setta email_unsubscribed_at e azzera marketing_consent_at', async () => {
    const { admin, update } = mockAdmin()
    await setEmailSubscription(admin as never, 'u1', false)
    const payload = update.mock.calls[0][0]
    expect(payload.email_unsubscribed_at).toBeTypeOf('string')
    expect(payload.marketing_consent_at).toBeNull()
  })
  it('subscribe → azzera email_unsubscribed_at', async () => {
    const { admin, update } = mockAdmin()
    await setEmailSubscription(admin as never, 'u1', true)
    const payload = update.mock.calls[0][0]
    expect(payload.email_unsubscribed_at).toBeNull()
  })
})
