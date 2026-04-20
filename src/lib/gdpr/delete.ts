import { SignJWT, jwtVerify } from "jose"
import Stripe from "stripe"
import { createServiceRoleClient } from "@/utils/supabase/server"
import { logGdprAction } from "./audit"

const SECRET_NAME = "GDPR_DELETE_SECRET"

function secretKey(): Uint8Array {
  const raw = process.env[SECRET_NAME]
  if (!raw) throw new Error(`Missing env var ${SECRET_NAME}`)
  return new TextEncoder().encode(raw)
}

export async function signDeletionToken(
  userId: string,
  expiresInSeconds = 15 * 60,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey())
}

export async function verifyDeletionToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] })
  if (!payload.sub) throw new Error("Token missing subject")
  return { userId: payload.sub }
}

let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-12-15.clover" as unknown as Stripe.LatestApiVersion,
    })
  }
  return stripeClient
}

/**
 * Executes full account deletion. Must be called with a verified userId (from a
 * valid deletion token). Irreversible.
 *
 * Side effects (in order):
 *   1. Cancel active Stripe subscriptions
 *   2. Remove avatar from storage
 *   3. Delete user-owned rows (FK-safe order)
 *   4. Delete auth user
 *   5. Anonymize fiscal records (10y legal retention)
 *   6. Audit log delete_completed
 */
export async function executeAccountDeletion(userId: string, ipAddress?: string): Promise<void> {
  const admin = await createServiceRoleClient()

  // 1. Cancel Stripe subscriptions
  const { data: subs } = await admin
    .from("user_subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
  for (const sub of subs ?? []) {
    if (sub.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(sub.stripe_subscription_id)
      } catch (err) {
        console.warn(`Stripe cancel failed for ${sub.stripe_subscription_id}:`, err)
      }
    }
  }

  // 2. Delete avatar
  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .single()
  if (profile?.avatar_url) {
    const path = extractAvatarPath(profile.avatar_url)
    if (path) {
      try { await admin.storage.from("avatars").remove([path]) } catch {}
    }
  }

  // 3. Delete user-owned rows (FK-safe order)
  await admin.from("video_watch_progress").delete().eq("user_id", userId)
  await admin.from("user_notifications").delete().eq("user_id", userId)
  await admin.from("user_badges").delete().eq("user_id", userId)
  await admin.from("refund_requests").delete().eq("user_id", userId)
  await admin.from("admin_notifications").delete().eq("user_id", userId)
  await admin.from("one_time_purchases").delete().eq("user_id", userId)
  await admin.from("user_subscriptions").delete().eq("user_id", userId)
  await admin.from("profiles").delete().eq("id", userId)

  // 4. Delete auth user
  await admin.auth.admin.deleteUser(userId)

  // 5. Anonymize financial records (legal 10y retention)
  const anonymizedAt = new Date().toISOString()
  await admin
    .from("stripe_payments")
    .update({ user_id: null, anonymized_at: anonymizedAt })
    .eq("user_id", userId)
  await admin
    .from("stripe_invoices")
    .update({ user_id: null, anonymized_at: anonymizedAt })
    .eq("user_id", userId)

  // 6. Audit
  await logGdprAction({
    userId: null,
    action: "delete_completed",
    ipAddress,
    metadata: { deletedUserId: userId, at: anonymizedAt },
  })
}

function extractAvatarPath(publicUrl: string): string | null {
  const match = publicUrl.match(/\/avatars\/(.+)$/)
  return match ? match[1] : null
}
