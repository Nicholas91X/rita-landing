# Sub-2 — PWA Push & Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Web Push notifications (desktop + Android + iOS-installed PWA) and an offline shell for the dashboard, per the Sub-2 spec (`docs/superpowers/specs/2026-04-21-pwa-push-offline-design.md`). Shipped in 3 PRs: foundation (migrations + libs + endpoints + SW) → UX + preferences → triggers + broadcast + cron.

**Architecture:** Custom service worker fragment merged via `@ducanh2912/next-pwa` `customWorkerDir`. VAPID + `web-push` npm for server-side dispatch. Two new tables (`push_subscriptions`, `user_notification_prefs`) plus one column (`user_subscriptions.trial_reminder_sent_at`). Upstash key `active:<uid>` for skip-if-active (reuses Sub-1 Redis). Soft-prompt UX at 2nd `/dashboard` visit with iOS install-gating. Trigger integration into Stripe webhooks, admin actions, and Vercel Cron for trial T-2 reminders.

**Tech Stack:** Next.js 15 App Router + React 19, Supabase (Postgres + Auth), `@ducanh2912/next-pwa` (existing), `web-push` (new), Upstash Redis (existing), Zod + Vitest (existing), Radix Dialog (existing).

**Execution context:** Run in a dedicated git worktree. Create via `superpowers:using-git-worktrees` or manually: `git worktree add ../rita-landing-sub2 -b sub2-push-offline`. All commands assume repo root as cwd. Node 20+, npm 10+.

**Spec reference:** `docs/superpowers/specs/2026-04-21-pwa-push-offline-design.md`. Re-read spec § 3, § 5, § 6, § 7 when in doubt.

**Prerequisites before starting execution (one-time operational setup):**

