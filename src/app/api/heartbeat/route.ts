// src/app/api/heartbeat/route.ts
import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { createClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, heartbeatLimiter } from "@/lib/security/ratelimit"

let _redis: Redis | null = null
function redis(): Redis {
  return (_redis ??= Redis.fromEnv())
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await enforceRateLimit(heartbeatLimiter(), user.id)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    throw err
  }

  await redis().set(`active:${user.id}`, Date.now().toString(), { ex: 90 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
