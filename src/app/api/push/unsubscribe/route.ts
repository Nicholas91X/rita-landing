// src/app/api/push/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, pushUnsubscribeLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"

const bodySchema = z.object({
  endpoint: z.string().url().max(2048),
})

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"
}

export async function DELETE(req: NextRequest) {
  try {
    await enforceRateLimit(pushUnsubscribeLimiter(), ipOf(req))
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

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = validate(bodySchema, body)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    throw err
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.endpoint)
  if (error) return NextResponse.json({ error: "Storage failed" }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