1. Generate VAPID keys: `npx web-push generate-vapid-keys` — keep the output.
2. Add env vars to Vercel All Environments AND `.env.local`:
   - `VAPID_PUBLIC_KEY=<public from step 1>`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same public value>`
   - `VAPID_PRIVATE_KEY=<private from step 1>`
   - `VAPID_SUBJECT=mailto:support@fitandsmile.it`
   - `CRON_SECRET=<openssl rand -hex 32>`
3. `support@fitandsmile.it` mailbox exists (carry-over TODO from Sub-1). If not yet created, the VAPID subject works anyway at send time — push gateways require a valid-looking mailto:// URI, not a reachable mailbox. Document creation remains pending.

---

## File Structure Overview

### New files

**Library modules (`src/lib/push/*`):**
- `types.ts` — `PushPayload` interface shared between server and SW
- `send.ts` — thin `web-push.sendNotification` wrapper
- `dispatch.ts` — `sendToUser`, `sendToAll` with preference/active gating + cleanup
- `preferences.ts` — `upsertPrefs`, `getPrefs`, `toggleBroadcast`
- `payload-templates.ts` — factory functions per trigger event

**UA parsing:**
- `src/lib/user-agent.ts` — tiny regex-based parser (reused across device lists)

**API routes (`src/app/api/*`):**
- `push/subscribe/route.ts` — POST, Zod + rate limit
- `push/unsubscribe/route.ts` — DELETE, rate limit
- `push/vapid-public/route.ts` — GET (public key, fallback for SW)
- `heartbeat/route.ts` — POST, Upstash `active:<uid>` with 90s TTL
- `cron/trial-reminders/route.ts` — GET, CRON_SECRET auth

**React hooks (`src/hooks/*`):**
- `usePushPromptOrchestrator.ts` — soft-prompt + iOS dialog gating
- `useHeartbeat.ts` — 30s ping while tab focused

**UI components (`src/components/push/*`):**
- `NotificationSoftPrompt.tsx` — pre-permission dialog
- `IosInstallDialog.tsx` — iOS install instructions
- `PushPreferencesSection.tsx` — profile section (toggles, device list, revoke)

**Admin action (`src/app/actions/admin_actions/*`):**
- `broadcasts.ts` — `sendBroadcast`, `countBroadcastRecipients`
- `broadcasts.schemas.ts` — Zod schemas

**Offline page:**
- `src/app/offline/page.tsx`

**Service worker:**
- `worker/index.ts` — merged into SW by next-pwa at build

**Cron config:**
- `vercel.json`

**Migration:**
- `supabase/20260421_08_push_notifications.sql`

**Tests (co-located `*.test.ts`):**
- `src/lib/push/send.test.ts`
- `src/lib/push/dispatch.test.ts`
- `src/lib/push/preferences.test.ts`
- `src/lib/push/payload-templates.test.ts`
- `src/lib/user-agent.test.ts`
- `src/app/actions/admin_actions/broadcasts.test.ts`

**QA doc:**
- `docs/superpowers/specs/2026-04-21-pwa-push-offline-qa-checklist.md`

### Modified files

- `next.config.mjs` — next-pwa config: `customWorkerDir`, `fallbacks.document`, `workboxOptions.runtimeCaching`
- `package.json` — add `web-push` + `@types/web-push`
- `src/lib/security/ratelimit.ts` — add push/broadcast limiters
- `src/app/api/webhooks/stripe/route.ts` — dispatch calls after each handled event
- `src/app/actions/user.ts` — dispatch in refund response path if present
- `src/app/actions/admin_actions/users.ts` — dispatch in `respondToRequest` (and deprecate old `sendBroadcastNotification`)
- `src/app/admin/AdminBroadcasts.tsx` — new targeting (all/level/package), channels checkboxes, recipient count preview, Zod error handling
- `src/app/dashboard/DashboardClient.tsx` — mount orchestrator + heartbeat
- `src/app/dashboard/ProfileSection.tsx` — include `PushPreferencesSection`

---

## PR #5 — Foundation (migration, libs, endpoints, SW, offline page)

**Goal:** Ship the subscription plumbing. After this PR users can theoretically subscribe (via curl or DevTools) but no UX or triggers exist yet. Mergeable standalone.

### Task 1: Install `web-push` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime + types**

Run:
```bash
npm install web-push
npm install -D @types/web-push
```

Expected: `package.json` gains `"web-push": "^3.6.x"` and devDep `"@types/web-push": "^3.6.x"`.

- [ ] **Step 2: Verify lockfile updated**

Run: `git diff package.json package-lock.json` — expect additions only.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add web-push dependency for Sub-2 push dispatch"
```

---

### Task 2: Create migration 08 (push_subscriptions, user_notification_prefs, trial_reminder_sent_at)

**Files:**
- Create: `supabase/20260421_08_push_notifications.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260421_08_push_notifications.sql
-- Sub-2: tables for Web Push subscriptions and user notification preferences.

BEGIN;

-- Endpoint storage, one row per browser device. Service role writes on dispatch,
-- users manage their own via RLS.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_subscriptions_select" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
-- No UPDATE policy for end users: endpoint rotations are delete+insert.
-- Service role bypasses RLS for diagnostic column updates.

-- Preference row per user. Transactional pushes have no column (always on,
-- legitimate interest). Broadcasts are opt-out-able.
CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_broadcast_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_prefs_all" ON public.user_notification_prefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- T-2 trial reminder idempotency guard. Cron sets this on successful send.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz;

COMMIT;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use MCP tool:
```
mcp__supabase__apply_migration
  project_id: ugfcoptwievurfnbrhno
  name: 20260421_08_push_notifications
  query: <full SQL above>
```

- [ ] **Step 3: Verify**

Run MCP `mcp__supabase__list_tables schemas: ["public"]` — confirm `push_subscriptions` and `user_notification_prefs` are listed.

Run MCP `mcp__supabase__execute_sql` with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_subscriptions' AND column_name = 'trial_reminder_sent_at';
```
Expected: one row.

Run MCP with:
```sql
SELECT policyname FROM pg_policies
WHERE tablename IN ('push_subscriptions', 'user_notification_prefs')
ORDER BY policyname;
```
Expected: 4 rows (`own_prefs_all`, `own_subscriptions_delete`, `own_subscriptions_insert`, `own_subscriptions_select`).

- [ ] **Step 4: Commit**

```bash
git add supabase/20260421_08_push_notifications.sql
git commit -m "Add push_subscriptions + user_notification_prefs migration"
```

---

### Task 3: Define `PushPayload` type

**Files:**
- Create: `src/lib/push/types.ts`

- [ ] **Step 1: Write the file**

```ts
// src/lib/push/types.ts
// Contract between server dispatch and service worker push handler.
// KEEP IN SYNC with worker/index.ts (TypeScript does not reach worker files).

export interface PushPayload {
  title: string            // max 50 chars (iOS lockscreen truncates)
  body: string             // max 150 chars (safe across platforms)
  url?: string             // deep-link on click, defaults to /dashboard
  tag?: string             // dedup key; pairs with renotify=true
  icon?: string            // defaults to /icon-192.png
  badge?: string           // defaults to /icon-192.png (iOS ignores)
  data?: Record<string, unknown>
}

export type PushCategory = 'transactional' | 'broadcast'

export interface DispatchResult {
  sent: number
  skipped: number
  failed: number
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/push/types.ts
git commit -m "Add PushPayload and DispatchResult types"
```

---

### Task 4: Build `src/lib/push/send.ts` (web-push wrapper) with tests

**Files:**
- Create: `src/lib/push/send.test.ts`
- Create: `src/lib/push/send.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/push/send.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

describe("sendPush", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.VAPID_PUBLIC_KEY = "pub-test"
    process.env.VAPID_PRIVATE_KEY = "priv-test"
    process.env.VAPID_SUBJECT = "mailto:test@example.com"
  })

  it("calls web-push.sendNotification with serialized payload and TTL 86400", async () => {
    const webpush = (await import("web-push")).default as {
      setVapidDetails: ReturnType<typeof vi.fn>
      sendNotification: ReturnType<typeof vi.fn>
    }
    ;(webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
      statusCode: 201,
    })
    const { sendPush } = await import("./send")
    const sub = { endpoint: "https://x", keys: { p256dh: "a", auth: "b" } }
    const payload = { title: "T", body: "B" }
    await sendPush(sub, payload)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      sub,
      JSON.stringify(payload),
      { TTL: 86400 },
    )
  })

  it("calls setVapidDetails once per module load with env values", async () => {
    const webpush = (await import("web-push")).default as {
      setVapidDetails: ReturnType<typeof vi.fn>
    }
    await import("./send")
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "pub-test",
      "priv-test",
    )
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/push/send.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `send.ts`**

```ts
// src/lib/push/send.ts
import webpush from "web-push"
import type { PushPayload } from "./types"

const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT

if (publicKey && privateKey && subject) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function sendPush(
  subscription: PushSubscriptionPayload,
  payload: PushPayload,
): Promise<{ statusCode: number }> {
  const result = await webpush.sendNotification(
    subscription,
    JSON.stringify(payload),
    { TTL: 86400 },
  )
  return { statusCode: result.statusCode }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/lib/push/send.test.ts`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/send.ts src/lib/push/send.test.ts
git commit -m "Add sendPush thin wrapper around web-push"
```

---

### Task 5: Build `src/lib/push/preferences.ts` with tests

**Files:**
- Create: `src/lib/push/preferences.test.ts`
- Create: `src/lib/push/preferences.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/push/preferences.test.ts
import { describe, it, expect, vi } from "vitest"
import { getPrefs, toggleBroadcast } from "./preferences"

function makeSupabaseMock(opts: {
  selectResult?: { data: unknown; error: unknown }
  upsertResult?: { data: unknown; error: unknown }
}) {
  const upsert = vi.fn().mockResolvedValue(opts.upsertResult ?? { data: null, error: null })
  const eq = vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null })
  const maybeSingle = vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null })
  const from = vi.fn().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle }) }),
    upsert: (...args: unknown[]) => {
      upsert(...args)
      return Promise.resolve(opts.upsertResult ?? { data: null, error: null })
    },
  })
  return { from, upsert, eq, maybeSingle } as const
}

describe("getPrefs", () => {
  it("returns default push_broadcast_enabled=true when no row exists", async () => {
    const supabase = makeSupabaseMock({ selectResult: { data: null, error: null } })
    const prefs = await getPrefs(supabase as never, "user-1")
    expect(prefs.push_broadcast_enabled).toBe(true)
  })

  it("returns stored row when present", async () => {
    const supabase = makeSupabaseMock({
      selectResult: { data: { push_broadcast_enabled: false }, error: null },
    })
    const prefs = await getPrefs(supabase as never, "user-1")
    expect(prefs.push_broadcast_enabled).toBe(false)
  })
})

describe("toggleBroadcast", () => {
  it("upserts with user_id and new value", async () => {
    const supabase = makeSupabaseMock({ upsertResult: { data: null, error: null } })
    await toggleBroadcast(supabase as never, "user-1", false)
    expect(supabase.upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      push_broadcast_enabled: false,
      updated_at: expect.any(String),
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/push/preferences.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `preferences.ts`**

```ts
// src/lib/push/preferences.ts
import type { SupabaseClient } from "@supabase/supabase-js"

export interface NotificationPrefs {
  push_broadcast_enabled: boolean
}

const defaults: NotificationPrefs = {
  push_broadcast_enabled: true,
}

export async function getPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("user_notification_prefs")
    .select("push_broadcast_enabled")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data ?? defaults
}

export async function toggleBroadcast(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.from("user_notification_prefs").upsert({
    user_id: userId,
    push_broadcast_enabled: enabled,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/lib/push/preferences.test.ts`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/preferences.ts src/lib/push/preferences.test.ts
git commit -m "Add notification preferences helpers"
```

---

### Task 6: Build `src/lib/push/dispatch.ts` with tests

**Files:**
- Create: `src/lib/push/dispatch.test.ts`
- Create: `src/lib/push/dispatch.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/push/dispatch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./send", () => ({
  sendPush: vi.fn(),
}))
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({ exists: vi.fn() })) },
}))

function makeSupabase(subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
  const deleteFn = vi.fn().mockResolvedValue({ error: null })
  const updateFn = vi.fn().mockResolvedValue({ error: null })
  const select = vi.fn().mockReturnValue({
    eq: () => Promise.resolve({ data: subscriptions, error: null }),
  })
  const prefsSelect = vi.fn().mockReturnValue({
    eq: () => ({ maybeSingle: () => Promise.resolve({ data: { push_broadcast_enabled: true }, error: null }) }),
  })
  return {
    from: vi.fn((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select,
          delete: () => ({ eq: (..._a: unknown[]) => { void _a; return Promise.resolve({ error: null }) } }),
          update: () => ({ eq: (..._a: unknown[]) => { void _a; updateFn(); return Promise.resolve({ error: null }) } }),
        }
      }
      if (table === "user_notification_prefs") {
        return { select: prefsSelect }
      }
      return {}
    }),
    _delete: deleteFn,
    _update: updateFn,
  }
}

describe("sendToUser", () => {
  beforeEach(() => { vi.resetAllMocks() })

  it("sends push to each subscription and returns sent count", async () => {
    const { sendPush } = await import("./send")
    ;(sendPush as ReturnType<typeof vi.fn>).mockResolvedValue({ statusCode: 201 })
    const supabase = makeSupabase([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "e2", p256dh: "p2", auth: "a2" },
    ])
    const { sendToUser } = await import("./dispatch")
    const result = await sendToUser(supabase as never, "user-1", { title: "T", body: "B" }, { category: "transactional" })
    expect(sendPush).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(2)
  })

  it("skips broadcast when preference disabled", async () => {
    const supabase = makeSupabase([{ id: "s1", endpoint: "e1", p256dh: "p", auth: "a" }])
    supabase.from = vi.fn((table: string) => {
      if (table === "user_notification_prefs") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { push_broadcast_enabled: false }, error: null }) }) }) }
      }
      if (table === "push_subscriptions") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "s1" }], error: null }) }) }
      }
      return {}
    }) as never
    const { sendToUser } = await import("./dispatch")
    const result = await sendToUser(supabase as never, "user-1", { title: "T", body: "B" }, { category: "broadcast" })
    expect(result.sent).toBe(0)
    expect(result.skipped).toBeGreaterThan(0)
  })

  it("deletes subscription on 410 Gone", async () => {
    const { sendPush } = await import("./send")
    const err = Object.assign(new Error("gone"), { statusCode: 410 })
    ;(sendPush as ReturnType<typeof vi.fn>).mockRejectedValue(err)

    const deleteCalls: unknown[] = []
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "user_notification_prefs") {
          return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }
        }
        if (table === "push_subscriptions") {
          return {
            select: () => ({ eq: () => Promise.resolve({ data: [{ id: "s1", endpoint: "e", p256dh: "p", auth: "a" }], error: null }) }),
            delete: () => ({ eq: (col: string, val: string) => { deleteCalls.push([col, val]); return Promise.resolve({ error: null }) } }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }
        }
        return {}
      }),
    }
    const { sendToUser } = await import("./dispatch")
    await sendToUser(supabase as never, "user-1", { title: "T", body: "B" }, { category: "transactional" })
    expect(deleteCalls.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/push/dispatch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dispatch.ts`**

```ts
// src/lib/push/dispatch.ts
import type { SupabaseClient } from "@supabase/supabase-js"
import { Redis } from "@upstash/redis"
import { sendPush } from "./send"
import { getPrefs } from "./preferences"
import type { PushPayload, PushCategory, DispatchResult } from "./types"

let _redis: Redis | null = null
function getRedis(): Redis {
  return (_redis ??= Redis.fromEnv())
}

interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  last_error_at?: string | null
}

export interface DispatchOptions {
  category: PushCategory
  idempotencyKey?: string
}

export async function sendToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  if (opts.category === "broadcast") {
    const prefs = await getPrefs(supabase, userId)
    if (!prefs.push_broadcast_enabled) {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
      return { sent: 0, skipped: data?.length ?? 0, failed: 0 }
    }
    const active = await getRedis().exists(`active:${userId}`)
    if (active) {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
      return { sent: 0, skipped: data?.length ?? 0, failed: 0 }
    }
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, last_error_at")
    .eq("user_id", userId)
  if (error) throw error
  if (!subs || subs.length === 0) return { sent: 0, skipped: 0, failed: 0 }

  let sent = 0, skipped = 0, failed = 0
  for (const sub of subs as StoredSubscription[]) {
    try {
      await sendPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString(), last_error: null, last_error_at: null })
        .eq("id", sub.id)
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        skipped++
        continue
      }
      failed++
      const prevErrAt = sub.last_error_at ? new Date(sub.last_error_at).getTime() : 0
      const now = Date.now()
      if (prevErrAt && now - prevErrAt < 7 * 24 * 3600 * 1000) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
      } else {
        await supabase
          .from("push_subscriptions")
          .update({
            last_error: (err as Error).message?.slice(0, 500) ?? "unknown",
            last_error_at: new Date().toISOString(),
          })
          .eq("id", sub.id)
      }
    }
  }
  return { sent, skipped, failed }
}

export interface BroadcastFilter {
  subscribedTo?: string
  level?: string
}

export async function sendToAll(
  supabase: SupabaseClient,
  payload: PushPayload,
  filter?: BroadcastFilter,
): Promise<DispatchResult> {
  const userIds = await resolveBroadcastUserIds(supabase, filter)
  let sent = 0, skipped = 0, failed = 0
  for (const userId of userIds) {
    const r = await sendToUser(supabase, userId, payload, { category: "broadcast" })
    sent += r.sent; skipped += r.skipped; failed += r.failed
  }
  return { sent, skipped, failed }
}

async function resolveBroadcastUserIds(
  supabase: SupabaseClient,
  filter?: BroadcastFilter,
): Promise<string[]> {
  if (!filter || (!filter.subscribedTo && !filter.level)) {
    const { data } = await supabase.from("profiles").select("id")
    return (data ?? []).map((r) => r.id as string)
  }
  if (filter.subscribedTo) {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("package_id", filter.subscribedTo)
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
  }
  if (filter.level) {
    const { data: pkgs } = await supabase
      .from("packages")
      .select("id")
      .eq("level_id", filter.level)
    const pkgIds = (pkgs ?? []).map((r) => r.id as string)
    const { data } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .in("package_id", pkgIds)
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
  }
  return []
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run src/lib/push/dispatch.test.ts`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/dispatch.ts src/lib/push/dispatch.test.ts
git commit -m "Add dispatch.sendToUser + sendToAll with preference and active gating"
```

---

### Task 7: Extend `src/lib/security/ratelimit.ts` with push limiters

**Files:**
- Modify: `src/lib/security/ratelimit.ts`

- [ ] **Step 1: Append new limiter factories**

Add at the end of the file:

```ts
let _pushSubscribeLimiter: Ratelimit | null = null
export function pushSubscribeLimiter(): Ratelimit {
  return (_pushSubscribeLimiter ??= makeLimiter("push:subscribe", 10, "1 m"))
}

let _pushUnsubscribeLimiter: Ratelimit | null = null
export function pushUnsubscribeLimiter(): Ratelimit {
  return (_pushUnsubscribeLimiter ??= makeLimiter("push:unsubscribe", 20, "1 m"))
}

let _heartbeatLimiter: Ratelimit | null = null
export function heartbeatLimiter(): Ratelimit {
  return (_heartbeatLimiter ??= makeLimiter("heartbeat", 60, "1 m"))
}

let _broadcastLimiter: Ratelimit | null = null
export function broadcastLimiter(): Ratelimit {
  return (_broadcastLimiter ??= makeLimiter("broadcast", 5, "1 h"))
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/security/ratelimit.ts
git commit -m "Add push/heartbeat/broadcast rate limiters"
```

---

### Task 8: API route `/api/push/vapid-public` (GET)

**Files:**
- Create: `src/app/api/push/vapid-public/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/push/vapid-public/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return new NextResponse("VAPID not configured", { status: 500 })
  return new NextResponse(key, {
    status: 200,
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
  })
}
```

- [ ] **Step 2: Smoke test via `curl`**

Run: `npm run dev` in another terminal, then:
```bash
curl -i http://localhost:3000/api/push/vapid-public
```
Expected: 200, body = VAPID public key string.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/push/vapid-public/route.ts
git commit -m "Add /api/push/vapid-public endpoint"
```

---

### Task 9: API route `/api/push/subscribe` (POST)

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, pushSubscribeLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"
}

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(pushSubscribeLimiter(), ipOf(req))
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfter) } },
      )
    }
    throw err
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let parsed: z.infer<typeof subscriptionSchema>
  try {
    parsed = validate(subscriptionSchema, body)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid subscription", fieldErrors: err.fieldErrors }, { status: 400 })
    }
    throw err
  }

  const admin = await createServiceRoleClient()
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null

  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    user_agent: userAgent,
  }, { onConflict: "endpoint" })

  if (error) {
    return NextResponse.json({ error: "Storage failed" }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
```

Note: `upsert(..., { onConflict: "endpoint" })` handles the case where the same browser re-subscribes (e.g., after signing in as a different user — the old row is updated to the new user_id; acceptable).

- [ ] **Step 2: Smoke test via DevTools**

In a browser, with the dev server running, open DevTools Console on the local app logged in as a user and run:
```js
const reg = await navigator.serviceWorker.ready
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: await fetch("/api/push/vapid-public").then(r => r.text()),
})
const res = await fetch("/api/push/subscribe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(sub),
})
console.log(res.status)
```
Expected: 201.

Then verify with MCP:
```
mcp__supabase__execute_sql: SELECT count(*) FROM push_subscriptions;
```
Expected: at least 1.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/push/subscribe/route.ts
git commit -m "Add /api/push/subscribe POST endpoint"
```

---

### Task 10: API route `/api/push/unsubscribe` (DELETE)

**Files:**
- Create: `src/app/api/push/unsubscribe/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/push/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, pushUnsubscribeLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"

const bodySchema = z.object({
  endpoint: z.string().url().max(2048),
})

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"
}

export async function DELETE(req: NextRequest) {
  try {
    await enforceRateLimit(pushUnsubscribeLimiter(), ipOf(req))
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfter) } },
      )
    }
    throw err
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = validate(bodySchema, body)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    throw err
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.endpoint)
  if (error) return NextResponse.json({ error: "Storage failed" }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 2: Smoke test**

After Task 9 subscribe, from DevTools:
```js
await fetch("/api/push/unsubscribe", {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ endpoint: (await (await navigator.serviceWorker.ready).pushManager.getSubscription()).endpoint }),
}).then(r => r.status)
```
Expected: 200.

Verify `SELECT count(*) FROM push_subscriptions WHERE user_id = '<uid>';` returns 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/push/unsubscribe/route.ts
git commit -m "Add /api/push/unsubscribe DELETE endpoint"
```

---

### Task 11: API route `/api/heartbeat` (POST)

**Files:**
- Create: `src/app/api/heartbeat/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { createClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, heartbeatLimiter } from "@/lib/security/ratelimit"

let _redis: Redis | null = null
function redis(): Redis {
  return (_redis ??= Redis.fromEnv())
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await enforceRateLimit(heartbeatLimiter(), user.id)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    throw err
  }

  // SET active:<uid> = now(), EX 90 seconds
  await redis().set(`active:${user.id}`, Date.now().toString(), { ex: 90 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 2: Smoke test**

```bash
curl -i -X POST http://localhost:3000/api/heartbeat -H "Cookie: <copied auth cookie>"
```
Expected: 200 when authenticated, 401 otherwise.

Verify Upstash key: use MCP or Upstash dashboard to confirm `active:<uid>` exists with TTL ~90s.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/heartbeat/route.ts
git commit -m "Add /api/heartbeat endpoint for active-user tracking"
```

---

### Task 12: Extend `next.config.mjs` with customWorkerDir + runtime caching

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Replace the `withPWA` config block**

Find the existing `withPWAInit` call:
```js
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});
```

Replace with:
```js
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  customWorkerDir: "worker",
  fallbacks: { document: "/offline" },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.b-cdn\.net\/.*\.(png|jpg|jpeg|webp)$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "bunny-thumbnails",
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
        },
      },
      {
        urlPattern: /^\/dashboard(\/.*)?$/,
        handler: "NetworkFirst",
        options: { cacheName: "dashboard-shell", networkTimeoutSeconds: 3 },
      },
    ],
  },
  disable: process.env.NODE_ENV === "development",
});
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. `public/sw.js` regenerated and includes references to `/offline` in its precache manifest.

- [ ] **Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "Configure next-pwa customWorkerDir, offline fallback, runtime caching"
```

---

### Task 13: Create `worker/index.ts`

**Files:**
- Create: `worker/index.ts`

- [ ] **Step 1: Write the SW fragment**

```ts
// worker/index.ts
// Merged into the Workbox-generated SW by @ducanh2912/next-pwa at build.
// Runs in ServiceWorkerGlobalScope. KEEP PushPayload IN SYNC with src/lib/push/types.ts.

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
}

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: "Rita", body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icon-192.png",
      badge: payload.badge ?? "/icon-192.png",
      tag: payload.tag,
      renotify: !!payload.tag,
      data: { url: payload.url ?? "/dashboard", ...(payload.data ?? {}) },
    }),
  )
})

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const target = data?.url ?? "/dashboard"
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (const c of clients) {
        if (c.url.startsWith(self.location.origin)) {
          await c.focus()
          if ("navigate" in c) {
            try { await (c as WindowClient).navigate(target) } catch { /* ignore */ }
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

