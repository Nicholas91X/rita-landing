# Sub-3 — Auth & UX Polish Design

**Date:** 2026-04-23
**Status:** Design approved, pending implementation plan

## 1. Purpose

After Sub-1 (security & compliance) and Sub-2 (push & offline), a set of auth/UX rough edges remained. This sub-project addresses 7 items across 2 PRs: password strength UX, email verification surface, Google OAuth sign-in, user-facing button dedup/loading-state audit, and Supabase auth email customisation (templates + SMTP).

No new database tables. No migrations. No breaking changes to existing user flows.

## 2. Scope

### In

1. **Live password strength meter** (all 3 password-set entry points: signup, change, reset)
2. **Email verification banner** on `/dashboard` with "Resend" CTA + 24h dismiss cooldown
3. **Google OAuth** sign-in (both signup and login modes) with pre-OAuth terms-of-service checkbox
4. **Button audit** for user-facing server-action mutations: server-side dedup (Tier 1) + optimistic UI / loading state (Tier 1 + 2)
5. **Custom Supabase auth email templates** (HTML, Italian copy, brand Rita) for: signup confirmation, reset password, change email
6. **SMTP switch Supabase Auth → Resend** so auth emails come from `noreply@fitandsmile.it` with better deliverability

### Out

- 2FA / TOTP — reconsider post-launch if needed
- Password history (no-reuse-last-N) — adds DB complexity, deferred
- Account deletion UI refactor — already shipped in Sub-1 PR #4
- E2E test automation (Playwright/Cypress) — project does not have this stack
- Refactor of password validation rules (keep `min 8 + upper/lower/digit` from Sub-1)
- Video offline caching → Sub-4
- Analytics tracking → Sub-5

## 3. Architecture

### 3.1 New files

```
src/
  components/
    auth/
      PasswordStrengthMeter.tsx
      PasswordStrengthMeter.test.tsx
      GoogleSignInButton.tsx
      EmailVerificationBanner.tsx
  lib/
    password-strength.ts
    password-strength.test.ts
docs/
  auth-email-templates/
    confirm-signup.html
    reset-password.html
    change-email.html
  superpowers/
    specs/
      2026-04-23-auth-ux-polish-qa-checklist.md
```

### 3.2 Modified files

```
package.json                                   // + @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
src/app/login/page.tsx                         // mount meter + Google button + terms checkbox pre-OAuth
src/app/auth/reset-password/page.tsx           // mount meter
src/app/auth/callback/route.ts                 // sanity check ?terms=1 for OAuth signup flow
src/app/dashboard/ProfileSection.tsx           // mount meter in password-change card
src/app/dashboard/DashboardClient.tsx          // mount EmailVerificationBanner
src/app/dashboard/BillingSection.tsx           // optimistic update cancel_at_period_end + refund dedup UI
src/app/actions/stripe.ts                      // cancelSubscription early-return + requestRefund dedup + createCheckoutSession dedup
src/app/actions/user.ts                        // updateProfileAction / updateEmail / updatePassword / requestAccountDeletion loading state docs
src/app/actions/gdpr.ts                        // requestAccountDeletionGdpr dedup
src/app/actions/sessions.ts                    // revokeSession / revokeAllOtherSessions loading state docs
```

### 3.3 Supabase Dashboard config (not git-versioned)

- Auth → Providers → Google → enabled, client_id + secret from Google Cloud Console
- Auth → Email Templates → 3 custom HTML templates
- Auth → SMTP Settings → Resend (host `smtp.resend.com`, port 465, user `resend`, password = existing Resend API key)
- Auth → URL Configuration → ensure `https://www.fitandsmile.it/auth/callback` is in the allowed redirect list

## 4. Data model

No SQL changes. Existing `auth.users.email_confirmed_at` is the source of truth for email verification. Existing `user_subscriptions.cancel_at_period_end` is the source of truth for cancellation state.

## 5. Feature specs

### 5.1 Password strength meter

