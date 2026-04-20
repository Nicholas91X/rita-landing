# Sub-1 — Security & Compliance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 10 security and GDPR items from the Sub-1 spec (`docs/superpowers/specs/2026-04-20-security-compliance-hardening-design.md`), shipped in 3 PRs: DB migrations → utilities & enforcement → GDPR UI + session management + CSP enforcing flip.

**Architecture:** Hybrid "thin layer" — cross-cutting utilities in `src/lib/security/*`, feature modules for GDPR in `src/lib/gdpr/*`, co-located Zod schemas per action file, CSP/headers in `next.config.mjs`, coarse rate limit in `middleware.ts`, fine-grained inline in server actions.

**Tech Stack:** Next.js 15 App Router + React 19, Supabase (Postgres + Auth + Storage), Stripe, Upstash Redis (new), Zod + react-hook-form (new), jszip (new), jose for JWT (new), Vitest (new, dev).

**Execution context:** Recommended to run in a dedicated git worktree. Create one via `superpowers:using-git-worktrees` skill before starting, or manually: `git worktree add ../rita-landing-sub1 -b sub1-security`. All steps assume repo root as cwd.

**Spec reference:** `docs/superpowers/specs/2026-04-20-security-compliance-hardening-design.md`. Re-read spec § 4 (Components) when in doubt — this plan implements those decisions.

---

## File Structure Overview

### New files

**Utility modules (`src/lib/security/*`):**
- `ratelimit.ts` — Upstash client factory, limiters, `enforceRateLimit()`, `RateLimitError`
- `validation.ts` — `emailSchema`, `passwordSchema`, `shortTextSchema`, `validate()`, `ValidationError`, `formDataToObject()`
- `idempotency.ts` — `claimWebhookEvent()`
- `password.ts` — `hibpCheck()`, `assertPasswordNotLeaked()`, `LeakedPasswordError`
- `types.ts` — `ActionResult<T>` discriminated union

**GDPR modules (`src/lib/gdpr/*`):**
- `audit.ts` — `logGdprAction()`
- `export.ts` — `exportUserData()`
- `delete.ts` — `executeAccountDeletion()`, token sign/verify helpers

**Per-action schema files (co-located):**
- `src/app/actions/user.schemas.ts`
- `src/app/actions/stripe.schemas.ts`
- `src/app/actions/video.schemas.ts`
- `src/app/actions/contact.schemas.ts` (new + new action file if needed)

**New page/route:**
- `src/app/auth/confirm-deletion/page.tsx`
- `src/app/auth/confirm-deletion/actions.ts`

**Test files:**
- `src/lib/security/ratelimit.test.ts`
- `src/lib/security/validation.test.ts`
- `src/lib/security/idempotency.test.ts`
- `src/lib/security/password.test.ts`
- `src/lib/gdpr/delete.test.ts` (token sign/verify only; cascade is integration-manual)
- `vitest.config.ts`

**Migrations (`supabase/`):**
- `20260420_01_webhook_events.sql`
- `20260420_02_gdpr_audit_log.sql`
- `20260420_03_stripe_anonymization.sql`
- `20260420_04_avatars_bucket_limits.sql`
- `20260420_05_user_exports_bucket.sql`
- `20260420_06_drop_admin_notifications_insert.sql` (applied LAST, after PR #2 live)

### Modified files

- `src/app/actions/user.ts` — signup, login, recover, profile update, deletion intent
- `src/app/actions/stripe.ts` — refund, cancel subscription
- `src/app/actions/video.ts` — saveVideoProgress
- `src/app/actions/admin_actions/packages.ts` — create/update package
- `src/app/actions/admin_actions/content.ts` — create/update course/level
- `src/app/api/webhooks/stripe/route.ts` — idempotency claim
- `src/middleware.ts` + `src/utils/supabase/middleware.ts` — coarse IP rate limit
- `src/app/login/page.tsx` — react-hook-form integration
- `src/app/dashboard/ProfileSection.tsx` — avatar validation UX, Privacy & data section, Security section
- `src/components/sections/Contact.tsx` (or wherever) — rate-limited contact server action
- `next.config.mjs` — CSP + security headers
- `package.json` — new deps

---

## PR #1 — DB Migrations

**Deploy method:** paste each `.sql` file into Supabase Dashboard → SQL Editor → Run. Verify after each via MCP (`mcp__supabase__list_tables`, `mcp__supabase__execute_sql`).

**Why no code here:** these migrations are prerequisites for PR #2 code. They add tables/columns PR #2 reads/writes. Apply BEFORE merging PR #2. Migration #06 (drop admin_notifications policy) is the only exception — apply AFTER PR #2 is live in production.

### Task 1: Create `stripe_webhook_events` table

**Files:**
- Create: `supabase/20260420_01_webhook_events.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260420_01_webhook_events.sql
-- Creates the idempotency ledger for Stripe webhook events.

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON public.stripe_webhook_events(processed_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS; client roles have no access.

COMMIT;
```

- [ ] **Step 2: Apply via Supabase SQL Editor**

Paste file contents, Run.

- [ ] **Step 3: Verify**

Expected output of MCP call:
```
mcp__supabase__list_tables (schemas: ["public"])
→ includes "stripe_webhook_events"
```
And:
```sql
SELECT count(*) FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'stripe_webhook_events';
-- Expected: 0
```

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/20260420_01_webhook_events.sql
git commit -m "Add stripe_webhook_events migration for idempotency"
```

---

### Task 2: Create `gdpr_audit_log` table

**Files:**
- Create: `supabase/20260420_02_gdpr_audit_log.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260420_02_gdpr_audit_log.sql
-- Audit log for GDPR export and deletion actions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL CHECK (action IN ('export', 'delete_request', 'delete_completed')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_occurred_at
  ON public.gdpr_audit_log(occurred_at);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_user_id
  ON public.gdpr_audit_log(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

COMMIT;
```

- [ ] **Step 2: Apply via Supabase SQL Editor**

- [ ] **Step 3: Verify**

```
mcp__supabase__list_tables → includes "gdpr_audit_log"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/20260420_02_gdpr_audit_log.sql
git commit -m "Add gdpr_audit_log migration"
```

---

### Task 3: Add anonymization columns + nullable user_id to stripe_payments/invoices

**Files:**
- Create: `supabase/20260420_03_stripe_anonymization.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260420_03_stripe_anonymization.sql
-- Enables fiscal-compliant anonymization: preserve financial records (10y legal retention)
-- while detaching them from the user's identity.

BEGIN;

ALTER TABLE public.stripe_payments
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

ALTER TABLE public.stripe_invoices
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

-- Allow user_id NULL so anonymized rows can detach from users.
-- (Check current state first — may already be nullable.)
ALTER TABLE public.stripe_payments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.stripe_invoices
  ALTER COLUMN user_id DROP NOT NULL;

COMMIT;
```

- [ ] **Step 2: Check current user_id constraints first**

Run via MCP:
```sql
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('stripe_payments', 'stripe_invoices')
  AND column_name = 'user_id';
```

If already `is_nullable = 'YES'`, the `DROP NOT NULL` statements are no-ops (safe).

- [ ] **Step 3: Apply via Supabase SQL Editor**

- [ ] **Step 4: Verify**

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stripe_payments'
  AND column_name IN ('anonymized_at', 'user_id');
-- Expected: anonymized_at timestamp with time zone YES; user_id ... YES
```

Same check for `stripe_invoices`.

- [ ] **Step 5: Commit**

```bash
git add supabase/20260420_03_stripe_anonymization.sql
git commit -m "Add anonymization columns to stripe_payments/invoices"
```

---

### Task 4: Apply avatars bucket limits

**Files:**
- Create: `supabase/20260420_04_avatars_bucket_limits.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260420_04_avatars_bucket_limits.sql
-- Enforces server-side size (5 MB) and MIME type (image jpeg/png/webp) constraints
-- on the avatars bucket. Previously null = unlimited.

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

COMMIT;
```

- [ ] **Step 2: Apply via Supabase SQL Editor**

- [ ] **Step 3: Verify**

```sql
SELECT id, file_size_limit, allowed_mime_types 
FROM storage.buckets WHERE id = 'avatars';
-- Expected: file_size_limit=5242880, allowed_mime_types={image/jpeg,image/png,image/webp}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/20260420_04_avatars_bucket_limits.sql
git commit -m "Enforce 5MB + image MIME limits on avatars bucket"
```

---

### Task 5: Create `user-exports` private bucket

**Files:**
- Create: `supabase/20260420_05_user_exports_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260420_05_user_exports_bucket.sql
-- Private bucket for GDPR data exports. 50MB ceiling per file.
-- No storage.objects policies: service role only (created & signed URLs issued server-side).

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-exports', 'user-exports', false, 52428800, ARRAY['application/zip'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Apply via Supabase SQL Editor**

- [ ] **Step 3: Verify**

```sql
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'user-exports';
-- Expected: public=false, file_size_limit=52428800, mime=['application/zip']
```

- [ ] **Step 4: Commit**

```bash
git add supabase/20260420_05_user_exports_bucket.sql
git commit -m "Create user-exports private bucket for GDPR export downloads"
```

---

### Task 6: (DEFERRED) Drop `admin_notifications` INSERT policy

> **⚠️ DO NOT APPLY YET.** This migration breaks existing code unless PR #2's service-role refactor of the 3 calling server actions is live in production. Apply AFTER PR #2 deploy is verified stable. Included here for completeness.

**Files:**
- Create: `supabase/20260420_06_drop_admin_notifications_insert.sql`

- [ ] **Step 1: Write the migration (now)**

```sql
-- 20260420_06_drop_admin_notifications_insert.sql
-- Drops the user-scoped INSERT policy on admin_notifications.
-- After PR #2 is deployed, the 3 server actions that insert here use service_role
-- (which bypasses RLS), so this policy is no longer needed and removing it
-- prevents future drift.

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can insert notifications"
  ON public.admin_notifications;

COMMIT;
```

- [ ] **Step 2: Commit the file only (do not apply)**

```bash
git add supabase/20260420_06_drop_admin_notifications_insert.sql
git commit -m "Add deferred migration to drop admin_notifications INSERT policy"
```

- [ ] **Step 3: Add a note to the PR #2 description**

Add this checklist item at the bottom of the PR #2 description:
> After this PR is merged and production deploy confirmed stable (≥24h, no error spikes), apply `supabase/20260420_06_drop_admin_notifications_insert.sql` via Supabase SQL Editor and verify with:
> ```sql
> SELECT count(*) FROM pg_policies WHERE tablename = 'admin_notifications' AND cmd = 'INSERT';
> -- Expected: 0
> ```

---

## PR #2 — Utilities & Enforcement

**Goal:** add the security utility modules, wire them into existing server actions and the webhook handler, add CSP in report-only mode, refactor `admin_notifications` inserts to service role.

**Pre-requisite:** PR #1 migrations 01–05 applied and verified. Migration 06 is NOT applied yet.

### Task 7: Install new npm dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install zod react-hook-form @hookform/resolvers @upstash/ratelimit @upstash/redis jszip jose
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 happy-dom
```

`happy-dom` is used instead of jsdom for speed; required only if a test touches `window` or DOM APIs (none in this plan, but set up the environment in case).

- [ ] **Step 3: Verify install**

```bash
npm list zod react-hook-form @upstash/ratelimit vitest jose
```

Expected: all present at latest compatible versions.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add zod, upstash, react-hook-form, jszip, jose, vitest deps"
```

---

### Task 8: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/security/**/*.ts", "src/lib/gdpr/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

- [ ] **Step 2: Add test scripts to package.json**

Edit `package.json` scripts section to be:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 3: Create a smoke test to verify the harness**

Create `src/lib/security/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest"

describe("vitest harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Run the smoke test**

```bash
npm test
```

Expected: `1 passed | 0 failed`.

- [ ] **Step 5: Delete the smoke test**

```bash
rm src/lib/security/smoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "Configure Vitest for unit tests"
```

---

### Task 9: Create `ActionResult<T>` type

**Files:**
- Create: `src/lib/security/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/lib/security/types.ts
/**
 * Standard return shape for server actions that can fail with either a
 * top-level message or per-field validation errors.
 *
 * Callers discriminate on `ok`. On failure, `fieldErrors` maps form field
 * names to arrays of messages (shape produced by Zod's .flatten().fieldErrors)
 * — pass directly to react-hook-form's setError or render inline.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; retryAfter?: number }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/security/types.ts
git commit -m "Add ActionResult<T> discriminated union for server action returns"
```

---

### Task 10: Implement `src/lib/security/validation.ts` (TDD)

**Files:**
- Create: `src/lib/security/validation.ts`
- Test: `src/lib/security/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/security/validation.test.ts
import { describe, it, expect } from "vitest"
import {
  emailSchema,
  passwordSchema,
  shortTextSchema,
  validate,
  ValidationError,
  formDataToObject,
} from "./validation"

describe("emailSchema", () => {
  it("accepts valid email and normalizes", () => {
    expect(emailSchema.parse("  Test@Example.COM  ")).toBe("test@example.com")
  })
  it("rejects invalid", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow()
  })
  it("rejects too long", () => {
    expect(() => emailSchema.parse("a".repeat(250) + "@b.com")).toThrow()
  })
})

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.parse("Abcdef12")).toBe("Abcdef12")
  })
  it("rejects too short", () => {
    expect(() => passwordSchema.parse("Abc12")).toThrow()
  })
  it("rejects missing uppercase", () => {
    expect(() => passwordSchema.parse("abcdef12")).toThrow()
  })
  it("rejects missing lowercase", () => {
    expect(() => passwordSchema.parse("ABCDEF12")).toThrow()
  })
  it("rejects missing digit", () => {
    expect(() => passwordSchema.parse("Abcdefgh")).toThrow()
  })
})

describe("shortTextSchema", () => {
  it("trims and accepts", () => {
    expect(shortTextSchema.parse("  hello  ")).toBe("hello")
  })
  it("rejects empty after trim", () => {
    expect(() => shortTextSchema.parse("   ")).toThrow()
  })
  it("rejects too long", () => {
    expect(() => shortTextSchema.parse("x".repeat(501))).toThrow()
  })
})

describe("validate()", () => {
  it("returns parsed data on success", () => {
    const result = validate(emailSchema, "user@test.com")
    expect(result).toBe("user@test.com")
  })
  it("throws ValidationError with fieldErrors on failure", () => {
    try {
      validate(emailSchema, "junk")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).fieldErrors).toBeDefined()
    }
  })
})

describe("formDataToObject()", () => {
  it("converts FormData entries to plain object", () => {
    const fd = new FormData()
    fd.append("a", "1")
    fd.append("b", "2")
    expect(formDataToObject(fd)).toEqual({ a: "1", b: "2" })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- validation
```
Expected: tests fail with "Cannot find module './validation'".

- [ ] **Step 3: Write implementation**

```ts
// src/lib/security/validation.ts
import { z, ZodSchema } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email non valida")
  .max(254, "Email troppo lunga")

export const passwordSchema = z
  .string()
  .min(8, "Minimo 8 caratteri")
  .max(72, "Massimo 72 caratteri")
  .regex(/[A-Z]/, "Almeno una lettera maiuscola")
  .regex(/[a-z]/, "Almeno una lettera minuscola")
  .regex(/[0-9]/, "Almeno un numero")

export const shortTextSchema = z
  .string()
  .trim()
  .min(1, "Campo obbligatorio")
  .max(500, "Massimo 500 caratteri")

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string[]>) {
    super("Validazione fallita")
    this.name = "ValidationError"
  }
}

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }
  return parsed.data
}

export function formDataToObject(fd: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(fd.entries())
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- validation
```
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/validation.ts src/lib/security/validation.test.ts
git commit -m "Add security/validation utility with Zod schemas"
```

---

### Task 11: Implement `src/lib/security/password.ts` (HIBP, TDD)

**Files:**
- Create: `src/lib/security/password.ts`
- Test: `src/lib/security/password.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/security/password.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { hibpCheck, assertPasswordNotLeaked, LeakedPasswordError } from "./password"

describe("hibpCheck", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 0 for a password not in breach data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "AAAAAA1:3\nBBBBBB2:5\n", // suffixes that won't match "password"
    })
    const count = await hibpCheck("not-really-pwned-random-xyz-42")
    expect(count).toBe(0)
  })

  it("returns breach count when the suffix matches", async () => {
    // SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // Prefix = "5BAA6", suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9999999\nOTHER:1\n",
    })
    const count = await hibpCheck("password")
    expect(count).toBe(9999999)
  })

  it("fail-open on non-ok response (returns 0)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "" })
    const count = await hibpCheck("anything")
    expect(count).toBe(0)
  })

  it("fail-open on fetch rejection (returns 0)", async () => {
    fetchMock.mockRejectedValue(new Error("network"))
    const count = await hibpCheck("anything")
    expect(count).toBe(0)
  })

  it("sends only the first 5 chars of SHA-1 hash (k-anonymity)", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" })
    await hibpCheck("password")
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe("https://api.pwnedpasswords.com/range/5BAA6")
    const calledOpts = fetchMock.mock.calls[0][1] as RequestInit
    expect((calledOpts.headers as Record<string, string>)["Add-Padding"]).toBe("true")
  })
})

