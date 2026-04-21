// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, pushSubscribeLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"
}

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(pushSubscribeLimiter(), ipOf(req))
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfter) } },
      )
    }
    throw err
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let parsed: z.infer<typeof subscriptionSchema>
  try {
    parsed = validate(subscriptionSchema, body)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid subscription", fieldErrors: err.fieldErrors }, { status: 400 })
    }
    throw err
  }

  const admin = await createServiceRoleClient()
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null

  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    user_agent: userAgent,
  }, { onConflict: "endpoint" })

  if (error) {
    return NextResponse.json({ error: "Storage failed" }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
