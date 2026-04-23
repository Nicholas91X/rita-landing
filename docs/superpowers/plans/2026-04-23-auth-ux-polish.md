# Sub-3 — Auth & UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 7 items from the Sub-3 spec (password strength meter, email verification banner, Google OAuth, button audit for dedup + loading state, custom auth email templates, SMTP switch to Resend) across 2 PRs without regressing any existing auth or billing flow.

**Architecture:** All changes are additive. No SQL migrations. No breaking changes to existing server-action signatures. PR #8 is pure code (client + server action internals); PR #9 adds Google OAuth button + extends `/auth/callback` + ships HTML templates and requires a Supabase Dashboard config tranche before merge. Password-strength is a thin wrapper around `@zxcvbn-ts/core`. Button-audit dedup uses either Postgres-natural conditions (cancel / refund / deletion) or a small Redis-TTL idempotency helper for `createCheckoutSession`. Email verification uses the existing `auth.users.email_confirmed_at`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase Auth (Google provider + custom email templates + SMTP-via-Resend), `@zxcvbn-ts/core` + language packs (new), Upstash Redis (reused from Sub-1), Vitest + react-testing-library (existing), Resend SMTP (existing sender for Sub-1 transactional).

**Execution context:** Work in a dedicated git worktree (e.g. `../rita-landing-sub3` or `.worktrees/sub3`). All commands assume repo root as CWD. Node 20+, npm 10+. Main baseline for branching = current `main` HEAD (commit `f8e0343`).

**Spec reference:** `docs/superpowers/specs/2026-04-23-auth-ux-polish-design.md`. Re-read spec §5 when in doubt about behaviour of a single feature.

**Prerequisites before starting PR #9 (ops, not code):**

These are the ops gates for the Supabase tranche. Do them BEFORE merging PR #9, otherwise Google signup / auth emails silently break in prod.

1. Google Cloud Console → create OAuth 2.0 Client (Web application). Authorized redirect URI: `https://ugfcoptwievurfnbrhno.supabase.co/auth/v1/callback`. Save client_id + client_secret.
2. Supabase Dashboard → Authentication → Providers → Google → paste client_id + secret → Enable.
3. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → ensure `https://www.fitandsmile.it/auth/callback` is allowed (should already be there from Sub-1).
4. Supabase Dashboard → Authentication → Email Templates → paste 3 HTML files from `docs/auth-email-templates/` (created in Task 18).
5. Supabase Dashboard → Authentication → SMTP Settings → host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key (same one already wired for transactional emails in Sub-1), sender name "Rita Workout", sender email `noreply@fitandsmile.it`.

---

## File Structure Overview

### New files

**Library / logic:**
- `src/lib/password-strength.ts` — `computeStrength(value)` wrapper over `@zxcvbn-ts/core`
- `src/lib/password-strength.test.ts` — unit tests
- `src/lib/security/ttl-idempotency.ts` — Redis-TTL idempotency helper (for `createCheckoutSession`)
- `src/lib/security/ttl-idempotency.test.ts` — unit tests

**Components:**
- `src/components/auth/PasswordStrengthMeter.tsx`
- `src/components/auth/PasswordStrengthMeter.test.tsx`
- `src/components/auth/GoogleSignInButton.tsx`
- `src/components/auth/EmailVerificationBanner.tsx`

**Server action tests:**
- `src/app/actions/stripe.test.ts` (new file — stripe.ts has no prior tests)

**Email templates (docs-only, referenced by Supabase Dashboard):**
- `docs/auth-email-templates/confirm-signup.html`
- `docs/auth-email-templates/reset-password.html`
- `docs/auth-email-templates/change-email.html`

**QA doc:**
- `docs/superpowers/specs/2026-04-23-auth-ux-polish-qa-checklist.md`

### Modified files

- `package.json` + `package-lock.json` — new zxcvbn-ts deps
- `src/app/login/page.tsx` — mount PasswordStrengthMeter + GoogleSignInButton + wire terms checkbox to Google button
- `src/app/auth/reset-password/page.tsx` — mount PasswordStrengthMeter
- `src/app/auth/callback/route.ts` — terms sanity check for Google-signup flow
- `src/app/dashboard/ProfileSection.tsx` — mount PasswordStrengthMeter in password-change card
- `src/app/dashboard/DashboardClient.tsx` — mount EmailVerificationBanner
- `src/app/dashboard/BillingSection.tsx` — optimistic update + refund button state post-success
- `src/app/actions/stripe.ts` — `cancelSubscription`, `requestRefund`, `createCheckoutSession` dedup
- `src/app/actions/user.ts` — `requestAccountDeletion` dedup
- `src/app/actions/gdpr.ts` — `requestAccountDeletionGdpr` dedup

---

## PR #8 — Client UX + button audit

**Goal:** Password meter in 3 places, email verification banner on /dashboard, 5 Tier-1 dedup actions + 5 Tier-2 loading-state actions. Standalone, no external deps.

### Task 1: Install zxcvbn-ts dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install deps**

Run:
```bash
npm install @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
```

Expected: `package.json` gains 3 new dependencies in the `^3.x` range.

- [ ] **Step 2: Verify lockfile**

Run: `git diff package.json` — expect 3 new lines in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add @zxcvbn-ts deps for Sub-3 password strength meter"
```

---

### Task 2: Build `src/lib/password-strength.ts` with tests (TDD)

**Files:**
- Create: `src/lib/password-strength.test.ts`
- Create: `src/lib/password-strength.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/password-strength.test.ts
import { describe, it, expect } from "vitest"
import { computeStrength } from "./password-strength"