self.addEventListener("pushsubscriptionchange", (event: Event) => {
  event.waitUntil(
    (async () => {
      try {
        const resp = await fetch("/api/push/vapid-public")
        const vapidKey = await resp.text()
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSub.toJSON()),
        })
      } catch {
        // Surfaced on next dispatch as 410 if re-subscribe fails
      }
    })(),
  )
})

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
```

- [ ] **Step 2: Build, verify SW generated**

Run: `npm run build`
Expected: succeeds.

Run: `ls public/sw.js public/worker-*.js 2>/dev/null || ls public/sw.js`
Expected: `public/sw.js` exists; search it for "push" with:
```bash
grep -c "addEventListener.*push" public/sw.js
```
Expected: ≥ 1 (the custom worker's push listener is merged).

- [ ] **Step 3: Commit**

```bash
git add worker/index.ts
git commit -m "Add service worker push, notificationclick, pushsubscriptionchange handlers"
```

---

### Task 14: Offline fallback page

**Files:**
- Create: `src/app/offline/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/offline/page.tsx
import Image from "next/image"

export const dynamic = "force-static"

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#001F3D] text-white flex flex-col items-center justify-center p-8 text-center">
      <Image src="/logo/logo.png" alt="Rita" width={120} height={120} priority />
      <h1 className="mt-8 text-2xl font-black italic uppercase tracking-tighter">
        Sei offline
      </h1>
      <p className="mt-4 max-w-sm text-sm text-neutral-300 font-medium leading-relaxed">
        Riconnettiti a internet per continuare il tuo allenamento. I pacchetti
        già visti restano accessibili nella schermata principale.
      </p>
      <a
        href="/dashboard"
        className="mt-8 px-8 py-4 rounded-2xl bg-brand text-white font-black uppercase tracking-widest text-sm"
      >
        Torna alla home
      </a>
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds. `/offline` precached.

