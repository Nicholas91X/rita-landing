# Sub-2 — PWA Push Notifications & Offline

**Status:** design approved, pending implementation plan
**Date:** 2026-04-21
**Scope owner:** Nicholas
**Context:** second of 6 sub-projects in the production-readiness roadmap (see `memory/brainstorming_prod_readiness.md`). Sub-1 (security & compliance) is complete and merged on main as of 2026-04-20. Sub-2 adds Web Push notifications and offline fallback to the existing PWA, closing the biggest remaining UX gap for a premium launch.

---

## 1. Purpose

Enable push notifications across desktop, Android, and iOS (PWA installed) to reach users outside of active sessions. Add a minimal offline experience so the installed app does not look broken when connectivity drops (dashboard shell + thumbnails + fallback page). All work reuses Sub-1 infrastructure (Upstash rate limiting, service-role Supabase clients, Zod validation, audit patterns).

## 2. Scope

### In scope

**Push notifications:**
1. Custom service worker fragment (merged with existing `@ducanh2912/next-pwa` generated SW) with `push`, `notificationclick`, `pushsubscriptionchange` handlers
2. VAPID keys + `web-push` library server-side dispatch
3. `push_subscriptions` table (endpoint + keys + diagnostics) and `user_notification_prefs` table (broadcast opt-out)
4. REST endpoints: `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe`, `GET /api/push/vapid-public`, `POST /api/heartbeat`
5. Soft-prompt orchestration: 2nd `/dashboard` visit, 15-20s delay, 7-day cooldown on "Più tardi"
6. iOS install gating: detect non-standalone Safari and show install instructions before prompting push
7. Profile section: master toggle, broadcast opt-out, device list with revoke, permission-denied banner
8. Skip-if-active rule via Upstash `active:<userId>` key with 90s TTL + client heartbeat every 30s
9. Trigger integrations:
   - `checkout.session.completed` → purchase confirmation
   - `invoice.payment_succeeded` → subscription renewed
   - `invoice.payment_failed` → payment failed
   - Admin refund approval → `actions/user.ts` response path
   - Admin generic response → `admin_actions/users.ts:respondToRequest`
   - Admin broadcast → extended `AdminBroadcasts` UI + new `sendBroadcast` action
   - Trial T-2 reminder → Vercel Cron daily
10. `AdminBroadcasts` UI extension: channels checkboxes (in-app, push), target filter (all/level/package), recipient count preview, confirmation modal, Zod validation, 5/hour rate limit per admin

**Offline:**
11. `/offline` fallback page (Italian copy, logo, retry button)
12. Workbox runtime caching: Bunny CDN thumbnails (StaleWhileRevalidate, 30d, max 100), `/dashboard` routes (NetworkFirst, 3s timeout)
13. Precaching of `/offline` via next-pwa `fallbacks.document`