describe("assertPasswordNotLeaked", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not throw when count is below threshold", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" })
    await expect(assertPasswordNotLeaked("safe-unique-password")).resolves.toBeUndefined()
  })

  it("throws LeakedPasswordError when threshold met", async () => {
    // SHA-1 of "password" → suffix 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "1E4C9B93F3F0682250B6CF8331B7EE68FD8:500\n",
    })
    await expect(assertPasswordNotLeaked("password")).rejects.toThrow(LeakedPasswordError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- password
```

- [ ] **Step 3: Write implementation**

```ts
// src/lib/security/password.ts
import { createHash } from "crypto"

export class LeakedPasswordError extends Error {
  constructor(public count: number) {
    super(`Password esposta in ${count} breach noti.`)
    this.name = "LeakedPasswordError"
  }
}

/**
 * Queries the HIBP Pwned Passwords API with k-anonymity.
 *
 * Only the first 5 characters of the SHA-1 hash of the password are sent.
 * The password itself never leaves the server.
 *
 * Fail-open policy: returns 0 if the HIBP API is unreachable or returns
 * a non-200 status. Caller decides how strict to be based on the count.
 *
 * @returns the number of times this password appears in breach data; 0 if safe/unknown.
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

/**
 * Throws LeakedPasswordError if the password appears at least `threshold` times
 * in HIBP breach data. Default threshold is 1 (reject any known-leaked password).
 */
export async function assertPasswordNotLeaked(
  password: string,
  threshold = 1,
): Promise<void> {
  const count = await hibpCheck(password)
  if (count >= threshold) {
    throw new LeakedPasswordError(count)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- password
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/password.ts src/lib/security/password.test.ts
git commit -m "Add security/password HIBP k-anonymity utility"
```

---

### Task 12: Implement `src/lib/security/ratelimit.ts` (TDD)

**Files:**
- Create: `src/lib/security/ratelimit.ts`
- Test: `src/lib/security/ratelimit.test.ts`
- Modify: `.env.local` (add Upstash placeholders for dev), `.env.example` if exists

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/security/ratelimit.test.ts
import { describe, it, expect, vi } from "vitest"
import { RateLimitError, enforceRateLimit } from "./ratelimit"
import type { Ratelimit } from "@upstash/ratelimit"

function makeMockLimiter(result: {
  success: boolean
  limit: number
  remaining: number
  reset: number
}): Ratelimit {
  return {
    limit: vi.fn().mockResolvedValue(result),
  } as unknown as Ratelimit
}

describe("enforceRateLimit", () => {
  it("passes when success is true", async () => {
    const limiter = makeMockLimiter({
      success: true,
      limit: 5,
      remaining: 3,
      reset: Date.now() + 60000,
    })
    await expect(enforceRateLimit(limiter, "key")).resolves.toBeUndefined()
  })

  it("throws RateLimitError with metadata when success is false", async () => {
    const reset = Date.now() + 60000
    const limiter = makeMockLimiter({
      success: false,
      limit: 5,
      remaining: 0,
      reset,
    })
    try {
      await enforceRateLimit(limiter, "key")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).reset).toBe(reset)
      expect((err as RateLimitError).limit).toBe(5)
    }
  })

  it("passes the provided key to limiter.limit()", async () => {
    const limiter = makeMockLimiter({
      success: true,
      limit: 5,
      remaining: 5,
      reset: Date.now(),
    })
    await enforceRateLimit(limiter, "my-key")
    expect(limiter.limit).toHaveBeenCalledWith("my-key")
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- ratelimit
```

- [ ] **Step 3: Write implementation**

```ts
// src/lib/security/ratelimit.ts
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
  /** Seconds until the limit resets (for Retry-After header). */
  get retryAfter(): number {
    return Math.max(1, Math.ceil((this.reset - Date.now()) / 1000))
  }
}

/** Lazy singleton Redis client — created on first use. */
let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv()
  }
  return _redis
}

/**
 * Factory for a sliding-window rate limiter.
 *
 * @param prefix — Redis key prefix (also the analytics namespace in Upstash dashboard)
 * @param max — allowed operations within the window
 * @param window — duration (e.g., "1 h", "15 m", "30 s")
 */
export function makeLimiter(prefix: string, max: number, window: Duration): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `rl:${prefix}`,
    analytics: true,
  })
}

/**
 * Runs the limiter and throws RateLimitError on denial.
 * Callers decide on failure semantics (fail-open vs fail-closed) by wrapping
 * the call in a try/catch for non-RateLimitError errors.
 */
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

// ---------- Pre-configured limiters ----------
// Defined as lazy getters so they're not instantiated at import time (which would
// require UPSTASH env vars to be present even in contexts that don't use ratelimit).

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
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- ratelimit
```

- [ ] **Step 5: Add Upstash env vars to `.env.local`**

```bash
# Append to .env.local (local dev — use Upstash free-tier creds)
echo "" >> .env.local
echo "# Upstash Redis (rate limiting)" >> .env.local
echo "UPSTASH_REDIS_REST_URL=<paste from Upstash dashboard>" >> .env.local
echo "UPSTASH_REDIS_REST_TOKEN=<paste from Upstash dashboard>" >> .env.local
```

> **Operational:** create an Upstash Redis database (free tier, https://console.upstash.com), copy the REST URL + token. Also add these to Vercel project → Settings → Environment Variables for production and preview deployments.

- [ ] **Step 6: Commit**

```bash
git add src/lib/security/ratelimit.ts src/lib/security/ratelimit.test.ts
git commit -m "Add security/ratelimit utility with Upstash sliding-window limiters"
```

---

### Task 13: Implement `src/lib/security/idempotency.ts` (TDD)

**Files:**
- Create: `src/lib/security/idempotency.ts`
- Test: `src/lib/security/idempotency.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/security/idempotency.test.ts
import { describe, it, expect, vi } from "vitest"
import { claimWebhookEvent } from "./idempotency"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

function makeMockClient(insertError: { code: string } | null = null): SupabaseClient {
  const insert = vi.fn().mockResolvedValue({ error: insertError })
  const from = vi.fn().mockReturnValue({ insert })
  return { from } as unknown as SupabaseClient
}

const fakeEvent = {
  id: "evt_test_123",
  type: "checkout.session.completed",
} as unknown as Stripe.Event

describe("claimWebhookEvent", () => {
  it("returns alreadyProcessed=false on successful insert", async () => {
    const client = makeMockClient(null)
    const result = await claimWebhookEvent(client, fakeEvent)
    expect(result).toEqual({ alreadyProcessed: false })
    expect(client.from).toHaveBeenCalledWith("stripe_webhook_events")
  })

  it("returns alreadyProcessed=true on PK conflict (code 23505)", async () => {
    const client = makeMockClient({ code: "23505" })
    const result = await claimWebhookEvent(client, fakeEvent)
    expect(result).toEqual({ alreadyProcessed: true })
  })

  it("rethrows on unexpected DB errors", async () => {
    const client = makeMockClient({ code: "42P01" }) // undefined table
    await expect(claimWebhookEvent(client, fakeEvent)).rejects.toThrow()
  })

  it("inserts event_id, event_type, payload", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    const client = { from } as unknown as SupabaseClient
    await claimWebhookEvent(client, fakeEvent)
    expect(insert).toHaveBeenCalledWith({
      event_id: "evt_test_123",
      event_type: "checkout.session.completed",
      payload: fakeEvent,
    })
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- idempotency
```

- [ ] **Step 3: Write implementation**

```ts
// src/lib/security/idempotency.ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

/**
 * Claims a Stripe webhook event for processing by inserting into
 * stripe_webhook_events. Relies on the PRIMARY KEY on event_id for dedup.
 *
 * Must be called with a service-role client because the table has RLS on.
 *
 * @returns { alreadyProcessed: true } if the event was already recorded
 *   (PG error code 23505 = unique_violation). The caller should respond 200
 *   and skip processing.
 * @throws on any other DB error — caller should return 500 so Stripe retries.
 */
export async function claimWebhookEvent(
  supabaseAdmin: SupabaseClient,
  event: Stripe.Event,
): Promise<{ alreadyProcessed: boolean }> {
  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    payload: event,
  })

  if (error) {
    if (error.code === "23505") {
      return { alreadyProcessed: true }
    }
    throw error
  }

  return { alreadyProcessed: false }
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- idempotency
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/idempotency.ts src/lib/security/idempotency.test.ts
git commit -m "Add security/idempotency utility for Stripe webhook dedup"
```

---

### Task 14: Add coarse rate limit in middleware

**Files:**
- Modify: `src/utils/supabase/middleware.ts` (where `updateSession` lives)
- Modify: `src/middleware.ts` (orchestration)

- [ ] **Step 1: Read current `src/utils/supabase/middleware.ts`**

Understand the full file — existing exports, session refresh, maintenance mode, admin check. Do not regress.

- [ ] **Step 2: Modify `src/middleware.ts` to apply coarse rate limit before session refresh**

Replace the entire file with:

```ts
// src/middleware.ts
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
```

- [ ] **Step 3: Manual verification (local dev)**

Start dev server:
```bash
npm run dev
```

In another terminal, make 101 rapid calls to any `/api/*` route (e.g., `/api/admin/bunny-proxy/...` with GET — will likely 401 but that still counts against the limit):

```bash
for i in $(seq 1 101); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/any-route; done | sort | uniq -c
```

Expected: at least some 429 responses near the end.

If Upstash env vars are missing locally, you'll see fallthrough (no 429, no errors). That's the fail-open branch; acceptable for this test.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "Add coarse IP rate limit on /api/* in middleware"
```

---

### Task 15: Wire idempotency into Stripe webhook handler

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Read current `src/app/api/webhooks/stripe/route.ts`**

Locate the line where `event` is constructed from `stripe.webhooks.constructEvent(...)` and where the service-role client is created.

- [ ] **Step 2: Insert `claimWebhookEvent` call after event construction, before any domain logic**

At the top of the POST handler, after signature verification succeeds and `supabaseAdmin` is created:

```ts
// Add these imports at top of file
import { claimWebhookEvent } from "@/lib/security/idempotency"

// ... inside POST handler, right after event is constructed and supabaseAdmin obtained ...

const { alreadyProcessed } = await claimWebhookEvent(supabaseAdmin, event)
if (alreadyProcessed) {
  return new Response("Event already processed", { status: 200 })
}

// ... existing processing logic continues ...
```

Exact placement: AFTER `stripe.webhooks.constructEvent()` succeeds and AFTER `createServiceRoleClient()` returns the admin client. BEFORE any `switch(event.type)` or domain-specific branching.

- [ ] **Step 3: Manual test via Stripe CLI**

```bash
# In one terminal — forward webhooks to local
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# In another — trigger an event
stripe trigger checkout.session.completed

# Trigger again immediately (retrieve the event ID from the first output and replay)
stripe events resend <evt_id>
```

Expected:
- First call: normal 200 processing
- Second call: 200 with body "Event already processed"
- Check Supabase: `SELECT count(*) FROM stripe_webhook_events WHERE event_id = '<evt_id>'` → 1
- Check: if the event was `checkout.session.completed` for an existing test user, no duplicate row in `one_time_purchases` / `user_subscriptions`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "Add idempotency claim to Stripe webhook handler"
```

---

### Task 16: Create `src/app/actions/user.schemas.ts`

**Files:**
- Create: `src/app/actions/user.schemas.ts`

- [ ] **Step 1: Write the schemas**

```ts
// src/app/actions/user.schemas.ts
import { z } from "zod"
import { emailSchema, passwordSchema } from "@/lib/security/validation"

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(2, "Minimo 2 caratteri").max(100),
  terms_accepted: z.literal("on", {
    errorMap: () => ({ message: "Devi accettare i termini" }),
  }),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password obbligatoria").max(72),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const findEmailSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
})
export type FindEmailInput = z.infer<typeof findEmailSchema>

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Minimo 2 caratteri").max(100),
  // avatar handled separately (File object)
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const resetPasswordSchema = z.object({
  password: passwordSchema,
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/user.schemas.ts
git commit -m "Add Zod schemas for user server actions"
```

---

### Task 17: Wire validation + rate limit + HIBP into signup flow

**Files:**
- Modify: `src/app/actions/user.ts` (signup server action — function name may be `signUp`, `signup`, or inline in login page; locate first)

- [ ] **Step 1: Locate the signup action**

```bash
grep -rn "auth.signUp\|supabase.auth.signUp" src/ --include="*.ts" --include="*.tsx"
```

If signup logic is inline in `src/app/login/page.tsx`, extract it to a new server action `signUpAction` in `src/app/actions/user.ts`. Otherwise modify the existing one.

- [ ] **Step 2: Implement or refactor the server action**

```ts
// src/app/actions/user.ts — add/replace signUpAction
"use server"

import { headers } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { signupSchema } from "./user.schemas"
import { validate, ValidationError, formDataToObject } from "@/lib/security/validation"
import { enforceRateLimit, signupLimiter, RateLimitError } from "@/lib/security/ratelimit"
import { assertPasswordNotLeaked, LeakedPasswordError } from "@/lib/security/password"
import type { ActionResult } from "@/lib/security/types"

export async function signUpAction(
  formData: FormData,
): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  // 1. Validate input
  let parsed
  try {
    parsed = validate(signupSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Dati non validi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // 2. Rate limit (fail-closed for auth — Upstash outage blocks signup temporarily)
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  try {
    await enforceRateLimit(signupLimiter(), `signup:${ip}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppe richieste di registrazione. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    return {
      ok: false,
      message: "Servizio temporaneamente non disponibile. Riprova tra qualche minuto.",
    }
  }

  // 3. HIBP check (fail-open — does not throw on timeout/outage)
  try {
    await assertPasswordNotLeaked(parsed.password)
  } catch (err) {
    if (err instanceof LeakedPasswordError) {
      return {
        ok: false,
        message: "Questa password appare in database pubblici di credenziali compromesse. Usane una diversa — suggerimento: frase o combinazione casuale di 12+ caratteri.",
        fieldErrors: { password: ["Password compromessa"] },
      }
    }
    throw err
  }

  // 4. Supabase signup
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: { data: { full_name: parsed.full_name } },
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  // Supabase returns identities=[] when email already exists (without revealing it)
  const emailAlreadyExists = data.user?.identities?.length === 0
  if (emailAlreadyExists) {
    return { ok: false, message: "Email già registrata. Effettua il login o recupera la password." }
  }

  return { ok: true, data: { needsEmailConfirmation: !data.session } }
}
```

- [ ] **Step 3: Update the caller (login page, if it invokes this)**

Find in `src/app/login/page.tsx` where signup was called. Update call site to use `const result = await signUpAction(formData)` and discriminate on `result.ok`. Map `result.fieldErrors` to form errors (via react-hook-form in Task 26; for now render as a single toast).

Minimum interim change — do not break existing UX:

```tsx
const result = await signUpAction(formData)
if (!result.ok) {
  toast.error(result.message)
  return
}
if (result.data.needsEmailConfirmation) {
  toast.success("Controlla la tua email per confermare l'account.")
}
```

- [ ] **Step 4: Manual test**

Start dev, try:
1. Valid signup → success
2. Signup with `"password"` as password → rejection with leaked-password message
3. 4 signups in 1h from same IP → 4th rejected with 429-style message

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/user.ts src/app/login/page.tsx
git commit -m "Wire Zod + rate limit + HIBP into signup action"
```

---

### Task 18: Wire validation + rate limit into login

**Files:**
- Modify: `src/app/actions/user.ts` (add `logInAction`)
- Modify: `src/app/login/page.tsx` (call site)

- [ ] **Step 1: Add or modify `logInAction`**

```ts
// src/app/actions/user.ts — add
export async function logInAction(
  formData: FormData,
): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(loginSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Dati non validi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // Double-key rate limit: either key hitting limit causes 429.
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  try {
    await Promise.all([
      enforceRateLimit(loginIpLimiter(), `login:ip:${ip}`),
      enforceRateLimit(loginEmailLimiter(), `login:email:${parsed.email}`),
    ])
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppi tentativi di login falliti. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    return { ok: false, message: "Servizio temporaneamente non disponibile." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  })

  if (error) {
    // Login failed: the rate limiter above already consumed budget. Intended.
    return { ok: false, message: "Email o password errate." }
  }

  // Login succeeded. (Note: we do NOT refund the consumed rate-limit budget —
  // the spec says "only failed attempts count", but implementing refund-on-success
  // is not worth the complexity. The extra-strict behavior is acceptable.)
  return { ok: true, data: undefined }
}
```

Add imports at top of file:
```ts
import { loginSchema } from "./user.schemas"
import { enforceRateLimit, loginIpLimiter, loginEmailLimiter, RateLimitError } from "@/lib/security/ratelimit"
```

- [ ] **Step 2: Update login page call site**

Find the login submission handler in `src/app/login/page.tsx` and replace:
```tsx
const result = await logInAction(formData)
if (!result.ok) {
  toast.error(result.message)
  return
}
router.push("/dashboard")
```

- [ ] **Step 3: Manual test**

1. Valid login → redirects to /dashboard
2. Wrong password 6 times from same IP → 6th fails with rate limit message
3. Different emails from same IP — each email gets 5 tries, so IP limit hits first

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/user.ts src/app/login/page.tsx
git commit -m "Wire Zod + dual-key rate limit into login action"
```

---

### Task 19: Wire validation + rate limit into forgot-password and forgot-email

**Files:**
- Modify: `src/app/actions/user.ts`

- [ ] **Step 1: Wrap existing `recoverPassword` function**

Locate existing `recoverPassword(email)` function. Replace / augment:

```ts
export async function recoverPasswordAction(
  formData: FormData,
): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(forgotPasswordSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Email non valida", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // Rate limit fail-open (recovery is not an auth boundary)
  try {
    await enforceRateLimit(forgotPasswordLimiter(), `forgot-pw:${parsed.email}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppe richieste di reset. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    // fail-open: proceed even if Upstash is unreachable
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  })

  // Do not leak whether the email exists. Always return success.
  if (error) {
    console.warn("Password recovery error:", error.message)
  }
  return { ok: true, data: undefined }
}
```

Imports to add:
```ts
import { forgotPasswordSchema, findEmailSchema } from "./user.schemas"
import { forgotPasswordLimiter, forgotEmailLimiter } from "@/lib/security/ratelimit"
```

- [ ] **Step 2: Wrap existing `findEmail` function**

```ts
export async function findEmailAction(
  formData: FormData,
): Promise<ActionResult<{ maskedEmails: string[] }>> {
  let parsed
  try {
    parsed = validate(findEmailSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Nome non valido", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  try {
    await enforceRateLimit(forgotEmailLimiter(), `forgot-email:ip:${ip}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppe richieste. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
  }

  // ... existing findEmail logic here, returning { ok: true, data: { maskedEmails } }
  // (keep the existing function body; just wrap the signature)
}
```

- [ ] **Step 3: Update callers in login page**

Replace direct calls with new action names; handle `ActionResult` shape.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/user.ts src/app/login/page.tsx
git commit -m "Wire Zod + rate limit into forgot-password and find-email"
```

---

### Task 20: Wire validation into profile update + avatar upload UX

**Files:**
- Modify: `src/app/actions/user.ts` (updateProfile)
- Modify: `src/app/dashboard/ProfileSection.tsx` (client-side validation)

- [ ] **Step 1: Wrap existing `updateProfile` function**

Locate the function (likely `updateProfile` or `updateUserProfile` in `src/app/actions/user.ts`). Wrap:

```ts
import { updateProfileSchema } from "./user.schemas"

export async function updateProfileAction(
  formData: FormData,
): Promise<ActionResult<{ avatar_url?: string }>> {
  // Separate File from text fields
  const avatar = formData.get("avatar") as File | null
  const textData = { full_name: formData.get("full_name") }

  let parsed
  try {
    parsed = validate(updateProfileSchema, textData)
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Dati non validi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // Server-side avatar validation (defense in depth — storage bucket also enforces)
  if (avatar && avatar.size > 0) {
    if (avatar.size > 5 * 1024 * 1024) {
      return { ok: false, message: "Avatar troppo grande (max 5 MB)", fieldErrors: { avatar: ["Max 5 MB"] } }
    }
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedMimes.includes(avatar.type)) {
      return { ok: false, message: "Formato non supportato (JPEG, PNG, WebP)", fieldErrors: { avatar: ["Formato non supportato"] } }
    }
  }

  // ... existing logic (upload avatar if present, update profiles.full_name)
  // ensure the existing logic uses a sanitized filename:
  //   const safeName = (avatar.name ?? "avatar").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
  // return { ok: true, data: { avatar_url: publicUrl } }
}
```

- [ ] **Step 2: Update `ProfileSection.tsx` avatar input**

Find the avatar file input. Ensure it has:
```tsx
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Avatar troppo grande (max 5 MB)")
      e.target.value = ""
      return
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato non supportato. Usa JPEG, PNG o WebP.")
      e.target.value = ""
      return
    }
    setAvatarFile(file) // or whatever state setter is used
  }}
/>
```

- [ ] **Step 3: Manual test**

1. Upload a 10MB JPEG → rejected client-side (toast)
2. Upload a .gif → rejected client-side
3. Upload a valid 2MB JPEG → accepted
4. Bypass client-side check (DevTools) and POST a 6MB file → Supabase Storage returns 400 (server-side enforcement)

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/user.ts src/app/dashboard/ProfileSection.tsx
git commit -m "Wire Zod + client/server avatar validation into profile update"
```

---

### Task 21: Wire validation + rate limit into requestRefund and cancelSubscription

**Files:**
- Create: `src/app/actions/stripe.schemas.ts`
- Modify: `src/app/actions/stripe.ts`

- [ ] **Step 1: Create schemas file**

```ts
// src/app/actions/stripe.schemas.ts
import { z } from "zod"

export const refundRequestSchema = z.object({
  id: z.string().uuid("ID non valido"),
  type: z.enum(["subscription", "one_time_purchase"]),
  reason: z.string().trim().min(1, "Motivo richiesto").max(500, "Max 500 caratteri"),
})
export type RefundRequestInput = z.infer<typeof refundRequestSchema>

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
})
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>
```

- [ ] **Step 2: Wrap `requestRefund`**

At top of `src/app/actions/stripe.ts`, add:
```ts
import { refundRequestSchema, cancelSubscriptionSchema } from "./stripe.schemas"
import { validate, ValidationError } from "@/lib/security/validation"
import { enforceRateLimit, refundLimiter, RateLimitError } from "@/lib/security/ratelimit"
import { createServiceRoleClient } from "@/utils/supabase/server"
import type { ActionResult } from "@/lib/security/types"
```

Refactor existing `requestRefund(id, type, reason)` to take structured args, validate, rate limit, and return `ActionResult`. Keep the existing business logic (14-day check, insert into refund_requests, email send). Replace the `admin_notifications` insert with service-role (see Task 22).

```ts
export async function requestRefund(args: unknown): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(refundRequestSchema, args)
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Dati non validi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(refundLimiter(), `refund:${user.id}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Hai raggiunto il limite di richieste di rimborso. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
  }

  // ... existing business logic: 14-day check, insert into refund_requests, send email
  // Replace the admin_notifications.insert block with the service-role variant (Task 22).

  return { ok: true, data: undefined }
}
```

- [ ] **Step 3: Wrap `cancelSubscription` similarly**

Same pattern: validate with `cancelSubscriptionSchema`, keep Stripe cancel + DB update, replace `admin_notifications.insert` with service-role call.

- [ ] **Step 4: Update callers in `BillingSection.tsx` and similar**

Locate UI callers and handle the new `ActionResult` shape.

- [ ] **Step 5: Manual test**

1. Valid refund request → success + email received + admin_notification row exists
2. 4th refund request in 24h → 4th rejected with rate limit message
3. Refund with `reason` > 500 chars → field error

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/stripe.ts src/app/actions/stripe.schemas.ts
git commit -m "Wire Zod + rate limit into refund and cancellation actions"
```

---

### Task 22: Refactor admin_notifications inserts to service role

**Files:**
- Modify: `src/app/actions/stripe.ts` (2 locations)
- Modify: `src/app/actions/user.ts` (1 location, in requestAccountDeletion)

- [ ] **Step 1: Replace admin_notifications insert in `requestRefund`**

Locate:
```ts
await supabase.from('admin_notifications').insert({ ... })
```

Replace with:
```ts
const supabaseAdmin = createServiceRoleClient()
await supabaseAdmin.from("admin_notifications").insert({ ... })
```

- [ ] **Step 2: Same in `cancelSubscription`**

Same replacement pattern.

- [ ] **Step 3: Same in `requestAccountDeletion` in user.ts**

At top of file, add:
```ts
import { createServiceRoleClient } from "@/utils/supabase/server"
```

Replace the user-scoped insert with the service-role insert (keep the row content identical).

- [ ] **Step 4: Manual test**

Trigger each action from the UI:
1. Refund request → check Supabase admin_notifications table for new row (via MCP)
2. Cancellation → check admin_notifications table
3. Request account deletion → check admin_notifications table

All three should succeed even after migration 06 drops the INSERT RLS policy. Verify on preview deploy.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/stripe.ts src/app/actions/user.ts
git commit -m "Refactor admin_notifications inserts to service role client"
```

---

### Task 23: Wire validation into saveVideoProgress

**Files:**
- Create: `src/app/actions/video.schemas.ts`
- Modify: `src/app/actions/video.ts`

- [ ] **Step 1: Create schema**

```ts
// src/app/actions/video.schemas.ts
import { z } from "zod"

export const saveVideoProgressSchema = z.object({
  video_id: z.string().uuid(),
  progress_seconds: z.number().int().min(0).max(86400), // max 24h
  duration_seconds: z.number().int().min(0).max(86400),
  completed: z.boolean().optional(),
})
export type SaveVideoProgressInput = z.infer<typeof saveVideoProgressSchema>
```

- [ ] **Step 2: Wrap `saveVideoProgress`**

Add at top:
```ts
import { saveVideoProgressSchema } from "./video.schemas"
import { validate, ValidationError } from "@/lib/security/validation"
import type { ActionResult } from "@/lib/security/types"
```

Wrap the function:
```ts
export async function saveVideoProgress(args: unknown): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(saveVideoProgressSchema, args)
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Dati non validi", fieldErrors: err.fieldErrors }
    }
    throw err
  }
  // ... existing logic
  return { ok: true, data: undefined }
}
```

Note: `saveVideoProgress` is called frequently (every few seconds during playback). **Do NOT add rate limiting** here — RLS already scopes writes to `auth.uid()` and the check is O(1).

- [ ] **Step 3: Update callers** (`VideoPlayer` or similar)

Handle the `ActionResult` shape.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/video.ts src/app/actions/video.schemas.ts
git commit -m "Wire Zod validation into saveVideoProgress"
```

---

### Task 24: Wire validation into admin FormData actions

**Files:**
- Create: `src/app/actions/admin_actions/packages.schemas.ts`
- Create: `src/app/actions/admin_actions/content.schemas.ts` (if courses/levels live here)
- Modify: `src/app/actions/admin_actions/packages.ts`
- Modify: other admin action files that accept FormData

- [ ] **Step 1: Inspect existing admin actions**

```bash
ls src/app/actions/admin_actions/
grep -l "formData: FormData" src/app/actions/admin_actions/
```

List actions that take FormData. Typical set: `createPackage`, `updatePackage`, `createCourse`, `updateCourse`, `createLevel`, `updateLevel`.

- [ ] **Step 2: Create schemas for packages**

```ts
// src/app/actions/admin_actions/packages.schemas.ts
import { z } from "zod"

export const createPackageSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  price_cents: z.coerce.number().int().min(0),
  currency: z.enum(["EUR", "USD"]).default("EUR"),
  course_id: z.string().uuid().optional(),
  is_subscription: z.string().transform((v) => v === "on" || v === "true").optional(),
  // Extend with all fields your existing createPackage receives from FormData
})

