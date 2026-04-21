// src/app/api/push/vapid-public/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return new NextResponse("VAPID not configured", { status: 500 })
  return new NextResponse(key, {
    status: 200,
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
  })
}
