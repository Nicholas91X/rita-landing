// src/lib/security/ttl-idempotency.ts
// Lightweight Redis-TTL idempotency for short-lived duplicate-submission
// protection (e.g. stripe checkout session creation). Complements
// src/lib/security/idempotency.ts (which uses a permanent PK-dedup table
// for webhook events).
//
// Contract:
//   - First caller gets { fresh: true }. They should run the side-effecting
//     work and optionally call `cacheResult(key, value)` to persist the
//     outcome for duplicates.
//   - Subsequent callers within TTL get { fresh: false, payload?: cached }
//     and should return the cached payload without re-running the work.

import { Redis } from "@upstash/redis"

let _redis: Redis | null = null
function getRedis(): Redis {
  return (_redis ??= Redis.fromEnv())
}

const KEY_PREFIX = "idem:"

export interface ClaimOptions {
  ttlSeconds: number
  payload?: string
}

export interface ClaimResult {
  fresh: boolean
  payload?: string
}

export async function claimWithTtl(
  key: string,
  opts: ClaimOptions,
): Promise<ClaimResult> {
  const fullKey = KEY_PREFIX + key
  const redis = getRedis()

  const existing = await redis.get<string>(fullKey)
  if (existing !== null && existing !== undefined) {
    return { fresh: false, payload: existing || undefined }
  }

  await redis.set(fullKey, opts.payload ?? "", { ex: opts.ttlSeconds })
  return { fresh: true }
}

export async function cacheResult(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  await getRedis().set(KEY_PREFIX + key, value, { ex: ttlSeconds })
}