**Operational:**
14. Migration `08_push_notifications.sql` (two new tables + one new column)
15. Env vars: `VAPID_PUBLIC_KEY` (also exposed as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`
16. `vercel.json` with one cron entry
17. Unit + integration tests per the testing matrix below
18. Manual QA checklist for multi-device verification before merge

### Out of scope

- **Engagement reminders** (inactivity, badge unlocked, new-package-in-level) — deferred to Sub-4/5 once analytics exist
- **Offline video playback** — deferred (belongs to Sub-4 "Video experience")
- **Granular per-event preferences** — only two categories (transactional, broadcast) for now
- **Email channel in broadcasts** — schema allows it but UI ships disabled
- **Retry queues (SQS/Inngest)** — volume too low to justify
- **Delivery analytics dashboards** — Vercel logs sufficient for current scale
- **Multi-language copy** — app is Italian-only
- **Cleanup cron for defunct subscriptions** — auto-cleanup on 410 response; periodic cleanup deferred to a future ops-maintenance sub-project alongside the other Sub-1 debts (`stripe_webhook_events`, `user-exports` bucket, `gdpr_audit_log`)
- **Feature flag / gradual rollout** — prod is effectively dev (no real users), direct rollout as with Sub-1

## 3. Architecture

```
Browser / installed PWA
  ├─ React app
  │   ├─ usePushPromptOrchestrator() on /dashboard
  │   ├─ NotificationSoftPrompt / IosInstallDialog
  │   ├─ PushPreferencesSection in Profilo
  │   └─ heartbeat ping (/api/heartbeat every 30s while focused)
  └─ Service Worker (next-pwa generated + customWorkerDir merged)
      ├─ Workbox precache + runtime caching (thumbnails, dashboard shell)
      ├─ Offline document fallback → /offline
      ├─ push: showNotification({ title, body, data.url, tag })
      ├─ notificationclick: focus existing tab or openWindow(url)
      └─ pushsubscriptionchange: re-register via /api/push/subscribe

Server (Next.js)
  ├─ API routes
  │   ├─ /api/push/subscribe (POST, Zod, rate-limited)
  │   ├─ /api/push/unsubscribe (DELETE)
  │   ├─ /api/push/vapid-public (GET, public key)
  │   ├─ /api/heartbeat (POST, Upstash SET active:<uid> EX 90)
  │   └─ /api/cron/trial-reminders (GET, CRON_SECRET auth)
  ├─ Server actions
  │   ├─ admin_actions/broadcasts.ts → sendBroadcast (admin, Zod, rate-limited)
  │   └─ existing webhook/actions invoke dispatch.sendToUser
  ├─ src/lib/push/
  │   ├─ dispatch.ts (sendToUser / sendToAll with gating + cleanup)
  │   ├─ send.ts (thin web-push wrapper)
  │   ├─ preferences.ts (prefs upsert helpers)
  │   └─ payload-templates.ts (factory per trigger)
  └─ Supabase (service role for dispatch)
      ├─ push_subscriptions
      ├─ user_notification_prefs
      └─ user_subscriptions.trial_reminder_sent_at (new col)

External
  ├─ Upstash Redis (active:<uid>, rate limiting) — already in Sub-1
  ├─ Push gateways (FCM/APNs/Mozilla) — spoken via web-push lib
  └─ Vercel Cron → /api/cron/trial-reminders (daily 08:00 UTC)
```

**New files:**
- `worker/index.ts` — SW fragment
- `next.config.mjs` — extended with `customWorkerDir`, `fallbacks.document`, runtime caching
- `vercel.json`
- `src/app/offline/page.tsx`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/unsubscribe/route.ts`
- `src/app/api/push/vapid-public/route.ts`
- `src/app/api/heartbeat/route.ts`
- `src/app/api/cron/trial-reminders/route.ts`
- `src/lib/push/dispatch.ts`
- `src/lib/push/send.ts`
- `src/lib/push/preferences.ts`
- `src/lib/push/payload-templates.ts`
- `src/components/push/NotificationSoftPrompt.tsx`
- `src/components/push/IosInstallDialog.tsx`
- `src/components/push/PushPreferencesSection.tsx`
- `src/hooks/usePushPromptOrchestrator.ts`
- `src/hooks/useHeartbeat.ts`
- `src/app/actions/admin_actions/broadcasts.ts`
- `src/app/actions/admin_actions/broadcasts.schemas.ts`
- `supabase/migrations/08_push_notifications.sql`

**Modified files:**
- `src/app/api/webhooks/stripe/route.ts` — dispatch after each handled event
- `src/app/actions/user.ts` — `respondRefund` and equivalents invoke dispatch
- `src/app/actions/admin_actions/users.ts` — `respondToRequest` invokes dispatch
- `src/app/admin/AdminBroadcasts.tsx` — channels + filters + confirmation + preview
- `src/app/dashboard/DashboardClient.tsx` — mount orchestrator + heartbeat
- `src/app/dashboard/ProfileSection.tsx` — include `PushPreferencesSection`
- `package.json` — add `web-push` dependency

**New npm dependency:** `web-push` (standard RFC 8030 library).

## 4. Data model

Migration `supabase/migrations/08_push_notifications.sql`:

```sql
-- 08_push_notifications.sql

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_subscriptions_select" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_subscriptions_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_subscriptions_delete" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
-- No UPDATE policy: endpoint rotations are delete+insert.

CREATE TABLE user_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_broadcast_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_prefs_all" ON user_notification_prefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_subscriptions
  ADD COLUMN trial_reminder_sent_at timestamptz;
```

**Rationale:**
- `endpoint UNIQUE` globally: browser push endpoints are unique per device; one user on multiple devices gets multiple rows (correct).
- No UPDATE policy: if the endpoint rotates (`pushsubscriptionchange`), the SW calls subscribe again which inserts a fresh row; old row becomes defunct and is cleaned on next dispatch (410 response).
- `last_error/last_error_at` exist for diagnostic UI and for cleanup heuristics (if last_error_at older than 7d and a new error arrives, delete).
- `user_notification_prefs` has only one boolean today. Transactional has no column (always on; GDPR legitimate interest). Schema designed so new preference flags can be added as new columns without migration complexity.
- `trial_reminder_sent_at` prevents duplicate T-2 reminders on repeated cron runs; `UPDATE ... WHERE trial_reminder_sent_at IS NULL` in the same cron pass is atomic enough (volume low, no concurrent cron runs on the same minute).

**Rollback:**
```sql
DROP TABLE push_subscriptions;
DROP TABLE user_notification_prefs;
ALTER TABLE user_subscriptions DROP COLUMN trial_reminder_sent_at;
```

## 5. Service worker

`next.config.mjs` changes:

```js
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  customWorkerDir: 'worker',
  fallbacks: { document: '/offline' },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.b-cdn\.net\/.*\.(png|jpg|jpeg|webp)$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'bunny-thumbnails',
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
        },
      },
      {
        urlPattern: /^\/dashboard(\/.*)?$/,
        handler: 'NetworkFirst',
        options: { cacheName: 'dashboard-shell', networkTimeoutSeconds: 3 },
      },
    ],
  },
  disable: process.env.NODE_ENV === 'development',
});
```

`worker/index.ts` — only push-related listeners; Workbox owns caching:

- `push`: parse JSON payload, `registration.showNotification(title, { body, icon: /icon-192.png, badge: /icon-192.png, tag, renotify, data: { url, ...rest } })`
- `notificationclick`: close notification, find an existing window client on this origin and `client.focus() + client.navigate(data.url)`; otherwise `clients.openWindow(data.url)`
- `pushsubscriptionchange`: re-subscribe using VAPID public key fetched from `/api/push/vapid-public`, then POST to `/api/push/subscribe`

**Payload contract between server and SW** (TypeScript interface duplicated in both places, kept in sync manually):

```ts
interface PushPayload {
  title: string          // max 50 chars (iOS lockscreen truncates)
  body: string           // max 150 chars (safe across platforms)
  url?: string           // defaults to /dashboard
  tag?: string           // dedup key; with renotify=true forces re-alert
  icon?: string          // defaults to /icon-192.png
  badge?: string         // defaults to /icon-192.png (iOS ignores)
  data?: Record<string, unknown>
}
```

**iOS caveats** (documented, no code branches):
- `tag` + `renotify` partial support (each push may create a new notification)
- `badge` icon ignored (app installed icon used)
- `actions` buttons unsupported (not used)
- Push does not fire if the PWA is not installed to Home (handled by install gating)

**CSP impact:** `worker-src 'self' blob:` already present (Sub-1). No new origins needed; `web-push` is server-side only, browser talks to the native push gateway URL which is part of the browser stack, not subject to CSP.

## 6. Permission UX flow

**Client state signals:**
- `localStorage.dashboard_visit_count` (int, incremented on `/dashboard` mount)
- `localStorage.push_prompt_dismissed_at` (ISO string, set on "Più tardi")
- `Notification.permission` (default / granted / denied)
- `window.matchMedia('(display-mode: standalone)').matches`
- iOS detect: `/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream`

**`usePushPromptOrchestrator()` logic on `/dashboard` mount:**

```
increment visit count
if visit count < 2                            → return
if Notification.permission === 'granted':
    subscribeIfMissing() silently
    return
if Notification.permission === 'denied'        → return
if dismissed_at exists AND (now - dismissed_at) < 7d → return
schedule timer 18000ms:
    if iOS && !standalone  → show <IosInstallDialog>
    else                    → show <NotificationSoftPrompt>
cleanup on unmount
```

**`NotificationSoftPrompt`** (Radix Dialog):

- Title: "Vuoi essere avvisata?"
- Body: "Ricevi una notifica quando Rita carica nuovi allenamenti o risponde alle tue richieste. Puoi disattivarle in qualsiasi momento dal tuo profilo."
- Buttons: "Più tardi" (sets cooldown, closes), "Sì, attiva" (invokes `Notification.requestPermission()`)
- On permission `granted`: call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey })`, POST to `/api/push/subscribe`, toast success
- On permission `denied`: toast "Puoi riattivarle dalle impostazioni del browser", no retry

**`IosInstallDialog`** (Radix Dialog, iOS non-standalone only):
- Title: "Installa Rita sulla Home"
- Body explains the Share → Add to Home Screen flow with three numbered steps and the Share icon glyph
- Single button: "Ho capito" (closes, sets `push_prompt_dismissed_at` for 7d to avoid re-annoying)

**`PushPreferencesSection`** in Profile:
- Status badge (green "Attive su questo dispositivo" / grey "Non attive qui" / red "Bloccate")
- "Aggiornamenti importanti" — always-on informational line, not a toggle
- "Annunci e novità" — toggle driving `user_notification_prefs.push_broadcast_enabled`
- Device list queried from `push_subscriptions`, user_agent parsed client-side (reuse the parser already written in Sub-1 for session list; extract to `src/lib/user-agent.ts` if currently inline)
- "Revoca" button per device → DELETE via `/api/push/unsubscribe` with endpoint hash
- "Disattiva su questo dispositivo" → `pushManager.getSubscription().unsubscribe()` + DELETE current endpoint
- If `Notification.permission === 'denied'`: red banner with "Come riattivarle" link

**Edge cases:**
- Device B (new browser) → visit count resets (localStorage is per-origin-per-browser), soft-prompt appears again, user subscribes → multi-device works
- Permission `granted` but no active subscription (e.g., cleared storage) → `subscribeIfMissing()` silently re-registers on next `/dashboard`
- PWA removed from iOS Home → subscription endpoint dies → 410 on next dispatch → auto-deleted
- localStorage quota errors → orchestrator treats as "fresh" state, acceptable fallback

## 7. Dispatcher and trigger events

**`src/lib/push/dispatch.ts` API:**

```ts
type Category = 'transactional' | 'broadcast'

