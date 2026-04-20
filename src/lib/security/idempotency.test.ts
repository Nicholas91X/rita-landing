import { describe, it, expect, vi } from "vitest"
import { claimWebhookEvent } from "./idempotency"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

function makeMockClient(insertError: { code: string } | null = null): SupabaseClient {
  const insert = vi.fn().mockResolvedValue({ error: insertError })
  const from = vi.fn().mockReturnValue({ insert })
  return { from } as unknown as SupabaseClient
}

const fakeEvent = {
  id: "evt_test_123",
  type: "checkout.session.completed",
} as unknown as Stripe.Event

describe("claimWebhookEvent", () => {
  it("returns alreadyProcessed=false on successful insert", async () => {
    const client = makeMockClient(null)
    const result = await claimWebhookEvent(client, fakeEvent)
    expect(result).toEqual({ alreadyProcessed: false })
    expect(client.from).toHaveBeenCalledWith("stripe_webhook_events")
  })

  it("returns alreadyProcessed=true on PK conflict (code 23505)", async () => {
    const client = makeMockClient({ code: "23505" })
    const result = await claimWebhookEvent(client, fakeEvent)
    expect(result).toEqual({ alreadyProcessed: true })
  })

  it("rethrows on unexpected DB errors", async () => {
    const client = makeMockClient({ code: "42P01" })
    await expect(claimWebhookEvent(client, fakeEvent)).rejects.toThrow()
  })

  it("inserts event_id, event_type, payload", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    const client = { from } as unknown as SupabaseClient
    await claimWebhookEvent(client, fakeEvent)
    expect(insert).toHaveBeenCalledWith({
      event_id: "evt_test_123",
      event_type: "checkout.session.completed",
      payload: fakeEvent,
    })
  })
})