Library: `@zxcvbn-ts/core` + `@zxcvbn-ts/language-common` + `@zxcvbn-ts/language-en`. Bundle cost: ~15 KB gzipped (vs 40 KB for classic `zxcvbn`). English dictionary is sufficient because Rita's target users, while Italian, still type many English-origin words and brand names the dictionary catches.

`src/lib/password-strength.ts` exports:

```ts
export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string   // "Molto debole" | "Debole" | "Media" | "Forte" | "Ottima"
}
export function computeStrength(value: string): Strength
```

Lazy-imports the language packs on first call, caches the zxcvbn instance. Returns `{ score: 0, label: "" }` on empty string (render empty state).

`<PasswordStrengthMeter value={password} />` renders 5 segmented bars + label. Colors: score 0 red-500, 1 orange-500, 2 yellow-500, 3 emerald-500, 4 teal-400. Uses existing Tailwind palette. No callback props — pure presentation.

Mounted in 3 places:
- `src/app/login/page.tsx` — under password field in signup form
- `src/app/auth/reset-password/page.tsx` — under password field
- `src/app/dashboard/ProfileSection.tsx` — in "Change password" card, under the "new password" field

**Behaviour is advisory only.** Submit is gated solely by existing Zod rules (`passwordSchema` in `src/lib/security/validation.ts`) + Sub-1's HIBP Pwned Passwords check. A score of 0 with compliant regex still submits — the meter just educates.

### 5.2 Email verification banner

`<EmailVerificationBanner />` mounts in `DashboardClient.tsx` (at the top of the flex column, above `<DashboardSidebar>`).

Logic:
```
On mount:
  - fetch supabase.auth.getUser()
  - if user.email_confirmed_at is null AND localStorage['email-verify-dismissed-at']
    is either absent or older than 24h → show banner
  - start polling every 30s

Banner renders:
  - Background: bg-orange-500/10, border-b border-orange-500/30, top-of-screen, 48px tall
  - Copy: "📧 Conferma la tua email per ricevere aggiornamenti importanti e non perdere l'accesso."
  - CTA: <button onClick={resend}>Rinvia email</button>
  - Close icon (X): sets localStorage['email-verify-dismissed-at'] = Date.now(), hides banner

Resend CTA:
  - await supabase.auth.resend({ type: 'signup', email: user.email })
  - on success: toast.success("Email inviata, controlla la casella (anche spam)")
  - on rate limit error (Supabase's built-in 60s): toast.error("Email già inviata, aspetta un minuto")

Polling:
  - every 30s, re-fetch user
  - if email_confirmed_at becomes non-null → hide banner immediately, stop polling
  - polling stops naturally on unmount (cleanup effect)
```

Edge: when user changes email via `supabase.auth.updateUser({ email })`, Supabase resets `email_confirmed_at` to null. Banner reappears for the new address. Matches desired UX.

### 5.3 Google OAuth

`<GoogleSignInButton termsAccepted={boolean} />` mounts in `src/app/login/page.tsx` in both signup and login modes. Disabled (`aria-disabled`, opacity 50) when `!termsAccepted` in signup mode. Always enabled in login mode.