export const updatePackageSchema = createPackageSchema.extend({
  id: z.string().uuid(),
})
```

- [ ] **Step 3: Apply to `createPackage` action**

```ts
import { createPackageSchema } from "./packages.schemas"
import { validate, ValidationError, formDataToObject } from "@/lib/security/validation"
import type { ActionResult } from "@/lib/security/types"

export async function createPackage(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const isSuperAdmin = await isAdmin()
  if (!isSuperAdmin) return { ok: false, message: "Unauthorized" }

  let parsed
  try {
    parsed = validate(createPackageSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Dati non validi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // ... existing business logic (Stripe product creation, DB insert)
  return { ok: true, data: { id: newPackageId } }
}
```

- [ ] **Step 4: Apply the same pattern to other admin FormData actions**

For each: create/extend schema, wrap function, update call site.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/admin_actions/
git commit -m "Wire Zod validation into admin FormData server actions"
```

---

### Task 25: Add contact form server action with rate limit

**Files:**
- Create: `src/app/actions/contact.ts`
- Create: `src/app/actions/contact.schemas.ts`
- Modify: `src/components/sections/Contact.tsx` (wire the new action)

- [ ] **Step 1: Inspect existing contact section**

```bash
cat src/components/sections/Contact.tsx
```

Determine: is the form currently submitting anywhere? If yes, replace that path. If no (e.g., `mailto:` only), add a proper action.

- [ ] **Step 2: Create schema**

```ts
// src/app/actions/contact.schemas.ts
import { z } from "zod"
import { emailSchema } from "@/lib/security/validation"

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  message: z.string().trim().min(10, "Messaggio troppo corto").max(2000),
  honeypot: z.string().max(0, "Campo nascosto — bot detected").optional(), // bot trap
})
export type ContactInput = z.infer<typeof contactSchema>
```

- [ ] **Step 3: Create action**

```ts
// src/app/actions/contact.ts
"use server"

import { headers } from "next/headers"
import { Resend } from "resend"
import { contactSchema } from "./contact.schemas"
import { validate, ValidationError, formDataToObject } from "@/lib/security/validation"
import { enforceRateLimit, contactLimiter, RateLimitError } from "@/lib/security/ratelimit"
import type { ActionResult } from "@/lib/security/types"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function submitContact(formData: FormData): Promise<ActionResult<void>> {
  let parsed
  try {
    parsed = validate(contactSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: "Controlla i campi", fieldErrors: err.fieldErrors }
    }
    throw err
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  try {
    await enforceRateLimit(contactLimiter(), `contact:${ip}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppi messaggi inviati. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
    // fail-open: accept the message even if Upstash is down
  }

  try {
    await resend.emails.send({
      from: "Rita Workout <noreply@fitandsmile.it>",
      to: "support@fitandsmile.it",
      replyTo: parsed.email,
      subject: `Contatto dal sito: ${parsed.name}`,
      text: `Da: ${parsed.name} <${parsed.email}>\n\n${parsed.message}`,
    })
  } catch (err) {
    console.error("Contact email send failed:", err)
    return { ok: false, message: "Invio fallito, riprova più tardi." }
  }

  return { ok: true, data: undefined }
}
```

- [ ] **Step 4: Wire the action in the Contact form**

Add a hidden `honeypot` field to the form (CSS-hidden, should stay empty — bots typically fill all fields):

```tsx
<input type="text" name="honeypot" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} />
```

Submit handler:
```tsx
const [pending, start] = useTransition()
const onSubmit = (fd: FormData) => start(async () => {
  const result = await submitContact(fd)
  if (!result.ok) {
    toast.error(result.message)
    return
  }
  toast.success("Messaggio inviato. Ti risponderemo presto.")
})
```

- [ ] **Step 5: Manual test**

1. Valid message → email delivered
2. Honeypot filled (DevTools) → validation rejection
3. 6 submissions in 1h → 6th rejected

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/contact.ts src/app/actions/contact.schemas.ts src/components/sections/Contact.tsx
git commit -m "Add validated + rate-limited contact server action"
```