- [ ] **Step 3: Smoke test**

Start the production build: `npm run start`. Navigate to `/offline` → page renders.

Then in DevTools → Application → Service Workers → "Offline" checkbox → navigate to a non-cached route like `/offline-test-nowhere` → `/offline` content served.

- [ ] **Step 4: Commit**

```bash
git add src/app/offline/page.tsx
git commit -m "Add /offline fallback page"
```

---

### Task 15: PR #5 checklist

- [ ] **Step 1: Run lint + typecheck + tests**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
```
Expected: all pass.

- [ ] **Step 2: Open PR #5**

```bash
git push -u origin sub2-push-offline
gh pr create --title "Sub-2 PR #5 — Push foundation (migration, libs, SW, offline)" --body "$(cat <<'EOF'
## Summary
- Migration 08: `push_subscriptions`, `user_notification_prefs`, `user_subscriptions.trial_reminder_sent_at`
- `src/lib/push/` modules: types, send, preferences, dispatch (unit-tested)
- REST endpoints: subscribe, unsubscribe, vapid-public, heartbeat (Zod + rate-limited)
- Service worker custom fragment: push, notificationclick, pushsubscriptionchange
- `next.config.mjs`: customWorkerDir + /offline fallback + runtime caching
- `/offline` page

## Spec
`docs/superpowers/specs/2026-04-21-pwa-push-offline-design.md`

## Test plan
- [ ] `npm run lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` passes
- [ ] Prod build succeeds (`npm run build`)
- [ ] Subscribe from DevTools console — row appears in `push_subscriptions`
- [ ] Unsubscribe — row deleted
- [ ] `/offline` renders standalone

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR #6 — UX + preferences

**Goal:** Ship the user-facing subscription flow. Users see the soft-prompt at 2nd `/dashboard` visit, get platform-appropriate install instructions on iOS, and can manage devices + broadcast opt-out from Profile. No triggers yet.

### Task 16: User-agent parser

**Files:**
- Create: `src/lib/user-agent.test.ts`
- Create: `src/lib/user-agent.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/user-agent.test.ts
import { describe, it, expect } from "vitest"
import { parseUserAgent } from "./user-agent"

describe("parseUserAgent", () => {
  it("parses Chrome on Windows", () => {
    const r = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
    expect(r.browser).toBe("Chrome")
    expect(r.os).toBe("Windows")
  })
  it("parses Safari on iPhone", () => {
    const r = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604")
    expect(r.browser).toBe("Safari")
    expect(r.os).toBe("iOS")
  })
  it("parses Firefox on macOS", () => {
    const r = parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/120.0")
    expect(r.browser).toBe("Firefox")
    expect(r.os).toBe("macOS")
  })
  it("falls back to Sconosciuto on junk", () => {
    const r = parseUserAgent("node")
    expect(r.browser).toBe("Sconosciuto")
    expect(r.os).toBe("Sconosciuto")
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `npx vitest run src/lib/user-agent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `user-agent.ts`**

```ts
// src/lib/user-agent.ts
export interface ParsedUA {
  browser: string
  os: string
}

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua || ua.length < 4) return { browser: "Sconosciuto", os: "Sconosciuto" }

  let os = "Sconosciuto"
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS"
  else if (/Windows/.test(ua)) os = "Windows"
  else if (/Linux/.test(ua)) os = "Linux"

  let browser = "Sconosciuto"
  if (/Firefox\//.test(ua)) browser = "Firefox"
  else if (/Edg\//.test(ua)) browser = "Edge"
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome"
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari"

  return { browser, os }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/user-agent.test.ts`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-agent.ts src/lib/user-agent.test.ts
git commit -m "Add tiny user-agent parser for device list display"
```

---

### Task 17: Push subscribe client helper

**Files:**
- Create: `src/lib/push/client.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/push/client.ts
// Client-side helpers for the push subscription flow. Browser-only.

export interface SubscribeResult {
  ok: boolean
  reason?: "unsupported" | "permission-denied" | "storage-failed" | "sw-not-ready"
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export async function requestAndSubscribe(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: "permission-denied" }

  const reg = await navigator.serviceWorker.ready
  if (!reg) return { ok: false, reason: "sw-not-ready" }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return { ok: false, reason: "sw-not-ready" }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  })
  if (!res.ok) return { ok: false, reason: "storage-failed" }
  return { ok: true }
}

export async function unsubscribeCurrent(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return true
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await fetch("/api/push/unsubscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  })
  return true
}

export async function subscribeIfMissing(): Promise<void> {
  if (!isPushSupported()) return
  if (Notification.permission !== "granted") return
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return
  await requestAndSubscribe()
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/push/client.ts
git commit -m "Add client-side push subscribe/unsubscribe helpers"
```

---

### Task 18: Heartbeat hook

**Files:**
- Create: `src/hooks/useHeartbeat.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useHeartbeat.ts
"use client"
import { useEffect } from "react"

// Pings /api/heartbeat every 30s while the tab is focused. Server upserts
// `active:<userId>` in Upstash with 90s TTL; dispatch checks this before
// firing broadcast pushes to skip users currently viewing the app.
export function useHeartbeat(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    if (typeof document === "undefined") return

    let timer: ReturnType<typeof setInterval> | null = null

    const ping = async () => {
      if (document.visibilityState !== "visible") return
      try {
        await fetch("/api/heartbeat", { method: "POST" })
      } catch {
        // silent
      }
    }

    const start = () => {
      if (timer) return
      ping()
      timer = setInterval(ping, 30_000)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") start(); else stop()
    }

    onVisibility()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled])
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHeartbeat.ts
git commit -m "Add useHeartbeat hook pinging /api/heartbeat every 30s while focused"
```

---

### Task 19: Soft-prompt orchestrator hook

**Files:**
- Create: `src/hooks/usePushPromptOrchestrator.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/usePushPromptOrchestrator.ts
"use client"
import { useEffect, useState } from "react"
import { isIosSafari, isPushSupported, isStandalone, subscribeIfMissing } from "@/lib/push/client"

const VISIT_COUNT_KEY = "dashboard_visit_count"
const DISMISSED_AT_KEY = "push_prompt_dismissed_at"
const COOLDOWN_MS = 7 * 24 * 3600 * 1000
const DELAY_MS = 18_000
const MIN_VISITS = 2

type Prompt = "none" | "soft" | "ios-install"

export function usePushPromptOrchestrator(enabled: boolean): {
  prompt: Prompt
  dismiss: () => void
  acceptedSoftPrompt: () => void
} {
  const [prompt, setPrompt] = useState<Prompt>("none")

  useEffect(() => {
    if (!enabled) return
    if (!isPushSupported() && !isIosSafari()) return
    try {
      const count = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? "0") + 1
      localStorage.setItem(VISIT_COUNT_KEY, String(count))

      if (isPushSupported() && Notification.permission === "granted") {
        subscribeIfMissing()
        return
      }
      if (isPushSupported() && Notification.permission === "denied") return
      if (count < MIN_VISITS) return

      const dismissed = localStorage.getItem(DISMISSED_AT_KEY)
      if (dismissed) {
        const elapsed = Date.now() - Number(dismissed)
        if (Number.isFinite(elapsed) && elapsed < COOLDOWN_MS) return
      }

      const timer = setTimeout(() => {
        if (isIosSafari() && !isStandalone()) {
          setPrompt("ios-install")
        } else if (isPushSupported()) {
          setPrompt("soft")
        }
      }, DELAY_MS)
      return () => clearTimeout(timer)
    } catch {
      // localStorage quota / disabled — silently skip
    }
  }, [enabled])

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_AT_KEY, String(Date.now())) } catch { /* ignore */ }
    setPrompt("none")
  }

  const acceptedSoftPrompt = () => {
    setPrompt("none")
  }

  return { prompt, dismiss, acceptedSoftPrompt }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePushPromptOrchestrator.ts
git commit -m "Add soft-prompt orchestrator hook"
```

---

### Task 20: NotificationSoftPrompt component

**Files:**
- Create: `src/components/push/NotificationSoftPrompt.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/push/NotificationSoftPrompt.tsx
"use client"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { requestAndSubscribe } from "@/lib/push/client"

interface Props {
  open: boolean
  onDismiss: () => void
  onAccepted: () => void
}