Click handler:
```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback?source=google&terms=${termsAccepted ? '1' : '0'}`,
  },
})
```

`src/app/login/page.tsx` already has a terms-accepted checkbox in the signup form (used by email/password flow). In signup mode the same checkbox now additionally gates the Google button.

`src/app/auth/callback/route.ts` is extended: when `source === 'google'` AND the matching `auth.users` row has `created_at` equal to (or within ±1s of) the session issued-at, treat this as signup flow and require `terms === '1'`. If missing, redirect `/login?error=terms-missing` (and delete the freshly-created identity if possible, so the user can retry cleanly). For existing-user logins via Google (`source=google` but pre-existing `auth.users` row), the terms param is ignored — consent was collected at original signup. This is a belt-and-suspenders check; the UI already disables the Google button without the checkbox.

Auto-link behaviour: if a Rita `auth.users` row already exists with the same email, Supabase's default "enable linking" behaviour adds Google as an additional identity. User can log in either way. No manual merge code needed.

Profile row population: Supabase has a trigger (`on_auth_user_created` per Sub-1 memory) that inserts a `profiles` row with `full_name` from `user_metadata`. Google provides `user_metadata.name` (maps to `full_name`). If Google profile has no display name (rare), `full_name = ''` and the user can fill it later from Profile → Dati personali.

### 5.4 Button audit — dedup + loading

**Tier 1 (A + B: server dedup + client loading + optimistic UI):**

| Action | File | Dedup check | Optimistic UI |
|---|---|---|---|
| `cancelSubscription` | `stripe.ts` | early-return if already `cancel_at_period_end=true` | set `cancel_at_period_end=true` locally pre-fetchSubs |
| `requestRefund` | `stripe.ts` | early-return if an existing `refund_requests` row for this sub/purchase has `status IN ('pending','approved')` | disable "Richiedi rimborso" button for that item after success |
| `requestAccountDeletion` | `user.ts` | early-return if admin_notifications already has a `type='deletion_request'` row from this user in last 24h | show "Richiesta inviata" confirmation, hide submit button |
| `requestAccountDeletionGdpr` | `gdpr.ts` | early-return if an unused token for this user exists in last 24h | same UX as above |
| `createCheckoutSession` | `stripe.ts` | idempotency key `checkout:${userId}:${packageId}` in Upstash with 60s TTL via a helper extending Sub-1's `src/lib/security/idempotency.ts` pattern (separate namespace from webhook idempotency); on duplicate, return the same checkout URL from the cached result instead of creating a second Stripe session | button disabled during redirect |

**Tier 2 (B only: client loading / disabled button):**

| Action | Location in UI | Loading state |
|---|---|---|
| `updateProfileAction` | Profile → Dati personali | Submit button shows Loader2 during call, disabled |
| `updateEmail` | Profile → Dati personali | Same |
| `updatePassword` | Profile → Sicurezza → Cambia password | Same |
| `revokeSession` | Profile → Sessioni | Revoke button shows Loader2, disabled for that row |
| `revokeAllOtherSessions` | Profile → Sessioni | "Revoca tutte le altre" button shows Loader2, disabled |

**Already covered (no changes):**

- `signUpAction` — `signupLimiter` from Sub-1 (3 per hour)
- `recoverPasswordAction` — `forgotPasswordLimiter` from Sub-1 (3 per hour)
- `submitContact` — `contactLimiter` from Sub-1 (5 per hour)
- `requestDataExport` — `exportLimiter` from Sub-1 (2 per 24h)

### 5.5 Email templates (HTML)

3 custom templates in `docs/auth-email-templates/` and pasted into Supabase Dashboard → Authentication → Email Templates:

- `confirm-signup.html` — sent on signup, subject "Conferma la tua email · Rita Workout"
- `reset-password.html` — sent on password recovery, subject "Reimposta la password · Rita Workout"
- `change-email.html` — sent on email update (both old and new addresses), subject "Conferma il cambio email · Rita Workout"

Structure (shared shell):
```
<!DOCTYPE html>
<html lang="it">
  <body style="margin:0;background:#001F3D;font-family:Arial,sans-serif;">
    <table width="100%" bgcolor="#001F3D">
      <tr><td align="center">
        <img src="https://www.fitandsmile.it/logo/logo.png" width="120" alt="Rita">
        <h1 style="color:#fff;">...title...</h1>
        <p style="color:#ccc;">...body...</p>
        <a href="{{ .ConfirmationURL }}" style="background:#F46530;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;">
          Conferma
        </a>
      </td></tr>
    </table>
  </body>
</html>
```

Copy adapted per template. Variables used: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`. All inline CSS — no external stylesheets (Gmail/Outlook strip them).

### 5.6 SMTP switch

Supabase Dashboard → Authentication → SMTP Settings → fill in:
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: existing Resend API key (already in use by `src/lib/email.ts` for Sub-1 transactional emails)
- Sender name: `Rita Workout`
- Sender email: `noreply@fitandsmile.it`

Free tier compatible on both Supabase and Resend sides. Post-switch, auth emails come from `noreply@fitandsmile.it` instead of `noreply@mail.app.supabase.io` → higher deliverability, branded sender.

