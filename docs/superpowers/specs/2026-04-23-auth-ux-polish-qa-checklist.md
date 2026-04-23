# Sub-3 — Auth & UX Polish Manual QA Checklist

**Date:** 2026-04-23
Run this before merging PR #9. Every box must be ticked or explicitly marked N/A with reason.

## Password strength meter (PR #8 — already merged, re-verify regression)

- [ ] /login signup: empty password → 5 grey bars, no label
- [ ] /login signup: "password" → red bar, "Molto debole"
- [ ] /login signup: "Rita2026!" → 3-4 bars green/teal, "Forte" or "Ottima"
- [ ] /auth/reset-password: same scenarios render
- [ ] /dashboard Profile → Cambia password: same scenarios render
- [ ] Eye toggle (show/hide password) present in all 3 entry points

## Email verification banner (PR #8 — already merged, re-verify)

- [ ] Signup a fresh user → auth email arrives within 30s branded with Rita logo
- [ ] Without confirming, login → orange banner top of /dashboard (fixed, above sidebar)
- [ ] Click "Rinvia email" → toast success
- [ ] Click "Rinvia email" twice within 60s → toast error "Email già inviata, aspetta un minuto"
- [ ] Click X → banner disappears; reload → still hidden
- [ ] Wait 24h (or manually clear localStorage key "email-verify-dismissed-at") → banner reappears
- [ ] Confirm email via the link → return to /dashboard → banner gone within 30s polling

## Google OAuth (PR #9)

- [ ] /login signup: terms NOT spuntati → Google button disabled (opacity 50, not clickable)
- [ ] Spunta terms → Google button enabled
- [ ] Click → Google consent → redirect → /dashboard, logged in
- [ ] Admin query user_profiles: full_name populated from Google profile
- [ ] New user: admin query auth.users identities → 1 Google identity
- [ ] Existing email/password user logs in via Google with same email → auth.users unchanged in id; identities now 2 (email + google)
- [ ] Login mode (not signup): Google button always enabled, no terms checkbox required
- [ ] Manually craft URL `/auth/callback?source=google&code=FAKE` without `terms=1` → redirect /login?error=terms-missing (browser may cancel because code is invalid — OK)

## Custom email templates (PR #9)

- [ ] Signup confirmation email: Rita logo top, orange CTA button "Conferma email", italian copy, sent from `noreply@fitandsmile.it`
- [ ] Reset password email: custom template, CTA "Reimposta password"
- [ ] Change email email: custom template, CTA "Conferma nuova email"
- [ ] All 3 emails render correctly on Gmail web + Gmail mobile + Apple Mail

## SMTP switch (PR #9)

- [ ] Sender of all auth emails: `Rita Workout <noreply@fitandsmile.it>` (not `noreply@mail.app.supabase.io`)
- [ ] Signup confirmation email does NOT land in spam on a fresh Gmail account

## Button audit — Tier 1 dedup (PR #8 — already merged, re-verify)

- [ ] BillingSection: click "Annulla rinnovo" once → "Cancellato" badge shown instantly (optimistic)
- [ ] Reopen dialog for same sub: "Annulla rinnovo" button NOT visible → no way to duplicate
- [ ] DB: admin_notifications has exactly 1 row of type='cancellation' for that subscriptionId
- [ ] Request refund → "Richiedi rimborso" for same item → "In attesa di rimborso" info (UI-level dedup) or server error "Richiesta già in corso"
- [ ] Request account deletion twice within 24h → server early-returns on 2nd call, no new admin_notifications row
- [ ] createCheckoutSession: double-click the "Acquista" button on /pacchetti → only 1 Stripe checkout session created (check Stripe Dashboard)

## Button audit — Tier 2 loading (PR #8 — already merged, re-verify)

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

## Ops prereqs BEFORE merging PR #9

- [ ] Google Cloud Console OAuth 2.0 Client created with redirect URI `https://ugfcoptwievurfnbrhno.supabase.co/auth/v1/callback`
- [ ] Supabase Dashboard → Auth → Providers → Google enabled with client_id + secret
- [ ] Supabase Dashboard → Auth → Email Templates: 3 templates saved (pasted from `docs/auth-email-templates/`)
- [ ] Supabase Dashboard → Auth → SMTP Settings: Resend creds saved; Supabase's "Send test email" utility succeeds

## Ops post-merge verification

- [ ] First real signup post-deploy → verification email delivered from `noreply@fitandsmile.it`
- [ ] First real Google OAuth signup post-deploy → auth.users row created with Google identity + profiles row populated
