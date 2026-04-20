import { createHash } from "crypto"

export class LeakedPasswordError extends Error {
  constructor(public count: number) {
    super(`Password esposta in ${count} breach noti.`)
    this.name = "LeakedPasswordError"
  }
}

/**
 * Queries the HIBP Pwned Passwords API with k-anonymity.
 * Only the first 5 chars of SHA-1(password) are sent.
 * Fail-open: returns 0 if API unreachable or non-200.
 */
export async function hibpCheck(password: string): Promise<number> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return 0
    const body = await res.text()
    const match = body.split("\n").find((line) => line.startsWith(suffix + ":"))
    return match ? parseInt(match.split(":")[1], 10) : 0
  } catch {
    return 0
  }
}

export async function assertPasswordNotLeaked(
  password: string,
  threshold = 1,
): Promise<void> {
  const count = await hibpCheck(password)
  if (count >= threshold) {
    throw new LeakedPasswordError(count)
  }
}
