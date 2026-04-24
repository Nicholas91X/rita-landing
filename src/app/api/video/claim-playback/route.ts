// src/app/api/video/claim-playback/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Redis } from "@upstash/redis"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, videoPlaybackClaimLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"

const bodySchema = z.object({
  videoId: z.string().min(1).max(100),
  deviceId: z.string().min(8).max(64),
  deviceLabel: z.string().min(1).max(60),
  force: z.boolean().optional(),
})

let _redis: Redis | null = null
function redis(): Redis { return (_redis ??= Redis.fromEnv()) }

interface LockValue {
  deviceId: string
  deviceLabel: string
  videoId: string
  startedAt: number
}

// 30s TTL = 3× heartbeat interval (10s). Tolerates 2 missed heartbeats
// before a stale lock is released. Reduced from 90s to cut cross-device
// detection latency proportionally.
const LOCK_TTL_SECONDS = 30

async function isAdmin(userId: string): Promise<boolean> {
  const admin = await createServiceRoleClient()
  const { data } = await admin.from("admins").select("user_id").eq("user_id", userId).maybeSingle()
  return !!data
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let parsed: z.infer<typeof bodySchema>
  try { parsed = validate(bodySchema, body) }
  catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid body", fieldErrors: err.fieldErrors }, { status: 400 })
    }
    throw err
  }

  // Admin bypass — never touch Redis for admins.
  if (await isAdmin(user.id)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    await enforceRateLimit(videoPlaybackClaimLimiter(), user.id)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfter) } },
      )
    }
    throw err
  }

  const key = `playing:${user.id}`
  const existing = await redis().get<string>(key)

  if (existing && !parsed.force) {
    const parsedLock = JSON.parse(existing) as LockValue
    const sameDevice = parsedLock.deviceId === parsed.deviceId
    if (!sameDevice) {
      return NextResponse.json(
        { ok: false, blockedBy: { deviceLabel: parsedLock.deviceLabel } },
        { status: 409 },
      )
    }
    // same device — either re-claim (same video) or video switch; in both
    // cases we overwrite with fresh TTL below.
  }

  const newLock: LockValue = {
    deviceId: parsed.deviceId,
    deviceLabel: parsed.deviceLabel,
    videoId: parsed.videoId,
    startedAt: Date.now(),
  }
  await redis().set(key, JSON.stringify(newLock), { ex: LOCK_TTL_SECONDS })
  return NextResponse.json({ ok: true }, { status: 200 })
}
