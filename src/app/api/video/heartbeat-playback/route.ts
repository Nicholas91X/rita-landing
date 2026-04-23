// src/app/api/video/heartbeat-playback/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Redis } from "@upstash/redis"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { validate, ValidationError } from "@/lib/security/validation"

const bodySchema = z.object({
  videoId: z.string().min(1).max(100),
  deviceId: z.string().min(8).max(64),
})

let _redis: Redis | null = null
function redis(): Redis { return (_redis ??= Redis.fromEnv()) }

interface LockValue {
  deviceId: string
  deviceLabel: string
  videoId: string
  startedAt: number
}

const LOCK_TTL_SECONDS = 90

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
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    throw err
  }

  if (await isAdmin(user.id)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const key = `playing:${user.id}`
  const existing = await redis().get<string>(key)

  if (!existing) {
    return NextResponse.json(
      { ok: false, takenOver: true, byDevice: null },
      { status: 409 },
    )
  }
  const lock = JSON.parse(existing) as LockValue
  if (lock.deviceId !== parsed.deviceId || lock.videoId !== parsed.videoId) {
    return NextResponse.json(
      { ok: false, takenOver: true, byDevice: { deviceLabel: lock.deviceLabel } },
      { status: 409 },
    )
  }

  // Match — refresh TTL.
  await redis().set(key, existing, { ex: LOCK_TTL_SECONDS })
  return NextResponse.json({ ok: true }, { status: 200 })
}
