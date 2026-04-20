import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1]

export class RateLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public remaining: number,
    public reset: number,
  ) {
    super(message)
    this.name = "RateLimitError"
  }
  get retryAfter(): number {
    return Math.max(1, Math.ceil((this.reset - Date.now()) / 1000))
  }
}

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv()
  }
  return _redis
}

export function makeLimiter(prefix: string, max: number, window: Duration): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `rl:${prefix}`,
    analytics: true,
  })
}

export async function enforceRateLimit(limiter: Ratelimit, key: string): Promise<void> {
  const { success, limit, remaining, reset } = await limiter.limit(key)
  if (!success) {
    throw new RateLimitError(
      "Troppe richieste. Riprova più tardi.",
      limit,
      remaining,
      reset,
    )
  }
}

let _loginIpLimiter: Ratelimit | null = null
export function loginIpLimiter(): Ratelimit {
  return (_loginIpLimiter ??= makeLimiter("login:ip", 5, "15 m"))
}

let _loginEmailLimiter: Ratelimit | null = null
export function loginEmailLimiter(): Ratelimit {
  return (_loginEmailLimiter ??= makeLimiter("login:email", 5, "15 m"))
}

let _signupLimiter: Ratelimit | null = null
export function signupLimiter(): Ratelimit {
  return (_signupLimiter ??= makeLimiter("signup", 3, "1 h"))
}

let _forgotPwLimiter: Ratelimit | null = null
export function forgotPasswordLimiter(): Ratelimit {
  return (_forgotPwLimiter ??= makeLimiter("forgot-pw", 3, "1 h"))
}

let _forgotEmailLimiter: Ratelimit | null = null
export function forgotEmailLimiter(): Ratelimit {
  return (_forgotEmailLimiter ??= makeLimiter("forgot-email", 5, "1 h"))
}

let _contactLimiter: Ratelimit | null = null
export function contactLimiter(): Ratelimit {
  return (_contactLimiter ??= makeLimiter("contact", 5, "1 h"))
}

let _refundLimiter: Ratelimit | null = null
export function refundLimiter(): Ratelimit {
  return (_refundLimiter ??= makeLimiter("refund", 3, "24 h"))
}

let _deleteLimiter: Ratelimit | null = null
export function deleteLimiter(): Ratelimit {
  return (_deleteLimiter ??= makeLimiter("delete", 2, "24 h"))
}

let _exportLimiter: Ratelimit | null = null
export function exportLimiter(): Ratelimit {
  return (_exportLimiter ??= makeLimiter("export", 2, "24 h"))
}

let _apiCoarseLimiter: Ratelimit | null = null
export function apiCoarseLimiter(): Ratelimit {
  return (_apiCoarseLimiter ??= makeLimiter("api", 100, "1 m"))
}