interface DispatchOptions {
  category: Category
  idempotencyKey?: string
}

interface DispatchResult {
  sent: number
  skipped: number
  failed: number
}

export async function sendToUser(
  userId: string,
  payload: PushPayload,
  opts: DispatchOptions
): Promise<DispatchResult>

export async function sendToAll(
  payload: PushPayload,
  filter?: { subscribedTo?: string; level?: string }
): Promise<DispatchResult>
```

**`sendToUser` flow (service role client):**

```
if opts.category === 'broadcast':
    SELECT push_broadcast_enabled FROM user_notification_prefs WHERE user_id = ?
    if disabled → return { skipped: <subscriptionCount> }

if opts.category === 'broadcast' AND EXISTS redis 'active:<userId>':
    return { skipped: <subscriptionCount> }
    # transactional always fires (payment failed must reach even if user is active)

SELECT * FROM push_subscriptions WHERE user_id = ?

for each subscription:
    try webPush.sendNotification(sub, JSON.stringify(payload), { TTL: 86400 }):
        UPDATE last_used_at = now(), last_error = null, last_error_at = null
        sent++
    catch WebPushError(410 | 404):
        DELETE FROM push_subscriptions WHERE id = ?
        skipped++  # defunct, not a failure
    catch WebPushError(4xx | 5xx):
        if last_error_at exists AND now() - last_error_at < 7d:
            DELETE FROM push_subscriptions WHERE id = ?  # persistent failure
        else:
            UPDATE last_error = msg, last_error_at = now()
        failed++