## 6. Error handling

See design section 3 of the brainstorming transcript for full edge-case matrix. Key items worth re-stating here:

- Password meter library load failure → component renders nothing (fail-soft). Form still validates server-side.
- Resend rate-limited → toast with localised message, no retry loop.
- OAuth consent denied → redirect `/login?error=oauth-cancelled`.
- Cancel subscription race (two concurrent requests) → Postgres serialises, second request hits the early-return guard. Result: 1 row in `admin_notifications`, idempotent outcome.
- Refund request existing `pending` row → server returns `{ ok: false, message: 'Richiesta già in corso' }`.
- Account deletion second request within 24h → server returns `{ ok: true }` with no side effect (user already scheduled for deletion).

## 7. Testing strategy

### Unit (vitest)

- `src/lib/password-strength.test.ts`: empty → score 0, dictionary word → score 0, strong mix → score ≥ 3, monotonic-on-length, label mapping
- `src/components/auth/PasswordStrengthMeter.test.tsx`: empty state renders 5 grey bars, strong value renders 5 coloured bars, lib-load error renders null
- `src/app/actions/stripe.test.ts` (NEW file): cancelSubscription early-return case + requestRefund already-pending case + createCheckoutSession idempotency-key case

### Manual QA

Checklist committed at `docs/superpowers/specs/2026-04-23-auth-ux-polish-qa-checklist.md` covering:

- Password meter in all 3 locations, 4 scenarios each
- Email banner: show/hide/dismiss/resend/polling
- Google OAuth: new user happy path, existing user auto-link, terms-bypass attempt, consent denied
- Button audit: 9 Tier-1/Tier-2 actions, verify loading state + dedup
- Email templates: visual inspection in Gmail / Apple Mail / spam folder placement (before vs after SMTP switch)
- SMTP: signup fresh user post-switch → email arrives from `noreply@fitandsmile.it` within 30s

### Build / lint / typecheck

- `npm run lint` clean (only pre-existing DashboardClient warnings)
- `npx tsc --noEmit` clean
- `npm run build` succeeds
- `npx vitest run` — all passing

## 8. Rollout

### PR #8 — Client UX + button audit (~3.5h dev)

Scope: items 1, 2, 4 (password meter + email banner + button audit). Zero Supabase Dashboard config. Mergeable standalone.

### PR #9 — Supabase config tranche (~1.5h dev + 30min ops)

Scope: items 3, 5, 6 (Google OAuth + email templates + SMTP switch). Prerequisites before merge:

1. Google Cloud Console → create OAuth 2.0 Client → add redirect `https://ugfcoptwievurfnbrhno.supabase.co/auth/v1/callback`
2. Supabase Dashboard → Auth → Providers → Google → paste client_id + secret → Enable
3. Supabase Dashboard → Auth → Email Templates → paste 3 custom HTMLs from `docs/auth-email-templates/`
4. Supabase Dashboard → Auth → SMTP Settings → fill Resend credentials

Merge the PR only once the 4 ops steps above are done and verified — else signup-via-Google fails runtime and auth emails keep coming from the default Supabase sender.

### Sequencing

PR #8 first (purely code, no external deps). PR #9 second (requires ops dance).

### Post-Sub-3

No downstream risk. Sub-4 (video) and Sub-5 (analytics) are independent. Sub-6 (UI restyle) remains conditional on findings.

## 9. Total estimate

- Code: ~5h
- Config ops: ~30min
- Manual QA: ~1h
- Grand total: ~6.5h

## 10. References

- Sub-3 backlog: `memory/sub3_backlog.md`
- Original prod-readiness brainstorm: `memory/brainstorming_prod_readiness.md`
- Sub-1 security utilities (ratelimit, validation, HIBP): `src/lib/security/`
- Sub-2 push dispatch (not touched here but co-lives with new components): `src/lib/push/`
- zxcvbn-ts docs: https://zxcvbn-ts.github.io/zxcvbn/
- Supabase email templates reference: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase Auth SMTP: https://supabase.com/docs/guides/auth/auth-smtp