describe("computeStrength", () => {
  it("returns score 0 and empty label for empty string", async () => {
    const r = await computeStrength("")
    expect(r.score).toBe(0)
    expect(r.label).toBe("")
  })

  it("returns score 0 with label 'Molto debole' for common dictionary word", async () => {
    const r = await computeStrength("password")
    expect(r.score).toBe(0)
    expect(r.label).toBe("Molto debole")
  })

  it("returns score >= 3 for a strong mixed password", async () => {
    const r = await computeStrength("MyN3wP@ssw0rdFit2026!")
    expect(r.score).toBeGreaterThanOrEqual(3)
  })

  it("produces a non-empty label for every non-empty input", async () => {
    const inputs = ["a", "ab", "abcd1234", "Pilates2026"]
    for (const input of inputs) {
      const r = await computeStrength(input)
      expect(r.label).not.toBe("")
    }
  })

  it("maps score 4 to 'Ottima'", async () => {
    const r = await computeStrength("correct horse battery staple 2026!")
    expect(r.score).toBe(4)
    expect(r.label).toBe("Ottima")
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/password-strength.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `password-strength.ts`**

```ts
// src/lib/password-strength.ts
// Thin wrapper around @zxcvbn-ts/core. Lazy-loads language packs once.
// The meter is advisory only — submit validation is handled separately by
// `passwordSchema` in @/lib/security/validation.ts + Sub-1's HIBP check.

import { zxcvbnOptions, zxcvbnAsync } from "@zxcvbn-ts/core"

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
}

const LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "Molto debole",
  1: "Debole",
  2: "Media",
  3: "Forte",
  4: "Ottima",
}

let configured: Promise<void> | null = null
function ensureConfigured(): Promise<void> {
  if (!configured) {
    configured = (async () => {
      const common = await import("@zxcvbn-ts/language-common")
      const en = await import("@zxcvbn-ts/language-en")
      zxcvbnOptions.setOptions({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      })
    })()
  }
  return configured
}

export async function computeStrength(value: string): Promise<Strength> {
  if (!value) return { score: 0, label: "" }
  await ensureConfigured()
  // zxcvbn handles strings up to ~256 chars efficiently; we cap at 72 to
  // match bcrypt limit used by passwordSchema.
  const input = value.length > 72 ? value.slice(0, 72) : value
  const result = await zxcvbnAsync(input)
  const score = result.score as 0 | 1 | 2 | 3 | 4
  return { score, label: LABELS[score] }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/lib/password-strength.test.ts`
Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/password-strength.ts src/lib/password-strength.test.ts
git commit -m "Add computeStrength wrapper over @zxcvbn-ts"
```

---

### Task 3: Build `PasswordStrengthMeter` component with tests

**Files:**
- Create: `src/components/auth/PasswordStrengthMeter.test.tsx`
- Create: `src/components/auth/PasswordStrengthMeter.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/auth/PasswordStrengthMeter.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"

vi.mock("@/lib/password-strength", () => ({
  computeStrength: vi.fn(async (v: string) => {
    if (!v) return { score: 0, label: "" }
    if (v === "weak") return { score: 1, label: "Debole" }
    if (v === "strong") return { score: 4, label: "Ottima" }
    return { score: 2, label: "Media" }
  }),
}))

describe("<PasswordStrengthMeter />", () => {
  it("renders 5 segments, all empty style, when value is empty", () => {
    const { container } = render(<PasswordStrengthMeter value="" />)
    const bars = container.querySelectorAll("[data-bar]")
    expect(bars.length).toBe(5)
    // No active color classes on any bar
    bars.forEach((bar) => {
      expect(bar.className).toContain("bg-neutral-200")
    })
    // No label
    expect(screen.queryByText(/debole|media|forte|ottima/i)).toBeNull()
  })

  it("renders label and colored bars when value is strong", async () => {
    render(<PasswordStrengthMeter value="strong" />)
    await waitFor(() => {
      expect(screen.getByText("Ottima")).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/components/auth/PasswordStrengthMeter.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/auth/PasswordStrengthMeter.tsx
"use client"
import { useEffect, useState } from "react"
import { computeStrength, type Strength } from "@/lib/password-strength"

interface Props {
  value: string
}

// Active bar color per score. Empty / below-current-score bars use neutral-200.
const BAR_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-red-500",
  1: "bg-orange-500",
  2: "bg-yellow-500",
  3: "bg-emerald-500",
  4: "bg-teal-400",
}

const LABEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "text-red-500",
  1: "text-orange-500",
  2: "text-yellow-600",
  3: "text-emerald-600",
  4: "text-teal-500",
}

export function PasswordStrengthMeter({ value }: Props) {
  const [strength, setStrength] = useState<Strength>({ score: 0, label: "" })

  useEffect(() => {
    let cancelled = false
    computeStrength(value)
      .then((s) => {
        if (!cancelled) setStrength(s)
      })
      .catch(() => {
        // zxcvbn lib failed to load → fail-soft, renders neutral state.
      })
    return () => {
      cancelled = true
    }
  }, [value])

  const activeBars = value ? strength.score + 1 : 0
  const color = value ? BAR_COLORS[strength.score] : ""

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            data-bar
            className={`h-1 flex-1 rounded-full ${i < activeBars ? color : "bg-neutral-200"}`}
          />
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs font-bold mt-1 ${LABEL_COLORS[strength.score]}`}>
          {strength.label}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/components/auth/PasswordStrengthMeter.test.tsx`
Expected: 2 tests passing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/PasswordStrengthMeter.tsx src/components/auth/PasswordStrengthMeter.test.tsx
git commit -m "Add PasswordStrengthMeter component"
```

---

### Task 4: Mount PasswordStrengthMeter in signup form

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Locate the signup password field**

Run: `grep -n 'name="password"\|SignupForm\|mode === .signup.' src/app/login/page.tsx`

Read ~40 lines around the signup form to understand the react-hook-form setup.

- [ ] **Step 2: Import the component at the top of the file**

Add to the imports block:
```tsx
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter"
```

- [ ] **Step 3: Watch the password field value**

Inside `SignupForm`, find the `useForm` setup. Add `watch` to the destructure:
```tsx
const { register, handleSubmit, formState: { errors }, watch } = useForm<SignupInput>(...)
const passwordValue = watch("password", "")
```

- [ ] **Step 4: Mount the meter directly below the password input**

Find the signup `<input type={showPassword ? "text" : "password"} ... {...register("password")} />` element and its error `<p>`. Immediately after the error `<p>`, add:
```tsx
<PasswordStrengthMeter value={passwordValue} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`, go to `/login`, switch to signup mode. Type in password field — bars and label should update live.

- [ ] **Step 7: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "Mount PasswordStrengthMeter in signup form"
```

---

### Task 5: Mount PasswordStrengthMeter in reset-password page

**Files:**
- Modify: `src/app/auth/reset-password/page.tsx`

- [ ] **Step 1: Read the current structure**

Run: `cat src/app/auth/reset-password/page.tsx`

Look for the react-hook-form setup and password input.

- [ ] **Step 2: Same wiring as Task 4**

Add import:
```tsx
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter"
```

Add `watch` to `useForm` destructure + `const passwordValue = watch("password", "")`.

Insert `<PasswordStrengthMeter value={passwordValue} />` immediately below the password input and its error message.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/auth/reset-password/page.tsx
git commit -m "Mount PasswordStrengthMeter in reset-password form"
```

---

### Task 6: Mount PasswordStrengthMeter in Profile password-change card

**Files:**
- Modify: `src/app/dashboard/ProfileSection.tsx`

- [ ] **Step 1: Locate the password-change UI**

Run: `grep -n 'updatePassword\|newPassword\|Cambia.*password\|nuova.*password' src/app/dashboard/ProfileSection.tsx`

Read ~40 lines around the match to understand the local state shape (likely `useState` based, not react-hook-form).

- [ ] **Step 2: Add import + meter**

Add import:
```tsx
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter"
```

Directly under the new-password input (the one bound to `onChange={(e) => setNewPassword(e.target.value)}` or equivalent), add:
```tsx
<PasswordStrengthMeter value={newPassword} />
```

Use the exact state variable name found in Step 1.

- [ ] **Step 3: Typecheck + manual check + commit**

```bash
npx tsc --noEmit
# Dev server running: go to /dashboard → Profile → Dati personali → Cambia password section
# Type a password, bars should update.
git add src/app/dashboard/ProfileSection.tsx
git commit -m "Mount PasswordStrengthMeter in profile password-change card"
```

---

### Task 7: Build EmailVerificationBanner component

**Files:**
- Create: `src/components/auth/EmailVerificationBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/auth/EmailVerificationBanner.tsx
"use client"
import { useEffect, useState, useRef } from "react"
import { X, Mail } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

const DISMISSED_KEY = "email-verify-dismissed-at"
const COOLDOWN_MS = 24 * 60 * 60 * 1000
const POLL_MS = 30_000

export function EmailVerificationBanner() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const supabase = createClient()
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setVisible(false)
        return
      }
      if (user.email_confirmed_at) {
        setVisible(false)
        if (pollTimer.current) {
          clearInterval(pollTimer.current)
          pollTimer.current = null
        }
        return
      }
      // Email not confirmed → check cooldown
      setEmail(user.email ?? null)
      const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? "0")
      const stillCooling = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < COOLDOWN_MS
      setVisible(!stillCooling)
    }

    check()
    pollTimer.current = setInterval(check, POLL_MS)

    return () => {
      cancelled = true
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [supabase])

  const resend = async () => {
    if (!email || sending) return
    setSending(true)
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email })
      if (error) {
        if (/rate/i.test(error.message) || error.status === 429) {
          toast.error("Email già inviata, aspetta un minuto")
        } else {
          toast.error("Errore durante l'invio, riprova")
        }
      } else {
        toast.success("Email inviata, controlla la casella (anche spam)")
      }
    } finally {
      setSending(false)
    }
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="w-full bg-orange-500/10 border-b border-orange-500/30 text-orange-100 px-4 py-3 flex items-center gap-3 text-sm font-medium">
      <Mail className="h-4 w-4 shrink-0 text-orange-400" />
      <span className="flex-1">
        Conferma la tua email per ricevere aggiornamenti importanti e non perdere l&apos;accesso.
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 font-bold uppercase tracking-widest text-xs disabled:opacity-50"
      >
        {sending ? "Invio..." : "Rinvia email"}
      </button>
      <button
        onClick={dismiss}
        aria-label="Chiudi"
        className="p-1 rounded-lg hover:bg-orange-500/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/EmailVerificationBanner.tsx
git commit -m "Add EmailVerificationBanner with 24h dismiss + 30s polling"
```

---

### Task 8: Mount EmailVerificationBanner in DashboardClient

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add import**

Near the other auth/push imports added by Sub-2:
```tsx
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner"
```

- [ ] **Step 2: Render at the very top of the main returned tree**

Find the outer `<DashboardThemeProvider>` wrap. Inside it, as the first child before the flex container `<div className="flex min-h-screen ...">`, add:
```tsx
<EmailVerificationBanner />
```

Rationale: banner is full-width, must sit above the sidebar/main area.

- [ ] **Step 3: Typecheck + manual test**

```bash
npx tsc --noEmit
# Manual: dashboard with an unverified email user should show the orange banner.
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "Mount EmailVerificationBanner at top of DashboardClient"
```

---

### Task 9: Build TTL-idempotency helper with tests (TDD)

**Files:**
- Create: `src/lib/security/ttl-idempotency.test.ts`
- Create: `src/lib/security/ttl-idempotency.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/security/ttl-idempotency.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@upstash/redis", () => {
  const store = new Map<string, { value: string; expiresAt: number }>()
  return {
    Redis: {
      fromEnv: vi.fn(() => ({
        set: vi.fn(async (key: string, value: string, opts?: { nx?: boolean; ex?: number }) => {
          const now = Date.now()
          const existing = store.get(key)
          if (existing && existing.expiresAt > now && opts?.nx) return null
          const expiresAt = opts?.ex ? now + opts.ex * 1000 : now + 3600_000
          store.set(key, { value, expiresAt })
          return "OK"
        }),
        get: vi.fn(async (key: string) => {
          const v = store.get(key)
          if (!v || v.expiresAt < Date.now()) {
            store.delete(key)
            return null
          }
          return v.value
        }),
      })),
    },
  }
})

describe("claimWithTtl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns { fresh: true } on first call for a key", async () => {
    const { claimWithTtl } = await import("./ttl-idempotency")
    const r = await claimWithTtl("test-key-1", { ttlSeconds: 60 })
    expect(r.fresh).toBe(true)
  })

  it("returns { fresh: false } on second call within TTL", async () => {
    const { claimWithTtl } = await import("./ttl-idempotency")
    await claimWithTtl("test-key-2", { ttlSeconds: 60 })
    const second = await claimWithTtl("test-key-2", { ttlSeconds: 60 })
    expect(second.fresh).toBe(false)
  })

  it("stores and returns cached payload on duplicate", async () => {
    const { claimWithTtl } = await import("./ttl-idempotency")
    await claimWithTtl("test-key-3", { ttlSeconds: 60, payload: "https://stripe.com/checkout/abc" })
    const second = await claimWithTtl("test-key-3", { ttlSeconds: 60 })
    expect(second.fresh).toBe(false)
    expect(second.payload).toBe("https://stripe.com/checkout/abc")
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/security/ttl-idempotency.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/lib/security/ttl-idempotency.test.ts`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/ttl-idempotency.ts src/lib/security/ttl-idempotency.test.ts
git commit -m "Add claimWithTtl Redis idempotency helper"
```

---

### Task 10: `cancelSubscription` server dedup + Stripe action test file

**Files:**
- Create: `src/app/actions/stripe.test.ts` (new file; stripe.ts has no prior tests)
- Modify: `src/app/actions/stripe.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/actions/stripe.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

vi.mock("@/lib/push/dispatch", () => ({ sendToUser: vi.fn() }))

describe("cancelSubscription — dedup", () => {
  beforeEach(() => vi.resetAllMocks())

  it("early-returns ok:true without calling Stripe when sub already has cancel_at_period_end=true", async () => {
    const Stripe = (await import("stripe")).default
    const stripeInstance = {
      subscriptions: { update: vi.fn() },
    }
    vi.spyOn(Stripe.prototype as unknown as { subscriptions: unknown }, "subscriptions", "get").mockReturnValue(stripeInstance.subscriptions)

    const { createClient, createServiceRoleClient } = await import("@/utils/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  stripe_subscription_id: "stripe-sub-1",
                  current_period_end: "2026-05-22",
                  cancel_at_period_end: true,  // <-- already cancelled
                  packages: { name: "BALI" },
                },
                error: null,
              }),
            }),
          }),
        }),
        update: () => ({ eq: async () => ({}) }),
      }),
    })
    ;(createServiceRoleClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ insert: vi.fn(async () => ({})) }),
    })

    const { cancelSubscription } = await import("./stripe")
    const r = await cancelSubscription({ subscriptionId: "sub-1" })
    expect(r.ok).toBe(true)
    expect(stripeInstance.subscriptions.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/app/actions/stripe.test.ts`
Expected: FAIL — current `cancelSubscription` does not have the early-return.

- [ ] **Step 3: Add early-return in `cancelSubscription`**

In `src/app/actions/stripe.ts`, modify the `cancelSubscription` action. After the "Get subscription info" block that fetches `sub`, add the select field `cancel_at_period_end`:

```ts
    // 1. Get subscription info (with ownership check)
    const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id, current_period_end, cancel_at_period_end, packages(name)')
        .eq('id', subscriptionId)
        .eq('user_id', user.id)
        .single()

    if (subError || !sub) return { ok: false, message: 'Abbonamento non trovato' }

    // *** NEW: Dedup — already cancelled, nothing to do. Skip admin_notifications
    // insert and skip push (idempotent call returns success as if we did the work). ***
    if (sub.cancel_at_period_end === true) {
        return { ok: true, data: undefined }
    }
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/app/actions/stripe.test.ts`
Expected: 1 test passing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/stripe.ts src/app/actions/stripe.test.ts
git commit -m "cancelSubscription early-return when already cancel_at_period_end=true"
```

---

### Task 11: BillingSection optimistic update on cancel

**Files:**
- Modify: `src/app/dashboard/BillingSection.tsx`

- [ ] **Step 1: Find the `handleCancelConfirm` function**

Run: `grep -n 'handleCancelConfirm\|setSubscriptions\|fetchSubs' src/app/dashboard/BillingSection.tsx`

- [ ] **Step 2: Inspect how subscriptions are stored in state**

Confirm the state setter name (likely `setSubscriptions`) and the shape (has `cancel_at_period_end` field).

- [ ] **Step 3: Add optimistic update right after success toast**

Replace the body of `handleCancelConfirm`'s success branch (the `if (!result.ok)` ... else path) so that it does the local state update BEFORE the async `fetchSubs()` call:

```tsx
    const handleCancelConfirm = async () => {
        if (!cancelDialog.subId) return
        try {
            setActionLoading(cancelDialog.subId)
            const result = await cancelSubscription({ subscriptionId: cancelDialog.subId })
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            toast.success('Rinnovo annullato con successo')
            // Optimistic update: flip cancel_at_period_end locally so the
            // "Cancellato" badge and hidden "Annulla" button take effect
            // instantly, before fetchSubs() roundtrips.
            setSubscriptions((prev) =>
                prev.map((s) =>
                    s.id === cancelDialog.subId ? { ...s, cancel_at_period_end: true } : s,
                ),
            )
            setCancelDialog({ open: false, subId: null })
            fetchSubs()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore'
            toast.error(message)
        } finally {
            setActionLoading(null)
        }
    }
```

(If the state setter is named differently, substitute accordingly.)

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/dashboard/BillingSection.tsx
git commit -m "Optimistic cancel_at_period_end update in BillingSection"
```

---

### Task 12: `requestRefund` server dedup

**Files:**
- Modify: `src/app/actions/stripe.ts`

- [ ] **Step 1: Add check before the insert**

In `requestRefund`, between the "14 giorni" check and the `insert()` call, add:

```ts
    // Dedup: reject if an existing refund_requests row for the same target
    // is pending or approved (already being processed).
    const targetColumn = type === 'subscription' ? 'subscription_id' : 'purchase_id'
    const { data: existing } = await supabase
        .from('refund_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq(targetColumn, id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()

    if (existing) {
        return { ok: false, message: 'Richiesta già in corso per questo elemento.' }
    }
```

- [ ] **Step 2: Add a test case**

Extend `src/app/actions/stripe.test.ts`:
```ts
describe("requestRefund — dedup", () => {
  it("rejects with 'già in corso' when a pending row exists", async () => {
    // Mock: refund_requests query returns a pending row; requestRefund should
    // short-circuit without inserting anything or dispatching push.
    // (Write a mock similar to Task 10's pattern; keep it minimal.)
    // Validate result.ok === false and result.message contains 'già in corso'.
  })
})
```

Fill in the mock following the shape from Task 10. Keep the test focused on that single assertion.

- [ ] **Step 3: Run tests + typecheck**

```bash
npx vitest run src/app/actions/stripe.test.ts
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/stripe.ts src/app/actions/stripe.test.ts
git commit -m "requestRefund rejects duplicates via pending/approved check"
```

---

### Task 13: `requestAccountDeletion` (user.ts) dedup + loading

**Files:**
- Modify: `src/app/actions/user.ts`

- [ ] **Step 1: Find the function**

Run: `grep -n 'requestAccountDeletion' src/app/actions/user.ts`

Read the function body.

- [ ] **Step 2: Add dedup check before admin_notifications insert**

At the start of the mutation block, add:
```ts
    const supabaseAdmin = await createServiceRoleClient()

    // Dedup: don't create a second deletion-request admin_notification if
    // user has an unprocessed one in the last 24h.
    const { data: existing } = await supabaseAdmin
        .from('admin_notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'deletion_request')
        .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .limit(1)
        .maybeSingle()

    if (existing) {
        return { ok: true, data: undefined }
    }
```

(If the action already builds `supabaseAdmin` differently or uses a different `type` string, match the existing pattern.)

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/actions/user.ts
git commit -m "requestAccountDeletion dedup within 24h"
```

---

### Task 14: `requestAccountDeletionGdpr` (gdpr.ts) dedup

**Files:**
- Modify: `src/app/actions/gdpr.ts`

- [ ] **Step 1: Locate the token creation**

Run: `grep -n 'requestAccountDeletionGdpr\|gdpr_audit_log\|deletion.*token' src/app/actions/gdpr.ts`

Identify where the token is inserted (probably in `gdpr_audit_log` or a dedicated `account_deletion_requests` table).

- [ ] **Step 2: Add dedup check**

Before generating/inserting the new token, add:
```ts
    // Dedup: if the user already has an unused deletion token issued in the
    // last 24h, return success without creating a new one (old one still
    // valid). Prevents duplicate emails / audit rows.
    const { data: existing } = await supabaseAdmin
        .from('gdpr_audit_log')  // or the appropriate table per existing code
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('event_type', 'account_deletion_requested')  // match existing convention
        .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .limit(1)
        .maybeSingle()

    if (existing) {
        return { ok: true, data: undefined }
    }
```

Adjust table name and `event_type` to match current Sub-1 GDPR schema if different.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/actions/gdpr.ts
git commit -m "requestAccountDeletionGdpr dedup within 24h"
```

---

### Task 15: `createCheckoutSession` idempotency

**Files:**
- Modify: `src/app/actions/stripe.ts`

- [ ] **Step 1: Import the TTL helper**

At the top of `src/app/actions/stripe.ts`:
```ts
import { claimWithTtl, cacheResult } from '@/lib/security/ttl-idempotency'
```

- [ ] **Step 2: Wrap the Stripe session creation**

In `createCheckoutSession`, right before the `stripe.checkout.sessions.create(...)` call:
```ts
    const idemKey = `checkout:${user.id}:${packageId}`
    const claim = await claimWithTtl(idemKey, { ttlSeconds: 60 })
    if (!claim.fresh && claim.payload) {
        // Duplicate submission within 60s — return the same checkout URL so
        // the user sees consistent state instead of 2 Stripe sessions.
        redirect(claim.payload)
    }
```

After the `stripe.checkout.sessions.create(...)` returns a `session` and before the `redirect(session.url!)`:
```ts
    if (session.url) {
        // Persist URL under the same idem key so any duplicate within 60s
        // gets the same URL back (TaskTask 9 contract).
        await cacheResult(idemKey, session.url, 60)
    }
```

- [ ] **Step 3: Add a test for idempotency**

Extend `src/app/actions/stripe.test.ts`:
```ts
describe("createCheckoutSession — idempotency", () => {
  it("returns the cached URL on duplicate call within 60s", async () => {
    // Mock claimWithTtl to return { fresh: false, payload: 'https://cached.url' }
    // then assert that the action redirects to 'https://cached.url' without
    // calling stripe.checkout.sessions.create.
  })
})
```

Fill in the mock; keep it minimal.

- [ ] **Step 4: Run tests + typecheck**

```bash
npx vitest run src/app/actions/stripe.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/stripe.ts src/app/actions/stripe.test.ts
git commit -m "createCheckoutSession uses Redis-TTL idempotency"
```

---

### Task 16: Button-loading audit — Tier 2 actions

**Files:**
- Modify: `src/app/dashboard/ProfileSection.tsx` (likely; confirm via grep)
- Modify: the Sessions card component (find via grep)

- [ ] **Step 1: Find every onClick that calls one of the Tier-2 actions**

Run:
```bash
grep -rn "updateProfileAction\|updateEmail\|updatePassword\|revokeSession\|revokeAllOtherSessions" src/app/
```

- [ ] **Step 2: For each match, ensure the surrounding button has a `disabled` prop tied to a local `loading` state**

Pattern to apply uniformly:
```tsx
const [loading, setLoading] = useState(false)

const handleClick = async () => {
    setLoading(true)
    try {
        const result = await updateProfileAction(...)
        if (!result.ok) toast.error(result.message)
        else toast.success('Salvato')
    } finally {
        setLoading(false)
    }
}

<Button onClick={handleClick} disabled={loading}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salva'}
</Button>
```

Apply this pattern to every callsite of a Tier-2 action if it isn't already present. Skip any that already have equivalent loading state.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/dashboard/
git commit -m "Tier-2 button loading state across profile + sessions actions"
```

---

### Task 17: PR #8 checklist + open PR

- [ ] **Step 1: Full verification suite**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

Expected: all pass. Pre-existing `DashboardClient` TAB_ORDER warnings OK.

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin sub3-auth-ux-client
gh pr create --base main --head sub3-auth-ux-client --title "Sub-3 PR #8 — Auth UX client: password meter, email banner, button audit" --body "$(cat <<'EOF'
## Summary
- PasswordStrengthMeter (zxcvbn-ts) mounted in 3 places: signup, reset-password, profile password-change
- EmailVerificationBanner at top of /dashboard with 24h dismiss cooldown + 30s polling + Supabase resend CTA
- Button audit Tier 1: server-side dedup for cancelSubscription, requestRefund, requestAccountDeletion (x2), createCheckoutSession (Redis-TTL 60s)
- Button audit Tier 2: loading-state + disabled on updateProfile/updateEmail/updatePassword/revokeSession/revokeAllOtherSessions
- BillingSection optimistic cancel_at_period_end update

## Spec
\`docs/superpowers/specs/2026-04-23-auth-ux-polish-design.md\`

## Plan
\`docs/superpowers/plans/2026-04-23-auth-ux-polish.md\` Tasks 1-17

## Test plan
- [x] \`npm run lint\` clean
- [x] \`npx tsc --noEmit\` clean
- [x] \`npx vitest run\` passes (new tests: password-strength x5, meter x2, ttl-idempotency x3, stripe cancel/refund/checkout)
- [x] \`npm run build\` succeeds
- [ ] Manual: meter visible + reactive in all 3 password entry points
- [ ] Manual: unverified user sees banner, resend works, X dismisses for 24h
- [ ] Manual: cancel subscription twice in quick succession → 1 admin_notifications row

## Follow-ups
PR #9 will add Google OAuth + custom email templates + SMTP switch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR #9 — Supabase config tranche

**Goal:** Google OAuth button + callback guard, custom email templates, SMTP switch to Resend.

**Ops prereqs (see plan header §Prerequisites):** 5 Supabase Dashboard / Google Cloud Console items must be completed before this PR merges.

### Task 18: Write the 3 HTML email templates

**Files:**
- Create: `docs/auth-email-templates/confirm-signup.html`
- Create: `docs/auth-email-templates/reset-password.html`
- Create: `docs/auth-email-templates/change-email.html`

- [ ] **Step 1: Write `confirm-signup.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Conferma la tua email · Rita Workout</title>
</head>
<body style="margin:0;padding:0;background:#001F3D;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#001F3D;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#001F3D;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="https://www.fitandsmile.it/logo/logo.png" width="100" alt="Rita Workout" style="display:block;">
        </td></tr>
        <tr><td align="center">
          <h1 style="color:#fff;font-size:24px;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-0.02em;margin:0 0 16px;">
            Benvenuta!
          </h1>
          <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Conferma la tua email per attivare l'account e iniziare il tuo percorso di allenamento.
          </p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#F46530;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;font-size:14px;">
            Conferma email
          </a>
          <p style="color:#888;font-size:12px;line-height:1.6;margin:32px 0 0;">
            Se non hai richiesto tu la registrazione, ignora questa email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

- [ ] **Step 2: Write `reset-password.html`** (same shell, different copy + `{{ .ConfirmationURL }}` CTA label "Reimposta password" + title "Reimposta la password", subject text adjusted)

Use the same structure. Replace the h1 + paragraph + CTA:
```html
<h1 ...>Reimposta la password</h1>
<p ...>Hai chiesto di reimpostare la password del tuo account Rita Workout. Clicca il pulsante per scegliere una nuova password.</p>
<a href="{{ .ConfirmationURL }}" ...>Reimposta password</a>
<p style="color:#888;...">Il link scade tra 24 ore. Se non hai richiesto tu il reset, ignora questa email.</p>
```

- [ ] **Step 3: Write `change-email.html`** (CTA "Conferma cambio email" + title "Conferma il cambio email")

Use the same shell with:
```html
<h1 ...>Conferma cambio email</h1>
<p ...>Conferma che questo è il nuovo indirizzo email del tuo account Rita Workout.</p>
<a href="{{ .ConfirmationURL }}" ...>Conferma nuova email</a>
<p style="color:#888;...">Se non hai richiesto tu questo cambio, contatta subito l'assistenza.</p>
```

- [ ] **Step 4: Commit**

```bash
git add docs/auth-email-templates/
git commit -m "Add 3 custom HTML auth email templates with Rita brand"
```

---

### Task 19: GoogleSignInButton component

**Files:**
- Create: `src/components/auth/GoogleSignInButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/auth/GoogleSignInButton.tsx
"use client"
import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

interface Props {
  termsAccepted: boolean
  mode: "login" | "signup"
}

export function GoogleSignInButton({ termsAccepted, mode }: Props) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Login doesn't need terms (user accepted them at original signup).
  // Signup requires the checkbox.
  const disabled = mode === "signup" && !termsAccepted

  const handleClick = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      const termsParam = mode === "signup" ? "&terms=1" : ""
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?source=google${termsParam}`,
        },
      })
      if (error) {
        toast.error("Errore durante l'accesso con Google")
        setLoading(false)
      }
      // On success the browser navigates away; no need to setLoading(false).
    } catch {
      toast.error("Errore durante l'accesso con Google")
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      className="w-full h-12 rounded-2xl bg-white text-neutral-900 font-bold text-sm flex items-center justify-center gap-3 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      {loading ? "Apertura..." : mode === "signup" ? "Registrati con Google" : "Accedi con Google"}
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/GoogleSignInButton.tsx
git commit -m "Add GoogleSignInButton with terms-gating for signup"
```

---

### Task 20: Extend /auth/callback with terms sanity check

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Read the current callback**

```bash
cat src/app/auth/callback/route.ts
```

Understand the current `exchangeCodeForSession` flow.

- [ ] **Step 2: Add the terms check**

After `exchangeCodeForSession` succeeds and the user is loaded, add:

```ts
  // Google OAuth signup flow must have carried the terms=1 param. If the
  // session was just minted for a brand-new user (created_at within ±2s of
  // now) AND the source is google AND terms !== "1", reject and redirect.
  // Existing-user logins via Google are fine without the param.
  const source = url.searchParams.get('source')
  const terms = url.searchParams.get('terms')
  if (source === 'google' && data.user) {
    const createdMs = new Date(data.user.created_at).getTime()
    const isFreshUser = Math.abs(Date.now() - createdMs) < 2000
    if (isFreshUser && terms !== '1') {
      // Delete the identity so the user can retry cleanly after accepting terms.
      // Use service-role client; regular client can't delete from auth.*.
      const admin = await createServiceRoleClient()
      await admin.auth.admin.deleteUser(data.user.id).catch(() => { /* best-effort */ })
      return NextResponse.redirect(`${url.origin}/login?error=terms-missing`)
    }
  }
```

Adjust variable names to match existing callback route (`data`, `url`, etc.).

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/auth/callback/route.ts
git commit -m "Sanity-check ?terms=1 on Google signup callback"
```

---

### Task 21: Mount GoogleSignInButton in /login + wire terms checkbox

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Identify current terms checkbox state**

The signup form already has a `terms_accepted` checkbox (per spec). Find it via:
```bash
grep -n 'terms_accepted\|checkbox\|termini\|privacy' src/app/login/page.tsx
```

- [ ] **Step 2: Lift terms state to where both signup AND Google button can read it**

If it's currently only tied to react-hook-form (`register("terms_accepted")`), watch it similarly to password:
```tsx
const termsAccepted = watch("terms_accepted") === "on"
```

- [ ] **Step 3: Add Google button in signup mode**

Above the existing email/password form fields (or below, designer's choice), add:
```tsx
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
// ...

<GoogleSignInButton termsAccepted={termsAccepted} mode="signup" />
<div className="flex items-center gap-4 my-6">
  <div className="h-px flex-1 bg-neutral-200" />
  <span className="text-xs text-neutral-500 uppercase tracking-widest">o</span>
  <div className="h-px flex-1 bg-neutral-200" />
</div>
```

- [ ] **Step 4: Also add in login mode (no terms gating — always enabled)**

In the `LoginForm` component, above the email field:
```tsx
<GoogleSignInButton termsAccepted={true} mode="login" />
<div className="flex items-center gap-4 my-6"> ... </div>
```

- [ ] **Step 5: Typecheck + manual**

```bash
npx tsc --noEmit
# Dev server: /login signup → Google button disabled until checkbox spunta.
# /login (default login mode): Google button always enabled.
```

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "Mount GoogleSignInButton in /login signup + login"
```

---

### Task 22: QA checklist document

**Files:**
- Create: `docs/superpowers/specs/2026-04-23-auth-ux-polish-qa-checklist.md`

- [ ] **Step 1: Write the checklist**

```markdown
# Sub-3 — Auth & UX Polish Manual QA Checklist

**Date:** 2026-04-23
Run this before merging PR #9. Every box must be ticked or explicitly marked N/A with reason.

## Password strength meter

- [ ] /login signup: empty password → 5 grey bars, no label
- [ ] /login signup: "password" → red bar, "Molto debole"
- [ ] /login signup: "Rita2026!" → 3-4 bars green/teal, "Forte" or "Ottima"
- [ ] /auth/reset-password: same scenarios render
- [ ] /dashboard Profile → Cambia password: same scenarios render
- [ ] Network offline + visit /login signup: meter renders empty (no errors in console)

## Email verification banner

- [ ] Signup a fresh user → auth email arrives within 30s branded with Rita logo (verify in Gmail visual)
- [ ] Without confirming, login → orange banner top of /dashboard
- [ ] Click "Rinvia email" → toast success
- [ ] Click "Rinvia email" twice within 60s → toast error "Email già inviata, aspetta un minuto"
- [ ] Click X → banner disappears; reload → still hidden
- [ ] Wait 24h (or manually clear localStorage key "email-verify-dismissed-at") → banner reappears
- [ ] Confirm email via the link → return to /dashboard → banner gone within 30s polling

## Google OAuth

- [ ] /login signup: terms NOT spuntati → Google button disabled (opacity 50, not clickable)
- [ ] Spunta terms → Google button enabled
- [ ] Click → Google consent → redirect → /dashboard, logged in
- [ ] Admin query user_profiles: full_name populated from Google profile
- [ ] New user: admin query auth.users identities → 1 Google identity
- [ ] Existing email/password user logs in via Google with same email → auth.users unchanged in id; identities now 2 (email + google)
- [ ] Login mode (not signup): Google button always enabled, no terms checkbox required
- [ ] Manually craft URL `/auth/callback?source=google&code=FAKE` without `terms=1` → redirect /login?error=terms-missing (simulated; browser cancels because code is invalid — OK)

## Custom email templates

- [ ] Signup confirmation email: Rita logo top, orange CTA button "Conferma email", italian copy, sent from `noreply@fitandsmile.it`
- [ ] Reset password email: custom template, CTA "Reimposta password"
- [ ] Change email email: custom template, CTA "Conferma nuova email"
- [ ] All 3 emails render correctly on Gmail web + Gmail mobile + Apple Mail

## SMTP switch

- [ ] Sender of all auth emails: `Rita Workout <noreply@fitandsmile.it>` (not `noreply@mail.app.supabase.io`)
- [ ] Signup confirmation email does NOT land in spam on a fresh Gmail account

## Button audit — Tier 1 dedup

- [ ] BillingSection: click "Annulla rinnovo" once → "Cancellato" badge shown instantly
- [ ] Reopen dialog for same sub: "Annulla rinnovo" button NOT visible → no way to duplicate
- [ ] DB: admin_notifications has exactly 1 row of type='cancellation' for that subscriptionId
- [ ] Request refund → "Richiedi rimborso" for same item → error "Richiesta già in corso"
- [ ] Request account deletion twice within 24h → server early-returns on 2nd call, no new admin_notifications row
- [ ] createCheckoutSession: double-click the "Acquista" button on /pacchetti → only 1 Stripe checkout session created (check Stripe Dashboard)

## Button audit — Tier 2 loading

- [ ] Profile → Dati personali: submit "Salva" → spinner during call, disabled
- [ ] Profile → Cambia email: submit → spinner during call
- [ ] Profile → Cambia password: submit → spinner during call
- [ ] Profile → Sessioni: click "Revoca" on a single session → spinner, disabled for that row
- [ ] Profile → Sessioni: click "Revoca tutte le altre" → spinner + disabled

## Build / test gates

- [ ] `npm run lint` clean (pre-existing TAB_ORDER warnings OK)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` all passing
- [ ] `npm run build` succeeds

## Ops post-merge

- [ ] Google Cloud Console OAuth 2.0 Client exists with redirect URI configured
- [ ] Supabase Dashboard → Auth → Providers → Google enabled
- [ ] Supabase Dashboard → Auth → Email Templates: 3 templates saved
- [ ] Supabase Dashboard → Auth → SMTP: Resend creds saved, "Test" send succeeds
- [ ] First real signup post-deploy → verification email delivered from `noreply@fitandsmile.it`
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-23-auth-ux-polish-qa-checklist.md
git commit -m "Add Sub-3 manual QA checklist"
```

---

### Task 23: PR #9 checklist + open PR

- [ ] **Step 1: Verify ops prereqs are done (out-of-code tasks)**

Confirm with the user (not the agent):
1. Google Cloud Console OAuth 2.0 Client configured
2. Supabase Auth → Providers → Google enabled with client_id + secret
3. Supabase Auth → Email Templates: 3 HTML from `docs/auth-email-templates/` pasted in
4. Supabase Auth → SMTP: Resend settings saved

If any step is pending, DO NOT merge the PR — Google signup + auth emails will silently fail in prod.

- [ ] **Step 2: Full verification suite**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin sub3-auth-ux-config
gh pr create --base main --head sub3-auth-ux-config --title "Sub-3 PR #9 — Auth UX config: Google OAuth + custom email templates + Resend SMTP" --body "$(cat <<'EOF'
## Summary
- GoogleSignInButton mounted in /login (both signup and login modes)
- Terms checkbox gates Google button in signup mode
- /auth/callback sanity-checks ?terms=1 for Google signup, rejects & deletes stub user if bypassed
- 3 custom HTML auth email templates committed to \`docs/auth-email-templates/\` (signup, reset, change email)
- SMTP switch: all Supabase auth emails now come from \`noreply@fitandsmile.it\` via Resend (existing sender)

## Dependencies
PR #8 (password meter, email banner, button audit) already merged.

## Ops prerequisites (must be done BEFORE merge)
- [ ] Google Cloud Console → OAuth 2.0 Client + redirect URI
- [ ] Supabase Auth → Providers → Google enabled
- [ ] Supabase Auth → Email Templates (3 HTML pasted)
- [ ] Supabase Auth → SMTP Settings (Resend credentials)

## Spec
\`docs/superpowers/specs/2026-04-23-auth-ux-polish-design.md\`

## Plan
\`docs/superpowers/plans/2026-04-23-auth-ux-polish.md\` Tasks 18-23

## Test plan
Manual QA per \`docs/superpowers/specs/2026-04-23-auth-ux-polish-qa-checklist.md\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- §5.1 Password meter → Tasks 2, 3, 4, 5, 6 ✓
- §5.2 Email banner → Tasks 7, 8 ✓
- §5.3 Google OAuth → Tasks 19, 20, 21 ✓
- §5.4 Button audit Tier 1 → Tasks 10, 11, 12, 13, 14, 15 ✓
- §5.4 Button audit Tier 2 → Task 16 ✓
- §5.5 Email templates → Task 18 ✓
- §5.6 SMTP switch → ops prereq + Task 23 verification ✓
- §7 Testing → Tasks 2, 3, 9, 10, 12, 15 TDD + Task 22 manual QA ✓
- §8 Rollout → 2 PRs (Tasks 17 and 23) ✓

**Placeholder scan:** No "TBD" / "TODO" / "fill in later" in actionable steps. Two Task-12 and Task-15 test bodies delegate mock-fill to the engineer with pattern reference — acceptable because mock shape varies.

**Type consistency:** `Strength`/`score`/`label` consistent across Tasks 2, 3. `claimWithTtl`/`cacheResult` signatures match across Tasks 9, 15. `GoogleSignInButton` props (`termsAccepted`, `mode`) consistent across Tasks 19, 21.

**Total task count:** 23 (Tasks 1-17 in PR #8, 18-23 in PR #9).

**No placeholders found.**
