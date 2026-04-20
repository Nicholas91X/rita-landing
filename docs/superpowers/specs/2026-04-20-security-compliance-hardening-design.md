# Sub-1 — Security & Compliance Hardening

**Status:** design approved, pending implementation plan
**Date:** 2026-04-20
**Scope owner:** Nicholas
**Context:** first of 6 sub-projects in the production-readiness roadmap (see `memory/brainstorming_prod_readiness.md`). Precedes Sub-2 (PWA push/offline), Sub-3 (auth UX), Sub-4 (video), Sub-5 (landing funnel), Sub-6 (optional UI restyle).

---

## 1. Purpose

Close the security and GDPR gaps required to launch Rita publicly as a premium product. The codebase is already mostly mature (7/12 subsystems rated mature in the 2026-04-20 audit, see memory). This sub-project addresses the residual blockers: rate limiting, input validation, webhook idempotency, password breach checks, storage hardening, CSP, session management, GDPR export/delete self-service.

## 2. Scope

### In scope (10 items)

**Launch blockers:**
1. Rate limiting on `/login`, `/signup`, `/forgot-password`, `/forgot-email`, `/contact`, refund/cancellation server actions, generic `/api/*`
2. Stripe webhook idempotency via dedicated `stripe_webhook_events` table
3. Zod validation on all server actions that accept user input
4. GDPR export (ZIP) + delete self-service with email confirmation, audit log, Italian-law-compliant fiscal anonymization
5. HIBP Pwned Passwords custom integration (Supabase built-in is Pro-only)
6. Avatar bucket size (5 MB) and MIME type limits; server-side enforcement

**High-priority polish:**
7. Content Security Policy (report-only → enforcing) bundled with the full security header suite (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS without preload)
8. Refactor of `admin_notifications` INSERT to service role; drop the user-facing INSERT RLS policy
9. Rate limiting extended beyond blockers (contact form, internal APIs)

**Nice-to-have:**
10. Session management UI (list active sessions, revoke others)

2FA was in the original brainstorm but was removed per user decision. The "full security headers" item from the brainstorm is folded into item 7 (CSP section) since they co-locate in `next.config.mjs`.

### Out of scope

- 2FA / MFA (explicitly excluded, deferred)
- Full E2E test infrastructure (Playwright) — unit tests on utilities only, manual smoke for the rest
- `user-exports` bucket cleanup cron (documented as operational TODO)
- `stripe_webhook_events` table retention cron (documented as operational TODO)
- Manual replay script for failed webhook events (documented for future)
- Landing funnel analytics, video optimization, PWA push — belong to other sub-projects

## 3. Architecture

Principle: each item lives in its most natural layer. No monolithic "security framework".

| Layer | Location | Items |
|---|---|---|
| Config | `next.config.mjs` | CSP + security headers |
| Middleware | `src/middleware.ts` | Coarse IP-based rate limit on `/api/*` and `/auth/*` |
| Utility (cross-cutting) | `src/lib/security/ratelimit.ts`<br>`src/lib/security/validation.ts`<br>`src/lib/security/idempotency.ts`<br>`src/lib/security/password.ts` | Rate limit per-action, Zod schemas, webhook dedup, HIBP |
| Feature (GDPR) | `src/lib/gdpr/export.ts`<br>`src/lib/gdpr/delete.ts`<br>`src/app/auth/confirm-deletion/*` | Export ZIP + self-service deletion |
| DB migrations | `supabase/*.sql` | New tables, bucket limits, policy changes |
| Client UI | `src/app/dashboard/ProfileSection.tsx` | Privacy & data section, security section (sessions) |

### Request flow — signup example

```
browser POST /signup
    │
    ▼
middleware.ts                 ← coarse IP rate limit (100/min)
    │
    ▼
signupAction() server action
    │
    ├─ validate(signupSchema, formData)         ← Zod (sync, cheap, rejects junk first)
    ├─ enforceRateLimit(signupLimiter, ip)      ← fine-grained (3/1h per IP)
    ├─ await assertPasswordNotLeaked(password)  ← HIBP (external, ~100-3000ms, fail-open)
    └─ supabase.auth.signUp({ email, password })
```

