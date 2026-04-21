# Sub-2 — Manual QA Checklist

**Date:** 2026-04-21
**Requirement:** Run this checklist before merging PR #7. Every box must be ticked (or explicitly noted as N/A with reason).

## Desktop

- [ ] Chrome Windows — install PWA → enable push → admin dispatches test push → click focuses correct tab at deep-link URL
- [ ] Firefox Windows — subscribe + receive push
- [ ] Edge Windows — subscribe + receive push
- [ ] Chrome macOS — subscribe + receive push

## Android

- [ ] Chrome Android — install PWA → enable push → receive; verify app badge (number)

## iOS (critical path for launch)

- [ ] Safari iPhone iOS 17+ (non-standalone tab) — visit /dashboard → IosInstallDialog appears → "Ho capito" dismisses with cooldown
- [ ] iPhone after Add-to-Home → open standalone → 2nd visit → NotificationSoftPrompt appears → accept → native prompt → grant → subscription stored
- [ ] iPhone standalone receives admin broadcast push
- [ ] iPhone standalone receives purchase push (complete Stripe test checkout)
- [ ] Safari tab (non-standalone) — verify push NEVER arrives (iOS limitation, expected)

## Offline

- [ ] Chrome DevTools Offline → `/dashboard` loads from cache → thumbnails visible
- [ ] Offline → navigate to nonexistent route `/offline-test-xxx` → `/offline` served

## Triggers

- [ ] Complete Stripe test checkout → purchase push arrives + in-app notification + navigates to `/dashboard/package/<id>`
- [ ] Subscription renewal (let Stripe subscription cycle or trigger via Stripe CLI `stripe trigger invoice.payment_succeeded` with `billing_reason=subscription_cycle`) → renewal push
- [ ] Payment failure (Stripe test card 4000 0000 0000 0341) → payment_failed push + in-app notification
- [ ] Admin approves a refund → user receives "Rimborso approvato" push
- [ ] Admin response (non-refund) → scope note: no dedicated `respondToRequest` action exists in codebase; only refund approval path is wired. Generic admin→user response via `user_notifications` inserts does not fire push (plan deviation, documented).
- [ ] Trial T-2 cron: manually `UPDATE user_subscriptions SET trial_end = now() + '2 days', trial_reminder_sent_at = null WHERE id = test-sub-id`, invoke `/api/cron/trial-reminders` → push received + column populated; re-invoke → no duplicate

## Broadcast

- [ ] Admin sends broadcast targetType=all, channels=inApp+push → all test devices receive both
- [ ] Admin sends broadcast targetType=package (specific) → only subscribers to that package receive
- [ ] Admin sends broadcast targetType=level → only users of that level receive
- [ ] Broadcast rate limit: 6th send within 1h returns 429 with "Riprova tra Ns"
- [ ] User with `push_broadcast_enabled=false` does NOT receive broadcast; DOES receive transactional

## Preferences UX

- [ ] Fresh user, 2nd /dashboard visit: soft-prompt at 18s
- [ ] "Più tardi" → 7-day cooldown enforced (verify localStorage)
- [ ] Accept → subscription stored; Profile → tab Notifiche → "Notifiche push" shows device
- [ ] Toggle "Annunci e novità" off → verify `user_notification_prefs.push_broadcast_enabled = false`
- [ ] Revoke device from Profile → row removed
- [ ] "Disattiva su questo dispositivo" → local subscription + DB row removed
- [ ] Permission denied (click Blocca on native) → red banner in Profile

## Edge cases

- [ ] iOS 16.3 or older → IosInstallDialog shown but push never works (no action required, UX doesn't promise it)
- [ ] Browser without Notification API → soft-prompt skipped entirely
- [ ] Heartbeat: active user (tab focused, last 60s) does NOT receive broadcast push (verify `active:<uid>` in Upstash, send broadcast → skipped counter increments)
- [ ] Expired subscription endpoint (manually insert row with garbage endpoint) → dispatch returns 410 → row auto-deleted

## Rate limits

- [ ] 11th POST /api/push/subscribe within 1min → 429
- [ ] 21st DELETE /api/push/unsubscribe within 1min → 429
- [ ] 61st POST /api/heartbeat within 1min → 429

## Security

- [ ] /api/cron/trial-reminders without CRON_SECRET → 401
- [ ] /api/cron/trial-reminders with CRON_SECRET but without x-vercel-cron:1 → 401
- [ ] /api/push/subscribe unauthenticated → 401
- [ ] /api/push/unsubscribe unauthenticated → 401
- [ ] Non-admin calling sendBroadcast → error "Non autorizzato"

## Build

- [ ] `npm run build` clean (no warnings from workbox about missing precache)
- [ ] `public/sw.js` generated, contains push listener
- [ ] Custom `public/worker-*.js` bundle has push + notificationclick + pushsubscriptionchange listeners
- [ ] `npm run lint` clean (only pre-existing DashboardClient warnings)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` passes (≥52 tests after PR #7)

## Ops

- [ ] `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` present in Vercel All Environments
- [ ] Vercel Cron page shows the trial-reminders cron scheduled
- [ ] First cron run logged in Vercel dashboard after deploy
