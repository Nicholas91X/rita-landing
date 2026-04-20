import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/utils/supabase/middleware"
import { enforceRateLimit, apiCoarseLimiter, RateLimitError } from "@/lib/security/ratelimit"

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Coarse IP-based rate limit on /api/* (excluding webhooks, which Stripe bursts
  // legitimately and are deduped via idempotency).
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/webhooks/")) {
    try {
      await enforceRateLimit(apiCoarseLimiter(), `api:${getClientIp(request)}`)
    } catch (err) {
      if (err instanceof RateLimitError) {
        return new NextResponse("Too Many Requests", {
          status: 429,
          headers: { "Retry-After": String(err.retryAfter) },
        })
      }
      // Upstash unreachable: fail-open on the coarse /api/* limiter. A transient
      // Upstash outage should not take the whole site down.
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