return { sent, skipped, failed }
```

**Idempotency:**
- Stripe webhook dedup via existing `stripe_webhook_events` table (Sub-1) — dispatch runs at most once per Stripe event
- Broadcast admin: UI disables the submit button during the request and shows a spinner; accidental double-send is rare. Not a launch blocker to add DB-level dedup.
- Trial cron: `UPDATE user_subscriptions SET trial_reminder_sent_at = now() WHERE id = ? AND trial_reminder_sent_at IS NULL` guards against double-send

**Trigger → payload mapping:**

| Trigger | Source | Category | Title | Body | URL |
|---|---|---|---|---|---|
| Purchase completed | stripe webhook `checkout.session.completed` | transactional | "Acquisto confermato" | `Il pacchetto ${name} è ora nella tua Home.` | `/dashboard/package/${id}` |
| Subscription renewed | stripe webhook `invoice.payment_succeeded` | transactional | "Abbonamento rinnovato" | "Grazie, continua così!" | `/dashboard#billing` |
| Payment failed | stripe webhook `invoice.payment_failed` | transactional | "Pagamento non riuscito" | "Aggiorna il metodo di pagamento per non perdere l'accesso." | `/dashboard#billing` |
| Refund approved | admin action | transactional | "Rimborso approvato" | "Riceverai l'accredito entro 5-10 giorni." | `/dashboard#billing` |
| Admin response | admin action | transactional | "Hai una nuova risposta dal team Rita" | first 100 chars of response | `/dashboard` |
| Trial T-2 | cron | transactional | "Il tuo periodo di prova scade tra 2 giorni" | "Rinnova per non perdere l'accesso." | `/dashboard#billing` |
| Broadcast | admin action | broadcast | admin-composed | admin-composed | admin-composed |

