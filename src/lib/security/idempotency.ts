import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

/**
 * Claims a Stripe webhook event for processing by inserting into
 * stripe_webhook_events. Relies on the PRIMARY KEY on event_id for dedup.
 *
 * Must be called with a service-role client because the table has RLS on.
 *
 * @returns { alreadyProcessed: true } if the event was already recorded
 *   (PG error code 23505 = unique_violation).
 * @throws on any other DB error — caller should return 500 so Stripe retries.
 */
export async function claimWebhookEvent(
  supabaseAdmin: SupabaseClient,
  event: Stripe.Event,
): Promise<{ alreadyProcessed: boolean }> {
  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    payload: event,
  })

  if (error) {
    if (error.code === "23505") {
      return { alreadyProcessed: true }
    }
    throw error
  }

  return { alreadyProcessed: false }
}
