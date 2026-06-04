/**
 * Pre-launch mode: purchases are off (no VAT number → Stripe can't go live),
 * the funnel runs as the free Community. Flipped off (with Stripe live keys)
 * at go-live in the same deploy. NEXT_PUBLIC_* so both client and server read it.
 */
export function isPrelaunch(): boolean {
  return process.env.NEXT_PUBLIC_PRELAUNCH_MODE === 'true'
}