Payload templates centralized in `src/lib/push/payload-templates.ts` for consistency.

**Tag naming convention** (for iOS-friendly dedup of retries):
- purchase: `purchase-${stripeSessionId}`
- renewed: `renewal-${invoiceId}`
- failed: `payment-failed-${invoiceId}`
- refund: `refund-${refundId}`
- response: `response-${requestId}`
- trial: `trial-reminder-${subscriptionId}`
- broadcast: `broadcast-${broadcastId}`

**In-app notification parity:**
Every push trigger also inserts into `user_notifications` (existing bell UI) first. If dispatch fails, in-app is unaffected. Two independent channels.

**Rate limits** (Upstash, per-key TTL):
- `/api/push/subscribe`: 10/min per IP
- `/api/push/unsubscribe`: 20/min per IP
- `/api/heartbeat`: 60/min per user
- `sendBroadcast`: 5/hour per admin user id

**VAPID env vars:**
- `VAPID_PUBLIC_KEY` server-side
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` same value, exposed to client
- `VAPID_PRIVATE_KEY` server only
- `VAPID_SUBJECT` = `mailto:support@fitandsmile.it`

Generated once via `npx web-push generate-vapid-keys`. Support mailbox `support@fitandsmile.it` still pending (carry-over operational TODO from Sub-1).

## 8. Admin broadcast UI

Extends `src/app/admin/AdminBroadcasts.tsx` (current file sends only in-app notifications).

**Form fields:**
- Title (3-50 chars)
- Body (5-150 chars)
- URL (must start with `/`, max 200 chars, relative-only for security)
- Target: radio group "Tutti" / "Solo pacchetto [dropdown]" / "Solo livello [dropdown]"
- Channels: checkboxes "In-app" (default checked), "Push" (default checked), "Email" (ships disabled in UI)
- Live recipient count preview: "~N utenti riceveranno (~M hanno push)"

**Validation schema** in `admin_actions/broadcasts.schemas.ts`:

```ts
export const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(50),
  body: z.string().trim().min(5).max(150),
  url: z.string().startsWith('/').max(200),
  targetType: z.enum(['all', 'package', 'level']),
  targetId: z.string().uuid().optional(),
  channels: z.object({
    inApp: z.boolean(),
    push: z.boolean(),
    email: z.boolean().default(false),
  }),
}).refine(
  d => d.targetType === 'all' || !!d.targetId,
  { message: 'targetId required when targetType is not "all"' }
)
```

**Server action `sendBroadcast(data)`:**

```
1. Admin check (existing pattern from other admin actions)
2. Upstash rate limit: 5/hour per admin user_id
3. Zod validate
4. Audit trail: insert into admin_notifications (existing table)
5. Resolve recipient list based on targetType/targetId
6. If channels.inApp: batch insert into user_notifications
7. If channels.push: call sendToAll(payload, filter) with category='broadcast'
8. Return { recipients, inApp, pushSent, pushSkipped, pushFailed }
9. UI displays counts in toast
```

**Live recipient count:** separate server action `countBroadcastRecipients(filter)` invoked with debounce on filter change; returns `{ total, withPush }`.

**Confirmation modal** before dispatch: "Stai per inviare a N utenti (M push). Confermi?" with Cancel / "Sì, invia ora" buttons.

## 9. Vercel Cron: trial reminders

**`vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/trial-reminders", "schedule": "0 8 * * *" }
  ]
}
```

08:00 UTC = 09:00 or 10:00 Italy depending on DST. Acceptable.

**`src/app/api/cron/trial-reminders/route.ts` (GET):**

```
1. Auth guard:
     return 401 unless request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
     also verify request.headers['x-vercel-cron'] === '1' as double check