Order rationale: cheapest/fastest checks first. Zod rejects obviously malformed input without consuming rate-limit budget. HIBP (the only slow external dependency) runs last so a HIBP outage doesn't amplify into other failures.

### Error propagation convention

Server actions return a discriminated union:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
```

Client catches `{ ok: false }` and either shows a toast (global errors) or maps `fieldErrors` into react-hook-form state (form-field errors).

## 4. Components

### 4.1 Rate limiting

**Stack:** `@upstash/ratelimit` + `@upstash/redis`, sliding-window algorithm.

**Module:** `src/lib/security/ratelimit.ts` exports `makeLimiter(prefix, max, window)` factory and `enforceRateLimit(limiter, key)` which throws `RateLimitError` on denial.

**Limit table:**

| Endpoint / action | Key | Limit | Window | Failure mode |
|---|---|---|---|---|
| `POST /login` (failed attempts only) | `login:ip:{ip}` AND `login:email:{email}` (either hits → 429) | 5 | 15 min sliding | **fail-closed** |
| `POST /signup` | `signup:ip:{ip}` | 3 | 1 h | **fail-closed** |
| `POST /forgot-password` | `forgot:email:{email}` | 3 | 1 h | fail-open |
| `POST /forgot-email` | `forgot-email:ip:{ip}` | 5 | 1 h | fail-open |
| Contact form | `contact:ip:{ip}` | 5 | 1 h | fail-open |
| `requestRefund` | `refund:user:{userId}` | 3 | 24 h | fail-open |
| `requestAccountDeletion` | `delete:user:{userId}` | 2 | 24 h | fail-open |
| `requestDataExport` | `export:user:{userId}` | 2 | 24 h | fail-open |
| `/api/*` (coarse, middleware) | `api:ip:{ip}` | 100 | 1 min | fail-open |

Stripe webhook: no rate limit (Stripe burst delivery is legitimate; idempotency handles duplicates).

**Fail-open vs fail-closed:** if Upstash is unreachable (timeout >500ms), fail-closed auth endpoints (`/login`, `/signup`) return 503 to prevent an attacker from exploiting an Upstash outage to bypass brute-force protection. All other endpoints fail-open and log the failure.

**HTTP response:** middleware catches `RateLimitError` → `429` + `Retry-After: <seconds>` header. Server actions let it bubble → client action wrapper catches and returns `{ ok: false, message: "Troppe richieste, riprova tra X secondi" }`.

**Client UX:** forms affected should disable submit button and show countdown when receiving `{ ok: false }` with retry info. Minimal, non-blocking implementation per form.

**Env vars (new):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

### 4.2 Input validation (Zod)

**Stack:** `zod` + `@hookform/resolvers/zod` + `react-hook-form` (new dep).

**Shared schemas:** `src/lib/security/validation.ts` exports:
- `emailSchema` — trim, lowercase, email, max 254
- `passwordSchema` — 8-72 chars, requires uppercase + lowercase + digit
- `shortTextSchema` — trim, 1-500 chars

**Feature schemas:** co-located near their actions (e.g., `src/app/actions/stripe.schemas.ts`, `src/app/actions/user.schemas.ts`).

**Helper:** `validate(schema, data)` returns parsed data or throws `ValidationError` with flattened field errors.

**Server action convention:**
```ts
export async function updateProfile(formData: FormData): Promise<ActionResult<void>> {
  const parsed = updateProfileSchema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    return { ok: false, message: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }
  }
  // ...
}
```

**Actions to validate (public input surface):**
- `signupAction`, `loginAction`, `requestPasswordReset`, `findEmail`
- `updateProfile`
- `requestRefund`, `cancelSubscription`, `requestAccountDeletion`
- `submitContact` (if/when contact form is wired to an action)
- `saveVideoProgress`
- Admin actions accepting FormData: `createPackage`, `updatePackage`, `createCourse`, `updateCourse`, `createLevel`, `updateLevel`, any others in `src/app/actions/admin_actions/*`

**Not validated:**
- Stripe webhook body (already validated by signature + Stripe SDK types; we still assert `metadata.user_id` is a UUID before trusting it)
- Actions with no input (`signOut`, etc.)

**Client-side integration:** signup, login, profile edit, contact forms switch to `react-hook-form` with `zodResolver(schema)`. Same schema is imported on both client and server — no duplication. Client-side validation runs instantly for UX; server-side validation is the authoritative gate.

### 4.3 Webhook idempotency

**New table:** `stripe_webhook_events`

```sql
CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);
CREATE INDEX idx_webhook_events_processed_at
  ON public.stripe_webhook_events(processed_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = no client access; service role bypasses RLS.
```

**Helper:** `src/lib/security/idempotency.ts` exports `claimWebhookEvent(supabaseAdmin, event)`. Returns `{ alreadyProcessed: true }` if duplicate (detected via PK violation code `23505`), else inserts and returns `{ alreadyProcessed: false }`.

**Handler integration:** in `src/app/api/webhooks/stripe/route.ts`, after `stripe.webhooks.constructEvent(...)` and before any domain logic:

```ts
const { alreadyProcessed } = await claimWebhookEvent(supabaseAdmin, event)
if (alreadyProcessed) return new Response('Event already processed', { status: 200 })
```

**Payload stored verbatim (jsonb).** Reason: enables manual replay of events whose processing failed after the claim. Cost: ~1-5 KB per row. At expected Rita volume, 90 days of retention is well under 500 MB.

**Operational TODO (out of scope):** scheduled cleanup query removing rows older than 90 days. Document in README, run manually for now.

### 4.4 Password security (HIBP)

**Module:** `src/lib/security/password.ts` exports:
- `hibpCheck(password: string): Promise<number>` — returns breach count (0 = safe)
- `assertPasswordNotLeaked(password, threshold=1): Promise<void>` — throws `LeakedPasswordError` if `count >= threshold`

**Algorithm:** k-anonymity via `api.pwnedpasswords.com/range/{first-5-sha1-chars}` with `Add-Padding: true` header (prevents response-size timing attacks). Check if our hash's 35-char suffix appears in the returned list.

**Threshold:** 1 (reject any password with ≥1 breach occurrence; matches Supabase built-in default).

**Timeout:** 3000 ms. On timeout or non-200 response: **fail-open** (log warning, return 0 = safe). Rationale: a HIBP outage should not block signup; the narrow residual risk (a known-leaked password passes during the outage window) is acceptable.

**Integration points:**
- `signupAction` — before `supabase.auth.signUp()`
- `resetPasswordAction` (new password via reset link) — before `supabase.auth.updateUser({ password })`
- `changePasswordAction` (if introduced in Sub-3)

**UX message on rejection** (Italian):
> "Questa password appare in database pubblici di credenziali compromesse. Usa una password diversa — il tuo account sarebbe esposto al brute force. Suggerimento: una frase o una combinazione casuale di 12+ caratteri."

### 4.5 Avatar bucket hardening + admin_notifications refactor

**Bucket limits migration:**
```sql
UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';
```

**Client-side UX validation** (early rejection before upload): `<input accept="image/jpeg,image/png,image/webp">` + `file.size <= 5 * 1024 * 1024` check + filename sanitization (`replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)`).

**`admin_notifications` refactor (Option B):**

Three server actions currently insert into `admin_notifications` using a user-scoped client, relying on an INSERT policy `WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid())`. Refactor to use service-role client:
- `requestAccountDeletion` (`src/app/actions/user.ts:603`)
- `requestRefund` (`src/app/actions/stripe.ts:215`)
- `cancelSubscription` (`src/app/actions/stripe.ts:279`)

Each call site creates a service-role client (`createServiceRoleClient()`) solely for the `insert` call.

**Policy drop migration:**
```sql
DROP POLICY IF EXISTS "Authenticated users can insert notifications"
  ON public.admin_notifications;
```

After this, no user-facing client can touch `admin_notifications`. Architectural rule becomes uniform: "admin-side tables have zero client-visible write policies".

### 4.6 GDPR export

**Function:** `src/lib/gdpr/export.ts` → `exportUserData(userId): Promise<Blob>` returns a ZIP.

**ZIP contents:**
- `profile.json` — row from `profiles`, auth email, full_name, avatar_url, created_at, preferences
- `subscriptions.json` — `user_subscriptions` rows (joined with `packages(name)` for context)
- `purchases.json` — `one_time_purchases`
- `payments.json` — `stripe_payments` (last4 + receipt_url only; no PAN)
- `invoices.json` — `stripe_invoices`
- `refund_requests.json`
- `video_progress.json` — `video_watch_progress`
- `notifications.json` — `user_notifications`
- `badges.json` — `user_badges`
- `README.txt` — plain Italian explanation of contents, generation date, `support@fitandsmile.it` contact

**Excluded:** `admin_notifications`, `stripe_webhook_events` (infrastructure), content entities (packages/courses/levels/videos — not the user's data), `gdpr_audit_log` (administrative).

**Dependency:** `jszip` (holds in memory; expected export size <1 MB).

**Server action `requestDataExport()`:**
1. Auth check
2. `enforceRateLimit(exportLimiter, "export:user:{uid}")` (2/24 h)
3. `exportUserData(userId)` → Blob
4. Upload to new bucket `user-exports` (private, RLS default-deny) at `{userId}/export-{timestamp}.zip`
5. `admin.storage.from('user-exports').createSignedUrl(path, 900)` → 15-min signed URL
6. Log action to `gdpr_audit_log`
7. Return `{ ok: true, data: { downloadUrl } }`

**New bucket migration:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('user-exports', 'user-exports', false, 52428800) -- 50 MB ceiling
ON CONFLICT (id) DO NOTHING;
```

**Operational TODO:** scheduled cleanup removing `user-exports` files older than 7 days.

### 4.7 GDPR delete (self-service)

**Two-step confirmation:**

Step 1 — Profile UI:
- User clicks "Elimina account"
- Modal requires: typed "DELETE" confirmation + current password re-entry
- On submit: server action `requestAccountDeletion()` logs intent, generates JWT token (signed with `GDPR_DELETE_SECRET` env var, `sub = userId`, `exp = +15min`), sends confirmation email

Step 2 — Email link:
- Link lands on `/auth/confirm-deletion?token=...`
- Page verifies token server-side, shows final confirmation button
- On confirm: server action `executeAccountDeletion(userId)` runs the cascade

**Why two steps:** protects against account takeover — an attacker with a hijacked session alone cannot complete deletion without mailbox access.

**Cascade order (`executeAccountDeletion`):**
1. Cancel Stripe subscriptions immediately (`stripe.subscriptions.cancel`). Try/catch; don't block cascade on Stripe error — log to `gdpr_audit_log` for manual admin follow-up.
2. Delete avatar from `avatars` bucket.
3. Delete rows from user-owned tables in FK-safe order:
   `video_watch_progress` → `user_notifications` → `user_badges` → `refund_requests` → `admin_notifications` → `one_time_purchases` → `user_subscriptions` → `profiles`
4. Delete auth user: `admin.auth.admin.deleteUser(userId)`
5. Anonymize financial rows (legal requirement — Italian law, 10-year fiscal retention under GDPR Art. 6.1.c "legal obligation"):
   ```sql
   UPDATE stripe_payments SET user_id = NULL, anonymized_at = now() WHERE user_id = :uid;
   UPDATE stripe_invoices SET user_id = NULL, anonymized_at = now() WHERE user_id = :uid;
   ```
6. Log `delete_completed` to `gdpr_audit_log`.
7. Send confirmation email (best-effort; failure does not rollback).

**Migrations:**
```sql
ALTER TABLE public.stripe_payments ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
ALTER TABLE public.stripe_invoices ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
ALTER TABLE public.stripe_payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.stripe_invoices ALTER COLUMN user_id DROP NOT NULL;
```

**Env var:** `GDPR_DELETE_SECRET` (HMAC key for token signing, 32+ random bytes).

**Deprecation:** the existing `requestAccountDeletion()` that writes `admin_notifications` for manual handling becomes the automated flow. The admin-mediated backlog in `getAccountDeletionNotifications` can stay as an audit view but is no longer the execution path.

### 4.8 GDPR audit log

**Migration:**
```sql
CREATE TABLE public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, -- nullable: survives the user's deletion
  action text NOT NULL CHECK (action IN ('export', 'delete_request', 'delete_completed')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  metadata jsonb
);
ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.
```

Inserted from: `requestDataExport`, `requestAccountDeletion`, `executeAccountDeletion`. Read from admin UI (via service role) when investigating disputes.

### 4.9 CSP + security headers

**Strategy:** deploy `Content-Security-Policy-Report-Only` in PR #2, monitor Vercel logs + DevTools reports for 1-2 weeks, tune, then flip to `Content-Security-Policy` (enforcing) in PR #3.

**Directives** (`next.config.mjs` `headers()`):

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https://*.supabase.co https://*.b-cdn.net https://lh3.googleusercontent.com;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.pwnedpasswords.com https://*.upstash.io https://vitals.vercel-insights.com;
frame-src 'self' https://js.stripe.com https://iframe.mediadelivery.net;
media-src 'self' blob: https://*.b-cdn.net;
worker-src 'self' blob:;
form-action 'self' https://checkout.stripe.com;
base-uri 'self';
frame-ancestors 'none';
```

**Accepted compromises:**
- `'unsafe-inline'` on `script-src` is required by Next.js inline hydration scripts. Removing it requires nonce-based refactor (non-trivial, deferred).
- `'unsafe-eval'` on `script-src` is a Next.js dev tooling requirement. Acceptable in prod but could be tightened later.

**Companion headers** (always enforcing, not report-only):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (legacy browser fallback for `frame-ancestors`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` — **no preload** (reversible by design)

### 4.10 Session management UI

**Server actions** (all service-role):
- `listMySessions()` — returns `Session[]` from `admin.auth.admin.listUserSessions(userId)`
- `revokeSession(sessionId)` — verify ownership, then `admin.auth.admin.deleteSession(sessionId)`
- `revokeAllOtherSessions()` — revoke all user sessions except the current one

**UI** — new "Sicurezza" section in `src/app/dashboard/ProfileSection.tsx`:
- List of active sessions with: IP, parsed User-Agent (browser + OS), last activity, "this session" marker
- Per-session revoke button
- "Termina tutte le altre sessioni" button

Optional (not in Sub-1): reverse-geo IP lookup for country display.

## 5. Data model changes summary

New tables:
- `stripe_webhook_events(event_id PK, event_type, processed_at, payload jsonb)`
- `gdpr_audit_log(id, user_id nullable, action, occurred_at, ip_address, metadata)`

New columns:
- `stripe_payments.anonymized_at timestamptz`
- `stripe_invoices.anonymized_at timestamptz`

Column nullability change:
- `stripe_payments.user_id` → nullable (for fiscal anonymization)
- `stripe_invoices.user_id` → nullable

New storage buckets:
- `user-exports` — private, 50 MB ceiling

Bucket config updates:
- `avatars` — `file_size_limit = 5 MB`, `allowed_mime_types = image/jpeg|png|webp`

Policy drops:
- `admin_notifications` — "Authenticated users can insert notifications"

RLS: all new tables have RLS enabled with no policies (service-role-only access).

## 6. Dependencies

**New npm packages:**
- `@upstash/ratelimit`, `@upstash/redis` (rate limiting)
- `zod` (validation; may already be installed — verify)
- `react-hook-form`, `@hookform/resolvers` (client-side form integration)
- `jszip` (GDPR export ZIP)
- `vitest` + `@vitest/ui` (unit tests, dev only)

**New environment variables:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GDPR_DELETE_SECRET` (≥32 random bytes, HMAC signing of deletion tokens)

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rate limit too aggressive blocks legitimate users | Medium | Medium | Upstash dashboard shows hit rate; tune post-deploy with real traffic |
| Zod validation breaks existing forms (missing fields) | Medium | High | Roll out per-form, manual smoke-test each; return `{ fieldErrors }` for graceful UX |
| HIBP API outage blocks signup for hours | Low | High | Fail-open with 3 s timeout (accepted residual risk) |
| Webhook idempotency claim fails on transient DB error | Low | High | Returns 500 → Stripe retries → next attempt succeeds. No double processing |
| CSP enforcing breaks invisible features (widgets, trackers) | Medium | Low–Medium | Report-only mode for 1-2 weeks before flip |
| Account deletion cascade fails mid-flow (Stripe down) | Low | High | Try/catch around Stripe cancel; partial state logged to `gdpr_audit_log` for manual admin follow-up |
| User regrets deletion (no recovery window) | Medium | Medium | Two-step confirmation (password + email) gives ~15-min effective window. Not designed as soft-delete — aligns with "right to erasure" spirit |
| HSTS header caches incorrect setting | Low | Medium | `max-age` without `preload` means ~2 years worst case; revertible by removing header |

## 8. Testing & verification

### Unit tests (Vitest)

Target: pure utility functions, no mocking of Next.js framework internals.

Files:
- `src/lib/security/password.test.ts` — mock `fetch`, verify k-anonymity hashing, breach count parsing, fail-open on timeout
- `src/lib/security/validation.test.ts` — representative valid/invalid cases for each shared schema
- `src/lib/security/idempotency.test.ts` — mock Supabase client, verify PK conflict detection path
- `src/lib/security/ratelimit.test.ts` — mock Upstash Ratelimit, verify error propagation

Target coverage: the utilities above; no coverage target for existing untested code.

### Manual integration checklist (deployment verification)

Per PR:
1. **Rate limit:** 6 failed logins from same IP → verify 429 on attempt 6
2. **Zod:** signup with malformed email → verify `fieldErrors.email`
3. **Webhook idempotency:** `stripe trigger checkout.session.completed` twice with same event → verify single row in `one_time_purchases`, second response is "Event already processed"
4. **HIBP:** signup with `"password"` → verify rejection with leaked-password message
5. **GDPR export:** trigger from Profile → download ZIP → inspect contents match spec
6. **GDPR delete:** full flow (signup → delete request → email click → confirm) → verify auth user deleted, profiles row deleted, stripe_payments anonymized
7. **CSP:** navigate all major flows with DevTools open → verify zero CSP violations in console (report-only phase)
8. **Security headers:** `curl -I https://fitandsmile.it` → verify all headers present
9. **Session mgmt:** login from 2 browsers → list shows both → revoke non-current → verify other browser is logged out on next action
10. **Advisor sweep:** run `mcp__supabase__get_advisors({type: "security"})` → verify only HIBP-builtin warning remains (Pro-only, known limitation)

### Pre-existing regression smoke test

Run the full purchase flow (landing → signup → checkout → dashboard → video playback) after PR #2 merges. Any regression on this path blocks further work.

## 9. Rollout plan

Three PRs. Each independently mergeable.

### PR #1 — DB migrations (zero client risk)

Applied via Supabase SQL Editor. New SQL files in `supabase/`:
- `20260420_webhook_events_table.sql`
- `20260420_gdpr_audit_log.sql`
- `20260420_stripe_anonymization_columns.sql`
- `20260420_avatars_bucket_limits.sql`
- `20260420_user_exports_bucket.sql`
- `20260420_drop_admin_notifications_insert.sql` (depends on PR #2 deploying the service-role refactor — see ordering note below)

Verification: `mcp__supabase__list_tables`, `mcp__supabase__execute_sql` smoke queries, `mcp__supabase__get_advisors`.

**Ordering note:** drop the `admin_notifications` INSERT policy AFTER PR #2 is live in production (otherwise existing code breaks). In practice: ship PR #2 first, then apply only this DROP migration. Scripted into the PR #1 sequence as the last step.

### PR #2 — Utilities & enforcement

Code changes:
- Install new npm deps
- Add Upstash env vars + `GDPR_DELETE_SECRET` to Vercel
- Create `src/lib/security/*` and `src/lib/gdpr/*` modules
- Wire rate limit + Zod + HIBP into `signupAction`, `loginAction`, password-reset, refund, cancellation, deletion, contact
- Webhook handler: add `claimWebhookEvent` at top of POST
- Refactor `admin_notifications` inserts to service-role client in 3 locations
- `next.config.mjs`: CSP in **report-only** + full security headers (HSTS enforcing, no preload)
- Unit test suite for utility modules

Deploy to Vercel preview → run manual integration checklist → merge to main → production deploy → run checklist again on production.

### PR #3 — GDPR UI + sessions + CSP enforcing flip

Code changes:
- Add "Privacy e dati" section to `ProfileSection.tsx` (export + delete buttons)
- Add "Sicurezza" section (session list + revoke)
- New page `src/app/auth/confirm-deletion/page.tsx`
- New server actions: `requestDataExport`, `requestAccountDeletion` (new version), `executeAccountDeletion`, `listMySessions`, `revokeSession`, `revokeAllOtherSessions`
- Flip CSP from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` (only after verifying zero violations in monitoring window)

Deploy + manual checklist for GDPR and session flows.

## 10. Acceptance criteria

Sub-1 is done when:

1. Rate limiting active on the 9 endpoints in § 4.1 table, verified by integration test
2. Zod validation enforced on all server actions listed in § 4.2, verified by integration test
3. Stripe webhook rejects duplicate events (verified via `stripe trigger` CLI replay)
4. Signup rejects HIBP-leaked passwords (verified with `"password"`, `"123456"`, etc.)
5. User can download ZIP containing their data from Profile
6. User can self-service delete their account with email confirmation; auth row + user-owned data gone, financial rows anonymized
7. CSP in enforcing mode, zero violations in DevTools on primary flows
8. Security headers present in `curl -I` output: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS
9. "Sicurezza" section in Profile lists active sessions; revoke actions work
10. No regressions on the purchase flow (signup → checkout → dashboard → video)
11. Supabase security advisor output empty except `auth_leaked_password_protection` (known Pro-only limitation, covered by our custom HIBP)

## 11. Operational pre-launch TODOs

Items surfaced during brainstorming that are not code changes but must happen before launch:

- Create `support@fitandsmile.it` mailbox or alias on the domain provider (domain already DNS-verified on Resend for `noreply@`). Referenced by GDPR export README, privacy policy, various error messages.
- Add Upstash Redis credentials to Vercel project env vars.
- Add `GDPR_DELETE_SECRET` to Vercel project env vars (generate with `openssl rand -hex 32`).

## 12. Future work (explicitly deferred)

- 2FA/MFA (user-excluded)
- CSP without `'unsafe-inline'` (nonce-based, requires Next.js refactor)
- Scheduled cleanup cron for `stripe_webhook_events` (>90d), `user-exports` (>7d), `gdpr_audit_log` retention policy
- Webhook event manual replay tooling
- HSTS preload submission (reconsider after 6-12 months of stable HTTPS)
- E2E test suite (Playwright) covering purchase + GDPR flows
- Full Supabase Pro subscription (unlocks native HIBP, removing need for custom integration)
- Reverse-geo IP lookup for session list