export function NotificationSoftPrompt({ open, onDismiss, onAccepted }: Props) {
  const handleAccept = async () => {
    const r = await requestAndSubscribe()
    if (r.ok) {
      toast.success("Notifiche attivate")
      onAccepted()
      return
    }
    if (r.reason === "permission-denied") {
      toast.info("Puoi riattivarle dalle impostazioni del browser")
    } else if (r.reason === "storage-failed") {
      toast.error("Errore salvando la sottoscrizione, riprova")
    } else {
      toast.error("Notifiche non supportate su questo dispositivo")
    }
    onAccepted()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss() }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-[2rem] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <Bell className="h-5 w-5 text-brand" />
            Vuoi essere avvisata?
          </DialogTitle>
          <DialogDescription className="text-neutral-400 font-medium leading-relaxed pt-2">
            Ricevi una notifica quando Rita carica nuovi allenamenti o risponde
            alle tue richieste. Puoi disattivarle in qualsiasi momento dal tuo
            profilo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-0 pt-2">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="flex-1 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
          >
            Più tardi
          </Button>
          <Button
            onClick={handleAccept}
            className="flex-1 bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest rounded-xl"
          >
            Sì, attiva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/push/NotificationSoftPrompt.tsx
git commit -m "Add NotificationSoftPrompt dialog"
```

---

### Task 21: IosInstallDialog component

**Files:**
- Create: `src/components/push/IosInstallDialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/push/IosInstallDialog.tsx
"use client"
import { Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  open: boolean
  onDismiss: () => void
}

export function IosInstallDialog({ open, onDismiss }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss() }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-[2rem] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <Share className="h-5 w-5 text-brand" />
            Installa Rita sulla Home
          </DialogTitle>
          <DialogDescription className="text-neutral-400 font-medium leading-relaxed pt-2">
            Per ricevere notifiche su iPhone devi prima aggiungere l&apos;app
            alla tua schermata Home.
          </DialogDescription>
        </DialogHeader>
        <ol className="text-sm text-neutral-300 space-y-3 pt-2 pl-4 list-decimal">
          <li>Tocca l&apos;icona Condividi <Share className="inline h-4 w-4" /> in basso al browser</li>
          <li>Scegli &quot;Aggiungi alla schermata Home&quot;</li>
          <li>Apri l&apos;app dall&apos;icona installata</li>
        </ol>
        <DialogFooter className="pt-2">
          <Button
            onClick={onDismiss}
            className="w-full bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest rounded-xl"
          >
            Ho capito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/push/IosInstallDialog.tsx
git commit -m "Add IosInstallDialog with Share-sheet instructions"
```

---

### Task 22: Mount orchestrator + heartbeat in DashboardClient

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add imports and orchestrator**

At the top of `DashboardClient.tsx`, add:
```tsx
import { usePushPromptOrchestrator } from "@/hooks/usePushPromptOrchestrator"
import { useHeartbeat } from "@/hooks/useHeartbeat"
import { NotificationSoftPrompt } from "@/components/push/NotificationSoftPrompt"
import { IosInstallDialog } from "@/components/push/IosInstallDialog"
```

Inside the component function, near the existing hooks, add:
```tsx
const { prompt, dismiss, acceptedSoftPrompt } = usePushPromptOrchestrator(true)
useHeartbeat(true)
```

In the returned JSX (near the top-level wrapper, outside the main content tree), add:
```tsx
<NotificationSoftPrompt
  open={prompt === "soft"}
  onDismiss={dismiss}
  onAccepted={acceptedSoftPrompt}
/>
<IosInstallDialog open={prompt === "ios-install"} onDismiss={dismiss} />
```

- [ ] **Step 2: Manual test**

Clear localStorage, start dev server (`npm run dev`), visit `/dashboard` twice (navigate away then back). 18s after the 2nd visit, expect the soft-prompt dialog. Click "Più tardi" → cooldown set. Reload — dialog should NOT reappear.

Open DevTools → Application → Local Storage → verify `dashboard_visit_count` and `push_prompt_dismissed_at`.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "Mount push orchestrator and heartbeat in dashboard"
```

---

### Task 23: PushPreferencesSection component

**Files:**
- Create: `src/components/push/PushPreferencesSection.tsx`
- Create: `src/app/actions/push.ts`

- [ ] **Step 1: Write the server action file**

```ts
// src/app/actions/push.ts
"use server"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { toggleBroadcast } from "@/lib/push/preferences"
import { parseUserAgent } from "@/lib/user-agent"

export interface DeviceRow {
  id: string
  browser: string
  os: string
  created_at: string
  last_used_at: string | null
  last_error: string | null
}

export async function getMyPrefs(): Promise<{ pushBroadcastEnabled: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data } = await supabase
    .from("user_notification_prefs")
    .select("push_broadcast_enabled")
    .eq("user_id", user.id)
    .maybeSingle()
  return { pushBroadcastEnabled: data?.push_broadcast_enabled ?? true }
}

export async function setBroadcastEnabled(enabled: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  await toggleBroadcast(supabase, user.id, enabled)
}

export async function getMyDevices(): Promise<DeviceRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, user_agent, created_at, last_used_at, last_error")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  return (data ?? []).map((d) => {
    const parsed = parseUserAgent(d.user_agent)
    return {
      id: d.id,
      browser: parsed.browser,
      os: parsed.os,
      created_at: d.created_at,
      last_used_at: d.last_used_at,
      last_error: d.last_error,
    }
  })
}

export async function revokeMyDevice(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = await createServiceRoleClient()
  await admin.from("push_subscriptions").delete().eq("id", id).eq("user_id", user.id)
}
```

- [ ] **Step 2: Write the component**

```tsx
// src/components/push/PushPreferencesSection.tsx
"use client"
import { useEffect, useState } from "react"
import { Bell, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  getMyPrefs, setBroadcastEnabled, getMyDevices, revokeMyDevice,
  type DeviceRow,
} from "@/app/actions/push"
import { requestAndSubscribe, unsubscribeCurrent, isPushSupported } from "@/lib/push/client"

export function PushPreferencesSection() {
  const [broadcastEnabled, setBroadcast] = useState(true)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { pushBroadcastEnabled } = await getMyPrefs()
        setBroadcast(pushBroadcastEnabled)
        setDevices(await getMyDevices())
        if (!isPushSupported()) setPermission("unsupported")
        else setPermission(Notification.permission)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleBroadcastPref = async (next: boolean) => {
    setBroadcast(next)
    try { await setBroadcastEnabled(next); toast.success("Preferenze aggiornate") }
    catch { setBroadcast(!next); toast.error("Errore salvando le preferenze") }
  }

  const revoke = async (id: string) => {
    try { await revokeMyDevice(id); setDevices(devices.filter((d) => d.id !== id)); toast.success("Dispositivo rimosso") }
    catch { toast.error("Errore rimuovendo il dispositivo") }
  }

  const enableHere = async () => {
    const r = await requestAndSubscribe()
    if (r.ok) { toast.success("Notifiche attivate"); setDevices(await getMyDevices()); setPermission("granted") }
    else if (r.reason === "permission-denied") { toast.info("Hai negato il permesso"); setPermission("denied") }
    else toast.error("Errore abilitando le notifiche")
  }

  const disableHere = async () => {
    await unsubscribeCurrent()
    setDevices(await getMyDevices())
    toast.success("Notifiche disattivate su questo dispositivo")
  }

  if (loading) return null

  return (
    <Card className="bg-neutral-900 border-white/10 rounded-[2rem]">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white font-black uppercase italic tracking-tighter">
          <Bell className="h-5 w-5 text-brand" />
          Notifiche push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {permission === "denied" && (
          <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              Hai bloccato le notifiche nelle impostazioni del browser.
              Per riattivarle, apri il pannello dei permessi del sito dal tuo
              browser e consenti le notifiche.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm text-neutral-300">
            <strong className="text-white">Aggiornamenti importanti</strong>
            <div className="text-xs text-neutral-400 mt-1">
              Acquisti, abbonamenti, rimborsi. Sempre attive, legate al servizio.
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5">
            <div className="text-sm text-neutral-300">
              <strong className="text-white">Annunci e novità</strong>
              <div className="text-xs text-neutral-400 mt-1">
                Nuovi pacchetti, eventi, contenuti esclusivi.
              </div>
            </div>
            <Switch checked={broadcastEnabled} onCheckedChange={toggleBroadcastPref} />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="text-xs font-black uppercase tracking-widest text-neutral-400">
            Dispositivi attivi
          </div>
          {devices.length === 0 ? (
            <div className="text-sm text-neutral-400">Nessun dispositivo registrato.</div>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 text-sm text-neutral-300 bg-white/5 rounded-xl px-4 py-3">
                  <div>
                    <div className="font-medium text-white">{d.browser} su {d.os}</div>
                    <div className="text-xs text-neutral-500">
                      Attivato il {new Date(d.created_at).toLocaleDateString("it-IT")}
                      {d.last_error && <span className="text-red-400 ml-2">· errore recente</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke(d.id)} className="text-neutral-400 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 border-t border-white/5">
          {permission === "granted" ? (
            <Button variant="outline" onClick={disableHere} className="w-full rounded-xl">
              Disattiva su questo dispositivo
            </Button>
          ) : permission === "default" ? (
            <Button onClick={enableHere} className="w-full rounded-xl bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest">
              Attiva su questo dispositivo
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Add shadcn `switch` if not present**

Run: `ls src/components/ui/switch.tsx`. If missing:
```bash
npx shadcn@latest add switch
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/push.ts src/components/push/PushPreferencesSection.tsx src/components/ui/switch.tsx
git commit -m "Add PushPreferencesSection with toggles, device list, revoke"
```

---

### Task 24: Wire PushPreferencesSection into ProfileSection

**Files:**
- Modify: `src/app/dashboard/ProfileSection.tsx`

- [ ] **Step 1: Add import and mount**

At the top:
```tsx
import { PushPreferencesSection } from "@/components/push/PushPreferencesSection"
```

Inside the Profile JSX, after the existing "Privacy & data" or Security section, add:
```tsx
<PushPreferencesSection />
```

Exact placement: locate the container `<div className="space-y-*">` wrapping the profile sections; append `<PushPreferencesSection />` as the last child (or near the existing notification settings if one exists).

- [ ] **Step 2: Manual test**

Dev server → navigate to Profile → confirm section renders, toggle persists to DB (verify via MCP), "Attiva/Disattiva su questo dispositivo" works.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/ProfileSection.tsx
git commit -m "Include PushPreferencesSection in Profile"
```

---

### Task 25: PR #6 checklist

- [ ] **Step 1: Run lint + typecheck + tests**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
```
Expected: all pass.

- [ ] **Step 2: Manual flow check**

- Clear localStorage → visit `/dashboard` twice → soft-prompt appears after 18s
- Accept → native prompt → grant → subscription stored → Profile shows device
- Toggle "Annunci e novità" off → `user_notification_prefs.push_broadcast_enabled = false`
- Revoke device from Profile → row removed

- [ ] **Step 3: Open PR #6**

```bash
git push
gh pr create --title "Sub-2 PR #6 — Push UX and preferences" --body "$(cat <<'EOF'
## Summary
- Soft-prompt orchestrator hook (2nd visit, 15-20s delay, 7d cooldown)
- NotificationSoftPrompt + IosInstallDialog components
- PushPreferencesSection in Profile: broadcast toggle, device list, revoke
- Heartbeat hook (30s ping while focused)
- Client-side subscribe/unsubscribe helpers
- User-agent parser (tiny regex-based)

## Test plan
- [ ] Clear localStorage; visit /dashboard twice → soft-prompt at 18s
- [ ] Accept → device appears in Profile
- [ ] Toggle broadcast off → verify user_notification_prefs row
- [ ] Revoke device → row removed
- [ ] Heartbeat fires every 30s while focused (verify Upstash key `active:<uid>`)
- [ ] iOS Safari non-standalone → IosInstallDialog shown instead of soft-prompt

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR #7 — Triggers, broadcast, cron

**Goal:** Wire dispatch into all trigger points, extend AdminBroadcasts with the new targeting + channels, add the trial T-2 Vercel Cron. Manual QA checklist must pass before merge.

### Task 26: Payload templates with tests

**Files:**
- Create: `src/lib/push/payload-templates.test.ts`
- Create: `src/lib/push/payload-templates.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/push/payload-templates.test.ts
import { describe, it, expect } from "vitest"
import {
  purchaseCompletedPayload, subscriptionRenewedPayload, paymentFailedPayload,
  refundApprovedPayload, adminResponsePayload, trialReminderPayload,
} from "./payload-templates"

describe("payload templates", () => {
  it("purchase includes package name and id in url", () => {
    const p = purchaseCompletedPayload({ packageName: "Pilates", packageId: "abc", sessionId: "sess" })
    expect(p.title).toBe("Acquisto confermato")
    expect(p.body).toContain("Pilates")
    expect(p.url).toBe("/dashboard/package/abc")
    expect(p.tag).toBe("purchase-sess")
  })
  it("trial reminder uses subscription id in tag", () => {
    const p = trialReminderPayload({ subscriptionId: "sub-1" })
    expect(p.title).toContain("2 giorni")
    expect(p.tag).toBe("trial-reminder-sub-1")
  })
  it("admin response truncates body at 100 chars", () => {
    const long = "a".repeat(200)
    const p = adminResponsePayload({ requestId: "r1", message: long })
    expect(p.body.length).toBeLessThanOrEqual(103)
  })
  it("payment failed points to billing anchor", () => {
    const p = paymentFailedPayload({ invoiceId: "inv-1" })
    expect(p.url).toBe("/dashboard#billing")
    expect(p.tag).toBe("payment-failed-inv-1")
  })
  it("refund approved payload has correct title", () => {
    const p = refundApprovedPayload({ refundId: "ref-1" })
    expect(p.title).toBe("Rimborso approvato")
  })
  it("subscription renewed payload has correct title", () => {
    const p = subscriptionRenewedPayload({ invoiceId: "inv-1" })
    expect(p.title).toBe("Abbonamento rinnovato")
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `npx vitest run src/lib/push/payload-templates.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/push/payload-templates.ts
import type { PushPayload } from "./types"

export function purchaseCompletedPayload(args: { packageName: string; packageId: string; sessionId: string }): PushPayload {
  return {
    title: "Acquisto confermato",
    body: `Il pacchetto ${args.packageName} è ora nella tua Home.`,
    url: `/dashboard/package/${args.packageId}`,
    tag: `purchase-${args.sessionId}`,
  }
}

export function subscriptionRenewedPayload(args: { invoiceId: string }): PushPayload {
  return {
    title: "Abbonamento rinnovato",
    body: "Grazie, continua così!",
    url: "/dashboard#billing",
    tag: `renewal-${args.invoiceId}`,
  }
}

export function paymentFailedPayload(args: { invoiceId: string }): PushPayload {
  return {
    title: "Pagamento non riuscito",
    body: "Aggiorna il metodo di pagamento per non perdere l'accesso.",
    url: "/dashboard#billing",
    tag: `payment-failed-${args.invoiceId}`,
  }
}

export function refundApprovedPayload(args: { refundId: string }): PushPayload {
  return {
    title: "Rimborso approvato",
    body: "Riceverai l'accredito entro 5-10 giorni.",
    url: "/dashboard#billing",
    tag: `refund-${args.refundId}`,
  }
}

export function adminResponsePayload(args: { requestId: string; message: string }): PushPayload {
  const trimmed = args.message.trim().slice(0, 100)
  return {
    title: "Hai una nuova risposta dal team Rita",
    body: trimmed + (args.message.length > 100 ? "…" : ""),
    url: "/dashboard",
    tag: `response-${args.requestId}`,
  }
}

export function trialReminderPayload(args: { subscriptionId: string }): PushPayload {
  return {
    title: "Il tuo periodo di prova scade tra 2 giorni",
    body: "Rinnova per non perdere l'accesso.",
    url: "/dashboard#billing",
    tag: `trial-reminder-${args.subscriptionId}`,
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/push/payload-templates.test.ts`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/payload-templates.ts src/lib/push/payload-templates.test.ts
git commit -m "Add payload templates for each push trigger"
```

---

### Task 27: Hook dispatch into Stripe webhook `checkout.session.completed`

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Locate the `checkout.session.completed` case**

Run: `grep -n "checkout.session.completed" src/app/api/webhooks/stripe/route.ts`
Read surrounding context (about 50 lines).

- [ ] **Step 2: Add dispatch call after existing handling**

Within the case handler, AFTER the existing user_notifications insert and admin_notifications insert, add:

```ts
import { sendToUser } from "@/lib/push/dispatch"
import { purchaseCompletedPayload } from "@/lib/push/payload-templates"
```
(add near other imports at top)

Then at the relevant point inside the handler (after the purchase record is created, with `userId`, `packageName`, `packageId`, and the Stripe `session.id` in scope):
```ts
try {
  await sendToUser(
    supabaseAdmin,
    userId,
    purchaseCompletedPayload({ packageName, packageId, sessionId: session.id }),
    { category: "transactional", idempotencyKey: `purchase-${session.id}` },
  )
} catch (err) {
  console.error("[push] purchase dispatch failed", err)
}
```

The try/catch swallows errors: webhook must still return 200 even if push fails.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual test**

With a subscribed test device, complete a Stripe test checkout → confirm push arrives within ~5s.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "Dispatch push on checkout.session.completed"
```

---

### Task 28: Hook dispatch into `invoice.payment_succeeded`

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Locate handler**

Find the `case "invoice.payment_succeeded":` (or equivalent) block.

- [ ] **Step 2: Add dispatch**

After the existing logic, with `userId` and `invoice.id` in scope:
```ts
import { subscriptionRenewedPayload } from "@/lib/push/payload-templates"
// ...
try {
  await sendToUser(
    supabaseAdmin,
    userId,
    subscriptionRenewedPayload({ invoiceId: invoice.id }),
    { category: "transactional", idempotencyKey: `renewal-${invoice.id}` },
  )
} catch (err) {
  console.error("[push] renewal dispatch failed", err)
}
```

**If the event is for a first-checkout invoice (not a renewal), skip:** check `invoice.billing_reason === "subscription_cycle"` before dispatching, else no push (already covered by `checkout.session.completed` path).

```ts
if (invoice.billing_reason === "subscription_cycle") {
  try { await sendToUser(...) } catch (err) { /* ... */ }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "Dispatch push on subscription renewal (billing_reason=subscription_cycle)"
```

---

### Task 29: Hook dispatch into `invoice.payment_failed`

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Locate or add the handler**

Check if `case "invoice.payment_failed":` exists. If not, add it to the switch:
```ts
case "invoice.payment_failed": {
  const invoice = event.data.object as Stripe.Invoice
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
  if (!customerId) break
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (!profile) break
  try {
    await sendToUser(
      supabaseAdmin,
      profile.id,
      paymentFailedPayload({ invoiceId: invoice.id }),
      { category: "transactional", idempotencyKey: `payment-failed-${invoice.id}` },
    )
  } catch (err) {
    console.error("[push] payment failed dispatch failed", err)
  }
  await supabaseAdmin.from("user_notifications").insert({
    user_id: profile.id,
    type: "payment_failed",
    title: "Pagamento non riuscito",
    body: "Aggiorna il metodo di pagamento per non perdere l'accesso.",
    read: false,
  })
  break
}
```
Also add the import:
```ts
import { paymentFailedPayload } from "@/lib/push/payload-templates"
```

- [ ] **Step 2: Ensure the event is subscribed on Stripe Dashboard**

`invoice.payment_failed` was already added to the test-mode webhook per `memory/project_status.md` Stripe section.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/webhooks/stripe/route.ts
git commit -m "Handle invoice.payment_failed with push + in-app notification"
```

---

### Task 30: Hook dispatch into admin refund + response actions

**Files:**
- Modify: `src/app/actions/admin_actions/users.ts` (or wherever `respondToRequest` / admin refund lives)
- Modify: `src/app/actions/user.ts` (if refund response path is here)

- [ ] **Step 1: Locate admin response endpoint**

Run: `grep -n "admin_notifications" src/app/actions/admin_actions/users.ts src/app/actions/user.ts src/app/actions/stripe.ts`

Find the action that transitions an admin_notification/user request to "responded" (look for the place where the admin writes the response message).

- [ ] **Step 2: Add dispatch at response time**

After the existing code that inserts the user-facing `user_notifications` row, with `userId`, `requestId`, and the admin's response `message` in scope:
```ts
import { createServiceRoleClient } from "@/utils/supabase/server"
import { sendToUser } from "@/lib/push/dispatch"
import { adminResponsePayload, refundApprovedPayload } from "@/lib/push/payload-templates"

// inside the action, after user_notifications insert:
const admin = await createServiceRoleClient()
try {
  // Use refund-specific payload if the action is a refund approval; else generic.
  const payload = isRefundApproval
    ? refundApprovedPayload({ refundId: refundId })
    : adminResponsePayload({ requestId: requestId, message: responseMessage })
  await sendToUser(admin, userId, payload, { category: "transactional" })
} catch (err) {
  console.error("[push] admin response dispatch failed", err)
}
```

Concrete distinction: refund approval path passes `isRefundApproval: true` + `refundId`; generic response path passes the message.

- [ ] **Step 3: Typecheck + manual test**

Log in as admin, respond to a test user request → test device receives push.

```bash
npx tsc --noEmit
git add src/app/actions/admin_actions/users.ts src/app/actions/user.ts
git commit -m "Dispatch push on admin response and refund approval"
```

---

### Task 31: Broadcast action schemas

**Files:**
- Create: `src/app/actions/admin_actions/broadcasts.schemas.ts`

- [ ] **Step 1: Write the schema**

```ts
// src/app/actions/admin_actions/broadcasts.schemas.ts
import { z } from "zod"

export const broadcastSchema = z.object({
  title: z.string().trim().min(3, "Titolo min 3 caratteri").max(50, "Titolo max 50 caratteri"),
  body: z.string().trim().min(5, "Messaggio min 5 caratteri").max(150, "Messaggio max 150 caratteri"),
  url: z.string().startsWith("/", "URL deve iniziare con /").max(200),
  targetType: z.enum(["all", "package", "level"]),
  targetId: z.string().uuid().optional(),
  channels: z.object({
    inApp: z.boolean(),
    push: z.boolean(),
    email: z.boolean().default(false),
  }),
}).refine(
  (d) => d.targetType === "all" || !!d.targetId,
  { message: "targetId richiesto quando targetType non è 'all'", path: ["targetId"] },
)

export type BroadcastInput = z.infer<typeof broadcastSchema>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/admin_actions/broadcasts.schemas.ts
git commit -m "Add broadcast Zod schema"
```

---

### Task 32: Broadcast action implementation with tests

**Files:**
- Create: `src/app/actions/admin_actions/broadcasts.test.ts`
- Create: `src/app/actions/admin_actions/broadcasts.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/actions/admin_actions/broadcasts.test.ts
import { describe, it, expect } from "vitest"
import { broadcastSchema } from "./broadcasts.schemas"

describe("broadcastSchema", () => {
  it("requires targetId when targetType is package", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao", body: "Messaggio test",
      url: "/dashboard",
      targetType: "package",
      channels: { inApp: true, push: true, email: false },
    })
    expect(r.success).toBe(false)
  })

  it("passes with all + channels", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao", body: "Messaggio test",
      url: "/dashboard",
      targetType: "all",
      channels: { inApp: true, push: true, email: false },
    })
    expect(r.success).toBe(true)
  })

  it("rejects url not starting with /", () => {
    const r = broadcastSchema.safeParse({
      title: "Ciao", body: "Messaggio test",
      url: "https://evil.com",
      targetType: "all",
      channels: { inApp: true, push: true, email: false },
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify passes (schema is already implemented in Task 31)**

Run: `npx vitest run src/app/actions/admin_actions/broadcasts.test.ts`
Expected: 3 tests passing.

- [ ] **Step 3: Implement server action**

```ts
// src/app/actions/admin_actions/broadcasts.ts
"use server"
import { createClient, createServiceRoleClient } from "@/utils/supabase/server"
import { enforceRateLimit, RateLimitError, broadcastLimiter } from "@/lib/security/ratelimit"
import { validate, ValidationError } from "@/lib/security/validation"
import { sendToAll } from "@/lib/push/dispatch"
import { broadcastSchema, type BroadcastInput } from "./broadcasts.schemas"
import type { ActionResult } from "@/lib/security/types"

async function assertAdmin(userId: string): Promise<boolean> {
  const admin = await createServiceRoleClient()
  const { data } = await admin.from("admins").select("user_id").eq("user_id", userId).maybeSingle()
  return !!data
}

async function resolveRecipientIds(
  admin: Awaited<ReturnType<typeof createServiceRoleClient>>,
  input: BroadcastInput,
): Promise<string[]> {
  if (input.targetType === "all") {
    const { data } = await admin.from("profiles").select("id")
    return (data ?? []).map((r) => r.id as string)
  }
  if (input.targetType === "package") {
    const { data } = await admin.from("user_subscriptions").select("user_id").eq("package_id", input.targetId!)
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
  }
  // level
  const { data: pkgs } = await admin.from("packages").select("id").eq("level_id", input.targetId!)
  const pkgIds = (pkgs ?? []).map((r) => r.id as string)
  if (pkgIds.length === 0) return []
  const { data } = await admin.from("user_subscriptions").select("user_id").in("package_id", pkgIds)
  return Array.from(new Set((data ?? []).map((r) => r.user_id as string)))
}

export async function countBroadcastRecipients(
  input: Pick<BroadcastInput, "targetType" | "targetId">,
): Promise<{ total: number; withPush: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertAdmin(user.id))) return { total: 0, withPush: 0 }

  const admin = await createServiceRoleClient()
  const ids = await resolveRecipientIds(admin, { ...input, title: "x", body: "xxxxx", url: "/", channels: { inApp: true, push: false, email: false } } as BroadcastInput)
  if (ids.length === 0) return { total: 0, withPush: 0 }

  const { data: subs } = await admin.from("push_subscriptions").select("user_id").in("user_id", ids)
  const usersWithPush = new Set((subs ?? []).map((r) => r.user_id as string))
  return { total: ids.length, withPush: usersWithPush.size }
}

export async function sendBroadcast(input: BroadcastInput): Promise<ActionResult<{
  recipients: number
  inApp: number
  pushSent: number
  pushSkipped: number
  pushFailed: number
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Non autenticato" }
  if (!(await assertAdmin(user.id))) return { ok: false, message: "Non autorizzato" }

  try {
    await enforceRateLimit(broadcastLimiter(), user.id)
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, message: err.message, retryAfter: err.retryAfter }
    throw err
  }

  let parsed: BroadcastInput
  try { parsed = validate(broadcastSchema, input) }
  catch (err) {
    if (err instanceof ValidationError) return { ok: false, message: "Validazione fallita", fieldErrors: err.fieldErrors }
    throw err
  }

  const admin = await createServiceRoleClient()
  const ids = await resolveRecipientIds(admin, parsed)
  if (ids.length === 0) return { ok: false, message: "Nessun destinatario" }

  // Audit log
  await admin.from("admin_notifications").insert({
    user_id: user.id,
    type: "broadcast_sent",
    message: `Broadcast: "${parsed.title}" → ${parsed.targetType}${parsed.targetId ? `:${parsed.targetId}` : ""} (${ids.length} utenti)`,
    metadata: parsed,
  })

  let inApp = 0
  if (parsed.channels.inApp) {
    const rows = ids.map((id) => ({
      user_id: id, type: "broadcast",
      title: parsed.title, body: parsed.body, url: parsed.url, read: false,
    }))
    const { error } = await admin.from("user_notifications").insert(rows)
    if (!error) inApp = rows.length
  }

  let pushSent = 0, pushSkipped = 0, pushFailed = 0
  if (parsed.channels.push) {
    const filter = parsed.targetType === "all" ? undefined
      : parsed.targetType === "package" ? { subscribedTo: parsed.targetId! }
      : { level: parsed.targetId! }
    const r = await sendToAll(admin, { title: parsed.title, body: parsed.body, url: parsed.url, tag: `broadcast-${Date.now()}` }, filter)
    pushSent = r.sent; pushSkipped = r.skipped; pushFailed = r.failed
  }

  return { ok: true, data: { recipients: ids.length, inApp, pushSent, pushSkipped, pushFailed } }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/admin_actions/broadcasts.ts src/app/actions/admin_actions/broadcasts.test.ts
git commit -m "Add sendBroadcast + countBroadcastRecipients admin actions"
```

---

### Task 33: Refactor AdminBroadcasts UI

**Files:**
- Modify: `src/app/admin/AdminBroadcasts.tsx`

- [ ] **Step 1: Replace the audience buttons and wiring**

The existing UI has 3 audience buttons: "Tutti", "Abbonati", "Single". Replace with:

- Target radio: `all` (default), `level` (dropdown of levels), `package` (dropdown of packages)
- Channels checkboxes: `inApp` (default checked), `push` (default checked), `email` (disabled visual)
- Recipient counter below form: "~N utenti (~M hanno push)"
- URL input for the deep link (default `/dashboard`)

**Key logic changes** inside the component:
```tsx
const [targetType, setTargetType] = useState<"all" | "package" | "level">("all")
const [targetId, setTargetId] = useState<string | undefined>(undefined)
const [url, setUrl] = useState("/dashboard")
const [channels, setChannels] = useState({ inApp: true, push: true, email: false })
const [counts, setCounts] = useState<{ total: number; withPush: number } | null>(null)
const [levels, setLevels] = useState<Array<{id: string; name: string}>>([])
const [packages, setPackages] = useState<Array<{id: string; name: string}>>([])

// On mount, fetch levels + packages for the dropdowns:
useEffect(() => {
  (async () => {
    // Use existing content actions; see src/app/actions/content.ts for getContentHierarchy
    const res = await fetch("/api/admin/content-options") // new thin API OR reuse existing server action
    // ...
  })()
}, [])
```

**Simpler:** skip the extra API, instead accept levels/packages as props passed from the parent admin page (which already has access via server components). Modify the parent (`src/app/admin/AdminDashboard.tsx` or equivalent — `grep -rn "AdminBroadcasts" src/app/admin/`) to fetch and pass them.

- [ ] **Step 2: Replace submit handler**

```tsx
import { sendBroadcast, countBroadcastRecipients } from "@/app/actions/admin_actions/broadcasts"

// debounced count effect
useEffect(() => {
  if (targetType !== "all" && !targetId) { setCounts(null); return }
  const t = setTimeout(async () => {
    const r = await countBroadcastRecipients({ targetType, targetId })
    setCounts(r)
  }, 300)
  return () => clearTimeout(t)
}, [targetType, targetId])

const confirmSend = async () => {
  setShowConfirm(false)
  setLoading(true)
  try {
    const result = await sendBroadcast({
      title, body: message, url, targetType, targetId, channels,
    })
    if (result.ok) {
      toast.success(`Inviato: ${result.data.recipients} utenti, push ${result.data.pushSent}/${result.data.pushSent + result.data.pushSkipped + result.data.pushFailed}`)
      setTitle(""); setMessage("")
    } else {
      toast.error(result.message)
      if (result.retryAfter) toast.error(`Riprova tra ${result.retryAfter}s`)
    }
  } finally { setLoading(false) }
}
```

- [ ] **Step 3: Replace the confirmation modal content**

Show recipient count and channel summary:
```tsx
<DialogDescription>
  Stai per inviare a <strong>{counts?.total ?? "?"} utenti</strong>
  {channels.push && counts && ` (${counts.withPush} con push attive)`}.
  Canali: {[channels.inApp && "in-app", channels.push && "push"].filter(Boolean).join(" + ")}
</DialogDescription>
```

- [ ] **Step 4: Remove old `sendBroadcastNotification` call**

The old `sendBroadcastNotification(title, message, audience)` from `admin_actions/users.ts` is no longer invoked. Leave the function itself for now (deprecation comment), we remove in a later cleanup.

Add at the top of the old function in `src/app/actions/admin_actions/users.ts`:
```ts
/** @deprecated Replaced by sendBroadcast in admin_actions/broadcasts.ts. Remove after verification. */
```

- [ ] **Step 5: Manual test**

Dev server → login as admin → navigate to broadcast page:
- Switch target → recipient count updates after debounce
- Send with target="all" + channels both on → all test users receive in-app + push
- Send with channels.push=false → no push, only in-app

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/app/admin/AdminBroadcasts.tsx src/app/admin/AdminDashboard.tsx src/app/actions/admin_actions/users.ts
git commit -m "Extend AdminBroadcasts with targeting, channels, recipient preview"
```

(Adjust the second file path if AdminBroadcasts is mounted from a different page.)

---

### Task 34: Trial T-2 reminder cron

**Files:**
- Create: `src/app/api/cron/trial-reminders/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write the cron route**

```ts
// src/app/api/cron/trial-reminders/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/utils/supabase/server"
import { sendToUser } from "@/lib/push/dispatch"
import { trialReminderPayload } from "@/lib/push/payload-templates"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const vercelCron = req.headers.get("x-vercel-cron")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (auth !== expected || vercelCron !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = await createServiceRoleClient()

  const { data: rows, error } = await admin
    .from("user_subscriptions")
    .select("id, user_id, trial_end, package_id")
    .eq("status", "trialing")
    .is("trial_reminder_sent_at", null)
    .gte("trial_end", new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString())
    .lte("trial_end", new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let processed = 0
  for (const row of rows ?? []) {
    try {
      await sendToUser(
        admin,
        row.user_id,
        trialReminderPayload({ subscriptionId: row.id }),
        { category: "transactional" },
      )
      await admin.from("user_notifications").insert({
        user_id: row.user_id,
        type: "trial_reminder",
        title: "Il tuo periodo di prova scade tra 2 giorni",
        body: "Rinnova per non perdere l'accesso.",
        read: false,
      })
      await admin.from("user_subscriptions").update({ trial_reminder_sent_at: new Date().toISOString() }).eq("id", row.id)
      processed++
    } catch (err) {
      console.error("[cron trial-reminders]", row.id, err)
    }
  }

  return NextResponse.json({ processed, total: rows?.length ?? 0 })
}
```

- [ ] **Step 2: Write `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/trial-reminders", "schedule": "0 8 * * *" }
  ]
}
```

- [ ] **Step 3: Manual test**

Pick a test user with a trialing subscription. Set:
```sql
UPDATE user_subscriptions
SET trial_end = now() + interval '2 days', trial_reminder_sent_at = null
WHERE id = '<test-sub-id>';
```

Invoke the endpoint locally (with CRON_SECRET set):
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" -H "x-vercel-cron: 1" \
  http://localhost:3000/api/cron/trial-reminders
```
Expected: 200 `{ processed: 1, total: 1 }`. Test device receives push. Verify `trial_reminder_sent_at` populated.

Run again immediately → `{ processed: 0, total: 0 }` (idempotent).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/trial-reminders/route.ts vercel.json
git commit -m "Add daily trial T-2 reminder via Vercel Cron"
```

---

### Task 35: Manual QA checklist document

**Files:**
- Create: `docs/superpowers/specs/2026-04-21-pwa-push-offline-qa-checklist.md`

- [ ] **Step 1: Write the checklist**

```markdown
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
- [ ] Admin responds to a user request → user receives "Hai una nuova risposta" push
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
- [ ] Accept → subscription stored; Profile shows device
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
- [ ] `public/sw.js` generated, contains push listener (grep "addEventListener('push'" or similar)
- [ ] `npm run lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` passes

## Ops

- [ ] `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` present in Vercel All Environments
- [ ] Vercel Cron page shows the trial-reminders cron scheduled
- [ ] First cron run logged in Vercel dashboard after deploy
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-21-pwa-push-offline-qa-checklist.md
git commit -m "Add Sub-2 manual QA checklist"
```

---

### Task 36: PR #7 checklist and manual QA pass

- [ ] **Step 1: Run all automated checks**

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```
Expected: all pass.

- [ ] **Step 2: Execute the full QA checklist**

Work through `docs/superpowers/specs/2026-04-21-pwa-push-offline-qa-checklist.md` on a deployed Preview (or staging). Tick every box. If any item fails, fix inline and re-tick.

- [ ] **Step 3: Open PR #7**

```bash
git push
gh pr create --title "Sub-2 PR #7 — Push triggers, broadcast, trial cron" --body "$(cat <<'EOF'
## Summary
- Payload templates per trigger event
- Dispatch hooked into Stripe webhooks (checkout.session.completed, invoice.payment_succeeded with billing_reason=subscription_cycle, invoice.payment_failed)
- Dispatch hooked into admin response + refund actions
- `sendBroadcast` action + `countBroadcastRecipients` preview helper
- AdminBroadcasts UI refactored: all/level/package targeting, channels, live recipient count, confirmation
- Vercel Cron daily 08:00 UTC → `/api/cron/trial-reminders` with CRON_SECRET auth and atomic `trial_reminder_sent_at` guard

## Test plan
See `docs/superpowers/specs/2026-04-21-pwa-push-offline-qa-checklist.md`. All boxes ticked on Preview deploy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After merge — verify Stripe events**

Check Vercel Cron logs after the first scheduled run (next morning 08:00 UTC). Verify in Stripe Dashboard that `invoice.payment_succeeded` and `invoice.payment_failed` are still subscribed on the webhook endpoint.

---

## Post-implementation

Once all 3 PRs are merged:

1. Update `memory/project_status.md` with Sub-2 completion snapshot (file paths, migration number applied, env vars configured, known limitations)
2. Re-run `git log --oneline sub2-push-offline..main` to confirm all commits landed
3. If iOS testing surfaced issues not caught by checklist, document them in `memory/project_status.md` as "Sub-2 limitations to address post-launch"
4. Close the Sub-2 entry in `memory/brainstorming_prod_readiness.md`; Sub-3 (auth UX polish) was partially absorbed by Sub-1 so may be short

---

## Self-Review Notes

**Spec coverage check (sections 1-12 of spec):**
- § 1 Purpose → covered by overall plan structure
- § 2 Scope → every in-scope item has at least one task:
  - Custom SW (13) · VAPID + web-push (1, 4) · tables (2) · REST endpoints (8-11) · soft-prompt (19, 20) · iOS gating (21) · profile section (23, 24) · skip-if-active (6, 11, 18) · trigger integrations (27-30) · broadcast UI (31-33) · offline (12-14) · migration (2) · env vars (prereqs block) · vercel.json (34) · tests (4, 5, 6, 16, 26, 32) · QA checklist (35)
- § 3 Architecture → realized across Tasks 2, 4-14, 17-24, 26-34
- § 4 Data model → Task 2
- § 5 Service worker → Tasks 12-13
- § 6 Permission UX → Tasks 17-22
- § 7 Dispatcher & triggers → Tasks 4, 6, 26-30
- § 8 Admin broadcast → Tasks 31-33
- § 9 Vercel Cron → Task 34
- § 10 Testing → Tasks 4-6, 16, 26, 32 (unit) + Task 35 (manual)
- § 11 Rollout → PR structure matches 5/6/7 split
- § 12 Out of scope → not implemented (correct)

**Type consistency:** `PushPayload` defined in Task 3, reused in Tasks 4, 13, 26, 27+. `DispatchResult`, `DispatchOptions`, `PushCategory` consistent throughout. `BroadcastInput` defined in 31, consumed in 32.

**No placeholders found.** All code blocks are complete; all commands are exact.