2. SELECT us.user_id, us.id, us.trial_end, p.name as package_name
   FROM user_subscriptions us
   JOIN packages p ON p.id = us.package_id
   WHERE us.status = 'trialing'
     AND us.trial_end BETWEEN now() + interval '2 days' AND now() + interval '3 days'
     AND us.trial_reminder_sent_at IS NULL
3. For each row:
     a. sendToUser(user_id, trialReminderPayload(package_name), { category: 'transactional' })
     b. INSERT user_notifications (mirror in-app)
     c. UPDATE user_subscriptions SET trial_reminder_sent_at = now() WHERE id = ?
4. Return 200 { processed: N }
```

**`CRON_SECRET`** generated manually (32 random bytes hex), added to Vercel All Environments and `.env.local`.

## 10. Testing

**Automated (Vitest):**

| Target | Type | Cases |
|---|---|---|
| `src/lib/push/dispatch.ts` | unit | skip-if-active via Upstash mock; broadcast preference off → skipped; 410 Gone → subscription deleted; persistent error → eventual delete; idempotencyKey dedup |
| `src/lib/push/send.ts` | unit | web-push lib called with correct VAPID + serialized payload |
| `/api/push/subscribe/route.ts` | integration | Zod rejects malformed subscription; rate limit trips at 11th request; insert scoped to authenticated user |
| `/api/push/unsubscribe/route.ts` | integration | DELETE constrained to auth.uid(); 401 without session |
| `/api/heartbeat/route.ts` | integration | 401 without auth; Upstash SET called with 90s TTL; rate limit at 61st call |
| `/api/cron/trial-reminders/route.ts` | integration | 401 without CRON_SECRET; idempotent on second run (flag populated → skipped) |
| `admin_actions/broadcasts.ts` | integration | non-admin rejected; Zod validated; recipient count matches SQL mock for each filter |
| `src/lib/push/preferences.ts` | unit | upsert creates default row; toggle broadcast persists |

**Not automated (with rationale):**
- Service worker: Vitest + happy-dom cannot realistically simulate SW event loop. Covered by manual QA below.
- Full E2E browser → push gateway → notification: depends on FCM/APNs live services, not CI-friendly. Manual QA.
- React soft-prompt rendering: standard Radix dialog pattern, low test ROI.

**Manual QA checklist (mandatory before merge of PR #7):**

| Device / env | Test |
|---|---|
| Chrome desktop Windows | Install PWA → permit → admin dispatches test push → click notification focuses correct tab |
| Chrome Android | Same sequence + verify app badge |
| Safari iPhone iOS 17+ | Add to Home → open standalone → permit → test push; verify NO push from Safari tab (non-standalone) |
| Firefox desktop | Subscribe + receive |
| Offline Chrome | DevTools offline → navigate `/dashboard` → shell cached + thumbnails visible; navigate unknown route → `/offline` served |
| Broadcast admin | Send "all" targeted broadcast → receives on every test device |
| Trial T-2 | Manually `UPDATE user_subscriptions SET trial_end = now() + interval '2 days', trial_reminder_sent_at = null WHERE id = test-sub`; invoke cron with curl + `CRON_SECRET`; verify notification + `trial_reminder_sent_at` populated |
| Revoke device | Profile → Revoca → dispatch does not reach that device |
| Permission denied | Click Blocca on native prompt → toast appears → red banner in Profile → dispatch skipped for that endpoint |
| Payment failed | Stripe test-mode card triggering `invoice.payment_failed` → push received |
| Purchase confirmed | Complete test checkout → purchase push received |

Checklist also committed as `docs/superpowers/specs/2026-04-21-pwa-push-offline-qa-checklist.md` for use during execution.

## 11. Rollout

**PR decomposition** (3 PRs, mirroring Sub-1 rhythm):

1. **PR #5 — foundation:** migration 08, `web-push` dep, VAPID env vars, SW customWorker, offline page, subscribe/unsubscribe/vapid-public/heartbeat endpoints, `dispatch.ts` / `send.ts` libs, Upstash rate limits. No triggers wired yet. Mergeable standalone: users can subscribe, nothing arrives yet.
2. **PR #6 — UX + prefs:** orchestrator hook, soft-prompt + iOS dialog, `PushPreferencesSection`, device list + revoke, heartbeat client hook, permission-denied banner. After merge, subscription flow is user-visible; still no triggers.
3. **PR #7 — triggers + broadcast + cron:** wire dispatch into Stripe webhook / admin actions / trial cron; extend `AdminBroadcasts` UI; `vercel.json`; manual QA checklist execution required before merge.

Estimated task count: 25-35 tasks across the three PRs, executable with `superpowers:subagent-driven-development` in a fresh session (same pattern as Sub-1).

**Operational prerequisites (before starting execution):**
- Generate VAPID keys via `npx web-push generate-vapid-keys`, add four env vars (`VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) to Vercel All Environments + `.env.local`
- Generate `CRON_SECRET` (32 random bytes hex) → Vercel + `.env.local`
- Carry-over from Sub-1 still pending: `support@fitandsmile.it` mailbox/alias on domain provider (used as VAPID subject)

**Rollback plan:**
- Database: `DROP TABLE push_subscriptions; DROP TABLE user_notification_prefs; ALTER TABLE user_subscriptions DROP COLUMN trial_reminder_sent_at;`
- Code: revert PRs in reverse order (#7 → #6 → #5). The default next-pwa generated SW keeps serving the previously-cached static assets; no user-visible breakage.
- Env vars: delete VAPID keys from Vercel; benign if left.

**No feature flag / gradual rollout:** production has no real users yet (memory: "prod is effectively dev"). Direct release as with Sub-1.

## 12. Out of scope for clarity

Not in this sub-project:
- Engagement push (inactivity, new-package-in-level, badge unlocked) — Sub-4/5
- Offline video download — Sub-4
- Granular per-event preferences — deferred; current 2-category model is sufficient
- Email broadcast channel — schema ready, UI disabled
- Multi-language — Italian only
- Push retry queue — Vercel serverless sync is enough at current volume
- Delivery dashboards — Vercel logs + `last_error` column
- Cleanup cron for defunct subscriptions — covered reactively by 410 auto-delete; periodic cleanup grouped with other Sub-1 debts in a future ops-maintenance sub-project
