import Stripe from 'stripe'

// Single source of truth for the Stripe API version used across the app.
export const STRIPE_API_VERSION =
    '2025-12-15.clover' as unknown as Stripe.LatestApiVersion

/**
 * Returns the Stripe secret key, failing loudly in production if it is missing.
 *
 * Previously every Stripe client fell back to a literal `'sk_test_placeholder'`
 * when the env var was absent. In production that masked a misconfiguration:
 * checkout/refunds would hit Stripe with an invalid key and surface a generic
 * "Invalid API Key" error instead of an actionable one. Now a missing key in
 * production throws immediately (fail fast), while dev/test still get a
 * placeholder so local builds and unit tests don't require a real key.
 */
export function getStripeKey(): string {
    const key = process.env.STRIPE_SECRET_KEY
    if (key) return key
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'STRIPE_SECRET_KEY non configurata in produzione. ' +
                'Imposta la chiave live (sk_live_...) nelle variabili d\'ambiente prima del deploy.',
        )
    }
    return 'sk_test_placeholder'
}