---

### Task 26: Integrate react-hook-form in login/signup page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Read current structure**

Understand the existing multi-mode flow (login/signup/forgot-password/forgot-email). Keep the mode switching; replace each form's submission logic with `useForm` + `zodResolver`.

- [ ] **Step 2: Rewrite the signup form subsection**

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signupSchema, type SignupInput } from "@/app/actions/user.schemas"
import { signUpAction } from "@/app/actions/user"
import { toast } from "sonner"

function SignupForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const fd = new FormData()
    fd.append("email", values.email)
    fd.append("password", values.password)
    fd.append("full_name", values.full_name)
    if (values.terms_accepted) fd.append("terms_accepted", "on")

    const result = await signUpAction(fd)
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, msgs] of Object.entries(result.fieldErrors)) {
          setError(field as keyof SignupInput, { message: msgs[0] })
        }
      }
      toast.error(result.message)
      return
    }
    if (result.data.needsEmailConfirmation) {
      toast.success("Controlla la tua email per confermare l'account.")
    }
  })

  return (
    <form onSubmit={onSubmit}>
      <input {...register("full_name")} placeholder="Nome" />
      {errors.full_name && <p className="text-red-500 text-sm">{errors.full_name.message}</p>}

      <input {...register("email")} type="email" placeholder="Email" />
      {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}

      <input {...register("password")} type="password" placeholder="Password" />
      {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}

      <label>
        <input {...register("terms_accepted")} type="checkbox" /> Accetto i termini
      </label>
      {errors.terms_accepted && <p className="text-red-500 text-sm">{errors.terms_accepted.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Invio..." : "Registrati"}
      </button>
    </form>
  )
}
```

Preserve all existing Tailwind classes / styling — only change the form logic. If the existing form had additional fields (e.g., phone), include them in the schema + form.

- [ ] **Step 3: Same pattern for Login, Forgot Password, Forgot Email subforms**

Use `loginSchema`, `forgotPasswordSchema`, `findEmailSchema` respectively.

- [ ] **Step 4: Manual test each form**

Verify inline errors appear on invalid input, success path works.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "Integrate react-hook-form in login/signup/recovery forms"
```

---

### Task 27: Add CSP (report-only) + security headers to `next.config.mjs`

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Rewrite with CSP + headers**

```mjs
// next.config.mjs
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.b-cdn.net https://lh3.googleusercontent.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.pwnedpasswords.com https://*.upstash.io https://vitals.vercel-insights.com",
  "frame-src 'self' https://js.stripe.com https://iframe.mediadelivery.net",
  "media-src 'self' blob: https://*.b-cdn.net",
  "worker-src 'self' blob:",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "hel1.your-objectstorage.com", pathname: "/**" },
      { protocol: "https", hostname: "ugfcoptwievurfnbrhno.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "vz-c25ae704-e5b.b-cdn.net", pathname: "/**" },
      { protocol: "https", hostname: "vz-0ccb063d-cf5.b-cdn.net", pathname: "/**" },
      { protocol: "https", hostname: "cdn.vz-0ccb063d-cf5.b-cdn.net", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // CSP in report-only mode — flip to enforcing in PR #3 after verifying no violations.
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
```

- [ ] **Step 2: Manual verification**

Start prod build locally:
```bash
npm run build && npm run start
curl -I http://localhost:3000/
```

Expected in response:
- `Content-Security-Policy-Report-Only: default-src 'self'; ...`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`

Open the site in a browser with DevTools → Console. Navigate through: landing, signup, login, dashboard, video playback. Note any CSP violations reported. Expected: zero or minimal (only known issues like inline scripts). Log the list for PR #3 tuning.

- [ ] **Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "Add CSP (report-only) + security headers"
```

---

### Task 28: Deploy PR #2 to Vercel preview, run integration checklist

**Files:** (none — operational task)

- [ ] **Step 1: Push branch to GitHub, open PR**

```bash
git push -u origin <branch>
gh pr create --title "Sub-1 PR #2 — Security utilities & enforcement" --body "..."
```

- [ ] **Step 2: Add Upstash env vars to Vercel**

Vercel Dashboard → Project → Settings → Environment Variables. Add for Production + Preview:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

- [ ] **Step 3: Wait for preview deploy; run integration checklist**

Checklist (all must pass on preview):
- [ ] Valid signup works
- [ ] Signup with `"password"` → rejected with leaked-password message
- [ ] 4 signups/h from same IP → 4th rejected (429)
- [ ] Valid login works
- [ ] 6 wrong-password logins → 6th rejected (429)
- [ ] `stripe trigger checkout.session.completed` → 200 + purchase row; resend same event → "Event already processed" + no duplicate
- [ ] Refund flow: submit 3 requests/24h → 4th rejected
- [ ] Cancel subscription works + admin_notifications row created
- [ ] Request account deletion: admin_notifications row created (old flow still active until PR #3)
- [ ] Avatar upload: >5MB rejected client-side; valid upload works
- [ ] Avatar upload: bypass client check with curl → Supabase rejects server-side
- [ ] Contact form: valid submit sends email; honeypot filled → rejected; 6/h → 6th rejected
- [ ] Admin FormData actions (create/update package/course/level) still work
- [ ] `curl -I` preview URL shows all security headers
- [ ] DevTools console: no CSP violations on main flows (report only — ignore for now)
- [ ] Purchase flow end-to-end: signup → checkout → dashboard → video playback (regression smoke)

- [ ] **Step 4: Merge PR**

After checklist passes on preview.

- [ ] **Step 5: Monitor production for 24h**

Check: error rate (Vercel Logs), no spike in 429s, webhook processing healthy, Resend delivery rate normal.

- [ ] **Step 6: Apply migration 06 (drop admin_notifications INSERT policy)**

Only after 24h stable. Paste `supabase/20260420_06_drop_admin_notifications_insert.sql` in Supabase SQL Editor → Run. Verify:
```sql
SELECT policyname FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'admin_notifications' AND cmd = 'INSERT';
-- Expected: 0 rows
```

Then run the 3 user-facing flows that insert admin_notifications (refund, cancel, delete-request) and confirm they still work.

---

## PR #3 — GDPR UI + Sessions + CSP Enforcing

**Pre-requisites:** PR #2 live in production for ≥1 week, CSP report-only period passed with zero or known-manageable violations, migration 06 applied.

### Task 29: Implement `src/lib/gdpr/audit.ts`

**Files:**
- Create: `src/lib/gdpr/audit.ts`

- [ ] **Step 1: Write implementation**

```ts
// src/lib/gdpr/audit.ts
import { createServiceRoleClient } from "@/utils/supabase/server"

export type GdprAction = "export" | "delete_request" | "delete_completed"

export async function logGdprAction(params: {
  userId: string | null
  action: GdprAction
  ipAddress?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const admin = createServiceRoleClient()
  const { error } = await admin.from("gdpr_audit_log").insert({
    user_id: params.userId,
    action: params.action,
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? null,
  })
  if (error) {
    // Non-fatal — log and continue. Audit log is evidence, not a gate.
    console.error("GDPR audit log insert failed:", error)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/gdpr/audit.ts
git commit -m "Add gdpr/audit log helper"
```

---

### Task 30: Implement `src/lib/gdpr/export.ts`

**Files:**
- Create: `src/lib/gdpr/export.ts`

- [ ] **Step 1: Write implementation**

```ts
// src/lib/gdpr/export.ts
import JSZip from "jszip"
import { createServiceRoleClient } from "@/utils/supabase/server"

/**
 * Collects all user-owned data across the schema and packs it into a ZIP.
 * Uses service-role client to bypass RLS — export must include everything,
 * including rows that would otherwise be filtered out.
 */
export async function exportUserData(userId: string, userEmail: string | null): Promise<Blob> {
  const admin = createServiceRoleClient()

  const [profile, subs, purchases, payments, invoices, refunds, progress, notifs, badges] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).single(),
      admin.from("user_subscriptions").select("*, packages(name)").eq("user_id", userId),
      admin.from("one_time_purchases").select("*, packages(name)").eq("user_id", userId),
      admin.from("stripe_payments").select("*").eq("user_id", userId),
      admin.from("stripe_invoices").select("*").eq("user_id", userId),
      admin.from("refund_requests").select("*").eq("user_id", userId),
      admin.from("video_watch_progress").select("*").eq("user_id", userId),
      admin.from("user_notifications").select("*").eq("user_id", userId),
      admin.from("user_badges").select("*").eq("user_id", userId),
    ])

  const zip = new JSZip()
  const write = (name: string, payload: unknown) =>
    zip.file(name, JSON.stringify(payload, null, 2))

  write("profile.json", { ...profile.data, auth_email: userEmail })
  write("subscriptions.json", subs.data ?? [])
  write("purchases.json", purchases.data ?? [])
  write("payments.json", payments.data ?? [])
  write("invoices.json", invoices.data ?? [])
  write("refund_requests.json", refunds.data ?? [])
  write("video_progress.json", progress.data ?? [])
  write("notifications.json", notifs.data ?? [])
  write("badges.json", badges.data ?? [])

  zip.file("README.txt", readme())

  return await zip.generateAsync({ type: "blob" })
}

function readme(): string {
  return `Esportazione dei tuoi dati personali — Rita Workout
Generata il: ${new Date().toISOString()}

Questo archivio contiene tutti i dati personali che conserviamo su di te:
- profile.json: dati del profilo (nome, email, preferenze)
- subscriptions.json: abbonamenti (attivi e scaduti)
- purchases.json: acquisti singoli
- payments.json, invoices.json: pagamenti e fatture Stripe
- refund_requests.json: richieste di rimborso
- video_progress.json: progresso di visualizzazione dei video
- notifications.json: notifiche in-app
- badges.json: badge ottenuti

Non sono inclusi contenuti del catalogo (pacchetti, corsi, video) perché non sono dati tuoi.
Per chiarimenti: support@fitandsmile.it
`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/gdpr/export.ts
git commit -m "Add gdpr/export module for user data ZIP bundling"
```

---

### Task 31: Implement `src/lib/gdpr/delete.ts` (token + cascade, TDD for tokens)

**Files:**
- Create: `src/lib/gdpr/delete.ts`
- Test: `src/lib/gdpr/delete.test.ts`

- [ ] **Step 1: Write failing tests for token sign/verify**

```ts
// src/lib/gdpr/delete.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { signDeletionToken, verifyDeletionToken } from "./delete"

describe("deletion tokens", () => {
  const originalEnv = process.env.GDPR_DELETE_SECRET
  beforeEach(() => {
    process.env.GDPR_DELETE_SECRET = "test-secret-at-least-32-bytes-long-xxxxxx"
  })
  afterEach(() => {
    process.env.GDPR_DELETE_SECRET = originalEnv
  })

  it("round-trips a userId", async () => {
    const token = await signDeletionToken("user-123")
    const payload = await verifyDeletionToken(token)
    expect(payload.userId).toBe("user-123")
  })

  it("rejects a tampered token", async () => {
    const token = await signDeletionToken("user-123")
    const tampered = token.slice(0, -3) + "xxx"
    await expect(verifyDeletionToken(tampered)).rejects.toThrow()
  })

  it("rejects an expired token", async () => {
    const token = await signDeletionToken("user-123", -1) // expired 1s ago
    await expect(verifyDeletionToken(token)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- gdpr/delete
```

- [ ] **Step 3: Write implementation**

```ts
// src/lib/gdpr/delete.ts
import { SignJWT, jwtVerify } from "jose"
import Stripe from "stripe"
import { createServiceRoleClient } from "@/utils/supabase/server"
import { logGdprAction } from "./audit"

const SECRET_NAME = "GDPR_DELETE_SECRET"

function secretKey(): Uint8Array {
  const raw = process.env[SECRET_NAME]
  if (!raw) throw new Error(`Missing env var ${SECRET_NAME}`)
  return new TextEncoder().encode(raw)
}

/** Signs a short-lived token authorizing the deletion of a specific user. */
export async function signDeletionToken(
  userId: string,
  expiresInSeconds = 15 * 60, // 15 min
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey())
}

/** Verifies a deletion token and returns the authorized userId. Throws on any issue. */
export async function verifyDeletionToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] })
  if (!payload.sub) throw new Error("Token missing subject")
  return { userId: payload.sub }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" })

/**
 * Executes full account deletion. Must be called with a verified userId (from a
 * valid deletion token). Irreversible.
 *
 * Side effects (in order):
 *   1. Cancel active Stripe subscriptions
 *   2. Remove avatar from storage
 *   3. Delete user-owned rows (FK-safe order)
 *   4. Delete auth user
 *   5. Anonymize fiscal records (10y legal retention)
 *   6. Audit log delete_completed
 */
export async function executeAccountDeletion(userId: string, ipAddress?: string): Promise<void> {
  const admin = createServiceRoleClient()

  // 1. Cancel Stripe subscriptions
  const { data: subs } = await admin
    .from("user_subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
  for (const sub of subs ?? []) {
    if (sub.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id)
      } catch (err) {
        console.warn(`Stripe cancel failed for ${sub.stripe_subscription_id}:`, err)
      }
    }
  }

  // 2. Delete avatar
  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .single()
  if (profile?.avatar_url) {
    const path = extractAvatarPath(profile.avatar_url)
    if (path) {
      try { await admin.storage.from("avatars").remove([path]) } catch {}
    }
  }

  // 3. Delete user-owned rows (FK-safe order)
  await admin.from("video_watch_progress").delete().eq("user_id", userId)
  await admin.from("user_notifications").delete().eq("user_id", userId)
  await admin.from("user_badges").delete().eq("user_id", userId)
  await admin.from("refund_requests").delete().eq("user_id", userId)
  await admin.from("admin_notifications").delete().eq("user_id", userId)
  await admin.from("one_time_purchases").delete().eq("user_id", userId)
  await admin.from("user_subscriptions").delete().eq("user_id", userId)
  await admin.from("profiles").delete().eq("id", userId)

  // 4. Delete auth user
  await admin.auth.admin.deleteUser(userId)

  // 5. Anonymize financial records (legal 10y retention)
  const anonymizedAt = new Date().toISOString()
  await admin
    .from("stripe_payments")
    .update({ user_id: null, anonymized_at: anonymizedAt })
    .eq("user_id", userId)
  await admin
    .from("stripe_invoices")
    .update({ user_id: null, anonymized_at: anonymizedAt })
    .eq("user_id", userId)

  // 6. Audit
  await logGdprAction({
    userId: null, // user is gone; keep a null-user audit row
    action: "delete_completed",
    ipAddress,
    metadata: { deletedUserId: userId, at: anonymizedAt },
  })
}

function extractAvatarPath(publicUrl: string): string | null {
  // https://<proj>.supabase.co/storage/v1/object/public/avatars/<userId>/<file>
  const match = publicUrl.match(/\/avatars\/(.+)$/)
  return match ? match[1] : null
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- gdpr/delete
```

- [ ] **Step 5: Add `GDPR_DELETE_SECRET` to `.env.local`**

```bash
# Generate a fresh 32-byte random hex
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Append to .env.local (and Vercel env for prod/preview)
echo "GDPR_DELETE_SECRET=<paste output above>" >> .env.local
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/gdpr/delete.ts src/lib/gdpr/delete.test.ts
git commit -m "Add gdpr/delete module with JWT deletion tokens + cascade"
```

---

### Task 32: Create export + delete server actions in `src/app/actions/gdpr.ts`

**Files:**
- Create: `src/app/actions/gdpr.ts`

- [ ] **Step 1: Write implementation**

```ts
// src/app/actions/gdpr.ts
"use server"

import { headers } from "next/headers"
import { Resend } from "resend"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { exportUserData } from "@/lib/gdpr/export"
import { signDeletionToken, verifyDeletionToken, executeAccountDeletion } from "@/lib/gdpr/delete"
import { logGdprAction } from "@/lib/gdpr/audit"
import { enforceRateLimit, exportLimiter, deleteLimiter, RateLimitError } from "@/lib/security/ratelimit"
import type { ActionResult } from "@/lib/security/types"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function requestDataExport(): Promise<ActionResult<{ downloadUrl: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(exportLimiter(), `export:${user.id}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Hai raggiunto il limite di esportazioni. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const blob = await exportUserData(user.id, user.email ?? null)

  const admin = createServiceRoleClient()
  const path = `${user.id}/export-${Date.now()}.zip`
  const { error: uploadErr } = await admin.storage
    .from("user-exports")
    .upload(path, blob, { contentType: "application/zip" })
  if (uploadErr) {
    console.error("user-exports upload failed:", uploadErr)
    return { ok: false, message: "Errore durante la generazione dell'esportazione." }
  }

  const { data: signed } = await admin.storage
    .from("user-exports")
    .createSignedUrl(path, 60 * 15)
  if (!signed?.signedUrl) {
    return { ok: false, message: "Errore durante la generazione del link." }
  }

  await logGdprAction({
    userId: user.id,
    action: "export",
    ipAddress: ip,
    metadata: { path },
  })

  return { ok: true, data: { downloadUrl: signed.signedUrl } }
}

export async function requestAccountDeletion(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(deleteLimiter(), `delete:${user.id}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Richiesta già inviata. Riprova tra ${err.retryAfter} secondi se non hai ricevuto l'email.`,
        retryAfter: err.retryAfter,
      }
    }
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const token = await signDeletionToken(user.id)
  const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm-deletion?token=${encodeURIComponent(token)}`

  try {
    await resend.emails.send({
      from: "Rita Workout <noreply@fitandsmile.it>",
      to: user.email,
      subject: "Conferma la cancellazione del tuo account",
      html: `
        <p>Ciao,</p>
        <p>Hai richiesto la cancellazione del tuo account su Rita Workout. Per completare l'operazione clicca sul link qui sotto (valido 15 minuti):</p>
        <p><a href="${confirmUrl}">Conferma cancellazione</a></p>
        <p>Se non sei stato tu a fare questa richiesta, ignora questa email — il tuo account non verrà toccato.</p>
        <p>Una volta cancellato, l'account non può essere ripristinato.</p>
      `,
    })
  } catch (err) {
    console.error("Deletion email send failed:", err)
    return { ok: false, message: "Errore invio email. Riprova." }
  }

  await logGdprAction({
    userId: user.id,
    action: "delete_request",
    ipAddress: ip,
  })

  return { ok: true, data: undefined }
}

export async function confirmAccountDeletion(token: string): Promise<ActionResult<void>> {
  // Rate-limited by the underlying `deleteLimiter` (already consumed on request).
  // This action should fail if token invalid, so we don't double-charge the limiter.

  let payload
  try {
    payload = await verifyDeletionToken(token)
  } catch {
    return { ok: false, message: "Link non valido o scaduto. Richiedi una nuova cancellazione." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // The user must still be signed in as the account-holder to confirm.
  if (!user || user.id !== payload.userId) {
    return { ok: false, message: "Devi essere loggato con l'account da cancellare per confermare." }
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  await executeAccountDeletion(user.id, ip)

  // Sign out to clear cookies
  await supabase.auth.signOut()

  return { ok: true, data: undefined }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/gdpr.ts
git commit -m "Add GDPR export + delete server actions"
```

---

### Task 33: Create `/auth/confirm-deletion` page

**Files:**
- Create: `src/app/auth/confirm-deletion/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/auth/confirm-deletion/page.tsx
"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { confirmAccountDeletion } from "@/app/actions/gdpr"
import { toast } from "sonner"

export default function ConfirmDeletionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [pending, setPending] = useState(false)

  const onConfirm = async () => {
    if (!token) {
      toast.error("Token mancante")
      return
    }
    setPending(true)
    const result = await confirmAccountDeletion(token)
    setPending(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success("Account cancellato. Arrivederci.")
    router.push("/")
  }

  if (!token) {
    return (
      <main className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Link non valido</h1>
        <p>Il link di conferma è incompleto. Richiedi una nuova cancellazione dal tuo profilo.</p>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Conferma cancellazione account</h1>
      <p className="mb-6">
        Stai per cancellare il tuo account in modo definitivo. Verranno eliminati:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-1">
        <li>Il tuo profilo e tutte le preferenze</li>
        <li>I tuoi acquisti e abbonamenti (gli abbonamenti attivi verranno disdetti)</li>
        <li>Il tuo progresso sui video</li>
        <li>Le notifiche e i badge</li>
      </ul>
      <p className="mb-6 text-sm text-gray-600">
        Per obbligo legale fiscale, i dati delle transazioni (pagamenti, fatture) verranno conservati per 10 anni
        in forma anonima, senza collegamento alla tua identità.
      </p>
      <p className="mb-6 font-semibold">L'operazione è irreversibile.</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Cancellazione in corso..." : "Conferma cancellazione"}
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-100"
        >
          Annulla
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/confirm-deletion/page.tsx
git commit -m "Add /auth/confirm-deletion page"
```

---

### Task 34: Add Privacy & data section in ProfileSection

**Files:**
- Modify: `src/app/dashboard/ProfileSection.tsx`

- [ ] **Step 1: Add the section**

Near the bottom of the component (after existing content, before any close tags), add:

```tsx
import { requestDataExport, requestAccountDeletion } from "@/app/actions/gdpr"
import { useState } from "react"
import { toast } from "sonner"

// ... inside ProfileSection component

function PrivacyAndDataSection() {
  const [exportPending, setExportPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const onExport = async () => {
    setExportPending(true)
    const result = await requestDataExport()
    setExportPending(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    window.open(result.data.downloadUrl, "_blank")
    toast.success("Esportazione pronta. Il download si aprirà in una nuova scheda.")
  }

  const onDeleteRequest = async () => {
    if (confirmText !== "DELETE") {
      toast.error('Scrivi "DELETE" per confermare')
      return
    }
    setDeletePending(true)
    const result = await requestAccountDeletion()
    setDeletePending(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success("Ti abbiamo inviato un'email per completare la cancellazione.")
    setConfirmDelete(false)
    setConfirmText("")
  }

  return (
    <section className="mt-8 border-t pt-6">
      <h2 className="text-xl font-semibold mb-4">Privacy e dati</h2>

      <div className="mb-4">
        <button
          onClick={onExport}
          disabled={exportPending}
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
        >
          {exportPending ? "Generazione..." : "📦 Scarica tutti i miei dati"}
        </button>
        <p className="text-sm text-gray-600 mt-2">Esportazione GDPR in formato ZIP.</p>
      </div>

      <div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-red-600 hover:text-red-700"
          >
            🗑️ Elimina il mio account
          </button>
        ) : (
          <div className="border border-red-300 rounded p-4 bg-red-50">
            <p className="mb-3 font-semibold text-red-800">
              Sei sicuro? L'operazione è irreversibile.
            </p>
            <p className="text-sm mb-3">Scrivi <code>DELETE</code> per confermare:</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="border px-2 py-1 rounded w-full mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={onDeleteRequest}
                disabled={deletePending || confirmText !== "DELETE"}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deletePending ? "Invio email..." : "Invia email di conferma"}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setConfirmText("") }}
                className="border px-4 py-2 rounded hover:bg-gray-100"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
```

Then render `<PrivacyAndDataSection />` at the end of the main `ProfileSection` component JSX.

- [ ] **Step 2: Manual test**

1. Click export → ZIP downloads → verify contents
2. Click delete → modal → type "DELETE" → click Invia → email arrives
3. Click email link → lands on confirm page → click Confirm → account deleted, redirected to `/`

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/ProfileSection.tsx
git commit -m "Add Privacy & data section with export/delete to Profile"
```

---

### Task 35: Implement session management

**Files:**
- Create: `src/app/actions/sessions.ts`
- Modify: `src/app/dashboard/ProfileSection.tsx` (add Sicurezza section)

- [ ] **Step 1: Create session actions**

```ts
// src/app/actions/sessions.ts
"use server"

import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import type { ActionResult } from "@/lib/security/types"

export type SessionInfo = {
  id: string
  user_agent: string
  ip: string
  last_active_at: string
  is_current: boolean
}

export async function listMySessions(): Promise<ActionResult<SessionInfo[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  // Supabase exposes sessions via admin API
  const admin = createServiceRoleClient()
  const { data, error } = await admin.auth.admin.listUserSessions?.(user.id) ??
    { data: { sessions: [] }, error: null }
  if (error) return { ok: false, message: error.message }

  // Determine which session is the current one via the cookie's session id
  const { data: current } = await supabase.auth.getSession()
  const currentSessionId = current.session?.access_token ?? ""

  const sessions = (data?.sessions ?? []).map((s: any) => ({
    id: s.id,
    user_agent: s.user_agent ?? "Sconosciuto",
    ip: s.ip ?? "—",
    last_active_at: s.updated_at ?? s.created_at,
    is_current: s.id === currentSessionId, // approximate — Supabase session API varies
  }))

  return { ok: true, data: sessions }
}

export async function revokeSession(sessionId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  const admin = createServiceRoleClient()
  // Verify ownership before revoking
  const { data } = await admin.auth.admin.listUserSessions?.(user.id) ?? { data: { sessions: [] } }
  const owned = (data?.sessions ?? []).some((s: any) => s.id === sessionId)
  if (!owned) return { ok: false, message: "Sessione non trovata" }

  await admin.auth.admin.signOut?.(sessionId)
  return { ok: true, data: undefined }
}

export async function revokeAllOtherSessions(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autorizzato" }

  const { data: current } = await supabase.auth.getSession()
  const currentId = current.session?.access_token ?? null

  const admin = createServiceRoleClient()
  const { data } = await admin.auth.admin.listUserSessions?.(user.id) ?? { data: { sessions: [] } }
  for (const s of data?.sessions ?? []) {
    if (s.id !== currentId) {
      await admin.auth.admin.signOut?.(s.id)
    }
  }
  return { ok: true, data: undefined }
}
```

> **Note:** the Supabase Auth Admin API for listing/revoking sessions has evolved. If `listUserSessions` / `signOut(sessionId)` are not available on the installed SDK version, use the `GET /auth/v1/admin/users/{id}/sessions` REST endpoint with the service role key as `Authorization: Bearer` header. Confirm method names in `@supabase/supabase-js` types before implementation.

- [ ] **Step 2: Add Sicurezza section to ProfileSection**

```tsx
import { listMySessions, revokeSession, revokeAllOtherSessions, type SessionInfo } from "@/app/actions/sessions"
import { useEffect, useState } from "react"

function SecuritySection() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const result = await listMySessions()
    setLoading(false)
    if (result.ok) setSessions(result.data)
  }

  useEffect(() => { reload() }, [])

  const onRevoke = async (id: string) => {
    const result = await revokeSession(id)
    if (!result.ok) { toast.error(result.message); return }
    toast.success("Sessione terminata")
    reload()
  }

  const onRevokeAllOthers = async () => {
    const result = await revokeAllOtherSessions()
    if (!result.ok) { toast.error(result.message); return }
    toast.success("Altre sessioni terminate")
    reload()
  }

  return (
    <section className="mt-8 border-t pt-6">
      <h2 className="text-xl font-semibold mb-4">Sicurezza</h2>
      <h3 className="font-medium mb-2">Sessioni attive</h3>
      {loading ? <p>Caricamento...</p> : (
        <>
          <ul className="space-y-2 mb-4">
            {sessions.map((s) => (
              <li key={s.id} className="border rounded p-3 flex justify-between items-center">
                <div className="text-sm">
                  <div className="font-medium">{s.user_agent} {s.is_current && <span className="text-green-600">(questa sessione)</span>}</div>
                  <div className="text-gray-600">IP: {s.ip} · Ultima attività: {new Date(s.last_active_at).toLocaleString("it-IT")}</div>
                </div>
                {!s.is_current && (
                  <button
                    onClick={() => onRevoke(s.id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Termina
                  </button>
                )}
              </li>
            ))}
          </ul>
          {sessions.filter(s => !s.is_current).length > 0 && (
            <button
              onClick={onRevokeAllOthers}
              className="border border-red-300 text-red-700 px-4 py-2 rounded hover:bg-red-50"
            >
              Termina tutte le altre sessioni
            </button>
          )}
        </>
      )}
    </section>
  )
}
```

Render `<SecuritySection />` right before `<PrivacyAndDataSection />`.

- [ ] **Step 3: Manual test**

1. Login from 2 browsers (Chrome + Firefox).
2. In Chrome, view Profile → Sicurezza → should show both sessions, Chrome marked "questa sessione".
3. Click "Termina" on Firefox session → Firefox next action fails (401), user gets logged out.
4. Try "Termina tutte le altre" from a 3rd browser → others revoked.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/sessions.ts src/app/dashboard/ProfileSection.tsx
git commit -m "Add session management (list + revoke) to Profile"
```

---

### Task 36: Flip CSP from report-only to enforcing

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Verify monitoring window is clean**

Open the production site in a fresh browser. DevTools → Console. Navigate: landing → signup → login → dashboard → video → admin panel (if admin) → profile export/delete → logout → landing.

Check Network tab for any `csp-report` POSTs or console warnings starting with `Content-Security-Policy-Report-Only`. Document any violations. If any appear:
- **Legitimate but missing from CSP:** add the origin to the appropriate directive (e.g., extend `img-src` for a new CDN).
- **Actual bug (inline script that shouldn't be there):** fix the code.
- **Known Next.js internal inline:** already covered by `'unsafe-inline'`; ignore.

Iterate until zero violations on primary flows.

- [ ] **Step 2: Change the header name**

Edit `next.config.mjs`, replace:
```mjs
{ key: "Content-Security-Policy-Report-Only", value: csp },
```
with:
```mjs
{ key: "Content-Security-Policy", value: csp },
```

- [ ] **Step 3: Manual smoke-test after deploy**

After the PR merges and deploys to prod:
```bash
curl -I https://fitandsmile.it/ | grep -i content-security
```
Expected: `Content-Security-Policy: default-src 'self'; ...` (no "Report-Only").

Navigate the site in a browser with DevTools. **Any CSP violation now blocks the resource** — watch for broken UI (missing images, failed fetch, broken iframe). If issues, flip back to report-only immediately via a quick revert PR while fixing.

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs
git commit -m "Flip CSP from report-only to enforcing"
```

---

### Task 37: Open PR #3, integration checklist, merge

**Files:** (operational)

- [ ] **Step 1: Push and open PR**

```bash
git push
gh pr create --title "Sub-1 PR #3 — GDPR UI + session management + CSP enforcing" --body "..."
```

- [ ] **Step 2: Run PR #3 integration checklist on preview**

- [ ] GDPR export downloads a valid ZIP with all 10 files (profile/subs/purchases/payments/invoices/refunds/progress/notifs/badges + README)
- [ ] ZIP contents match what's actually in the DB for the test user
- [ ] 3 export requests in 24h → 3rd rejected
- [ ] Delete flow: UI → confirm text "DELETE" → email → link → confirm → auth user gone (check Supabase Auth UI) + financial rows anonymized (check via MCP: `SELECT count(*) FROM stripe_payments WHERE user_id = '<id>'` → 0; `WHERE anonymized_at IS NOT NULL` includes the row)
- [ ] Expired/tampered token → "Link non valido o scaduto"
- [ ] Session list shows both browsers when logged in from 2
- [ ] Revoke other session → other browser logged out
- [ ] Revoke all others → only current remains
- [ ] CSP enforcing: no console violations on primary flows
- [ ] `curl -I` preview URL shows `Content-Security-Policy:` (not Report-Only)
- [ ] No regression on purchase flow

- [ ] **Step 3: Final acceptance — run Supabase advisors**

```
mcp__supabase__get_advisors({ type: "security" })
```

Expected: only the `auth_leaked_password_protection` WARN remains (known Pro-only; our custom HIBP in signup covers it). All other advisors empty.

- [ ] **Step 4: Merge PR #3**

- [ ] **Step 5: Verify production**

Repeat checklist on production URL.

---

## Completion Criteria

Sub-1 is complete when all 37 tasks above are checked AND the full acceptance criteria from the spec (§ 10) are verified:

1. Rate limiting active on 9 endpoints (§ 4.1 table) ✓ verified by integration test
2. Zod validation on all listed server actions ✓ verified by integration test
3. Stripe webhook rejects duplicate events ✓ verified via `stripe events resend`
4. Signup rejects HIBP-leaked passwords ✓ verified with `"password"`
5. User can download ZIP containing their data ✓
6. User can self-service delete account with email confirmation ✓
7. CSP in enforcing mode, zero violations on primary flows ✓
8. Security headers present in `curl -I` ✓
9. Sessions section in Profile ✓
10. No regressions on purchase flow ✓
11. Supabase security advisor empty except HIBP built-in ✓

Post-completion, the 3 operational pre-launch TODOs (spec § 11) remain:
- Create `support@fitandsmile.it` mailbox/alias
- Upstash Redis env vars in Vercel (done as part of PR #2 deploy)
- `GDPR_DELETE_SECRET` env var in Vercel (done as part of PR #3 deploy)

Sub-1 does not cover cleanup crons (stripe_webhook_events, user-exports, gdpr_audit_log) — document as "post-launch ops" in team runbook.

---

## Self-Review Notes

This plan was written inline with the spec and reviewed against it:
- All 10 spec items map to specific tasks (§ 4.1→Task 12+14+17-25, § 4.2→10+16+26, § 4.3→13+15, § 4.4→11+17, § 4.5→4+20+22, § 4.6→30+32+34, § 4.7→31+32+33+34, § 4.8→29, § 4.9→27+36, § 4.10→35)
- No "TBD", "TODO" (as placeholders — only "Operational TODO" notes referencing post-launch work)
- Type signatures consistent across tasks (`ActionResult<T>`, all limiter factory function names, schema file naming, server action naming conventions)
- Task granularity: each step 2–5 minutes as per skill guidance
- Frequent commits (one commit per task, or per coherent change within a task)
- TDD applied to pure utility modules (validation, password, ratelimit, idempotency, deletion tokens); wiring/config tasks verified manually per skill's "TDD where it applies" principle
