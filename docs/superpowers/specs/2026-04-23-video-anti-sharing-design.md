# Sub-4 item 4 — Anti-account-sharing via single concurrent playback

**Date:** 2026-04-23
**Status:** Design approved, pending implementation plan
**Part of:** Sub-4 (Video experience optimization). This spec covers **only item 4** of the Sub-4 backlog.

## 1. Purpose

Prevent account sharing by enforcing that only **one device at a time** can play video content from a single Rita account. Multi-device navigation (dashboard, profile, billing) stays unrestricted — the restriction kicks in specifically at video playback, which is the content with the highest sharing-value.

**Business rationale:** a single Rita subscription lets users access all their purchased workout videos across devices. Without this feature, N people could trivially split the cost of one subscription — each watching different workouts concurrently. This feature makes simultaneous consumption impossible, creating social friction that deters sharing without disrupting legit multi-device usage.

## 2. Scope

### In

- Per-user Redis lock keyed on `playing:<userId>` with 90s TTL, refreshed by 30s heartbeat while video is actively playing
- Three API endpoints: claim, heartbeat, release
- Client hook `useVideoPlaybackLock(videoId, adminBypass)` that wires into existing `VideoPlayer.tsx` postMessage events
- Blocking dialog `PlaybackBlockedDialog.tsx` with "Continua qui" force-takeover button
- Admin bypass: users in `admins` table skip the lock entirely (preview / QA / support use cases)
- Device fingerprint: UUID stored in `localStorage['video_device_id']` + UA label from existing `src/lib/user-agent.ts` parser
- Rate limit: 10 claim calls per 60s per user (deters ping-pong takeover spam)

### Out

- Admin UI "currently watching" monitoring dashboard
- Usage metrics (how many blocks fired, DB counters)
- Multi-stream plan tier (e.g., Premium with 2 concurrent streams)
- Advanced browser fingerprinting (canvas, audio, plugins) — privacy + bundle tradeoff not worth it
- Refactor of `VideoPlayer.tsx` internals beyond what integration strictly requires
- Cross-tab BroadcastChannel coordination (tabs on same device just re-claim; not worth extra complexity)

## 3. Architecture

### 3.1 New files

```
src/
  lib/
    video-playback-lock.ts           # getDeviceInfo() + fetch helpers
    video-playback-lock.test.ts      # unit tests
  hooks/
    useVideoPlaybackLock.ts          # client hook: claim + heartbeat + release lifecycle
    useVideoPlaybackLock.test.tsx    # unit tests (mocked fetch + fake timers)
  components/
    video/
      PlaybackBlockedDialog.tsx      # blocking modal with device label + "Continua qui"
  app/api/video/
    claim-playback/
      route.ts                       # POST — claim or force takeover
      route.test.ts
    heartbeat-playback/
      route.ts                       # POST — refresh TTL + check takeover
      route.test.ts
    release-playback/
      route.ts                       # POST — explicit release on ended / unmount
      route.test.ts
```

### 3.2 Modified files

```
src/components/video/VideoPlayer.tsx    # wire useVideoPlaybackLock into postMessage play/pause/ended + mount PlaybackBlockedDialog
src/lib/security/ratelimit.ts           # + videoPlaybackClaimLimiter (10/min per user.id)
```

### 3.3 No changes to

- `package.json` — no new deps; reuse `@upstash/redis` from Sub-1
- Database / SQL — zero migrations
- Supabase Dashboard config
- `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`

### 3.4 Contracts

**Util `video-playback-lock.ts`:**

```ts
export interface DeviceInfo {
  id: string          // UUID; localStorage key 'video_device_id'
  label: string       // "Chrome Windows" via parseUserAgent(navigator.userAgent)
}

export function getDeviceInfo(): DeviceInfo
```

**Hook `useVideoPlaybackLock(videoId: string, adminBypass: boolean)`:**

```ts
interface LockState {
  state: 'idle' | 'owned' | 'blocked' | 'taken-over' | 'error'
  blockedBy: { deviceLabel: string } | null
  retryAfterSec: number | null   // for rate-limited claims
}

interface LockActions {
  onPlay: () => Promise<void>
  onPause: () => void
  onEnded: () => void
  takeover: () => Promise<void>
  dismissError: () => void
}

export function useVideoPlaybackLock(
  videoId: string,
  adminBypass: boolean,
): LockState & LockActions
```

**API endpoints (all auth-protected via `createClient` + `getUser()`):**

| Endpoint | Body | 200 | 401 | 409 | 429 |
|---|---|---|---|---|---|
| `POST /api/video/claim-playback` | `{ videoId, deviceId, deviceLabel, force?: boolean }` | `{ ok: true }` | unauth | `{ ok: false, blockedBy: { deviceLabel } }` | rate limited |
| `POST /api/video/heartbeat-playback` | `{ videoId, deviceId }` | `{ ok: true }` | unauth | `{ ok: false, takenOver: true, byDevice: { deviceLabel } \| null }` | — |
| `POST /api/video/release-playback` | `{ videoId, deviceId }` | `{ ok: true }` | unauth | — | — |

### 3.5 Redis key

- Key: `playing:<userId>`
- Value: JSON-stringified `{ deviceId: string, deviceLabel: string, videoId: string, startedAt: number }`
- TTL: 90s (refreshed by heartbeat every 30s)

One key per user, not per video: account-sharing is per-user, and a single user can only watch one video at a time across devices (by design).

## 4. Data model

No changes. No new SQL tables. Lock state lives exclusively in Upstash Redis with TTL-based self-cleanup.

## 5. Feature behaviour

### 5.1 Claim (user presses play)

```
Client (useVideoPlaybackLock.onPlay):
  POST /api/video/claim-playback { videoId, deviceId, deviceLabel, force: false }

Server:
  1. Verify auth → 401 if not
  2. Check admins table → if admin, skip Redis, return { ok: true }
  3. Rate limit check (videoPlaybackClaimLimiter, 10/min per user.id)
  4. GET `playing:<userId>`
     - absent → SET with TTL 90s, return { ok: true }
     - same deviceId + same videoId → refresh TTL, return { ok: true }
     - same deviceId + different videoId → overwrite, return { ok: true }  (user changed video on same device)
     - different deviceId → return 409 { ok: false, blockedBy: { deviceLabel: <existing> } }

Client reaction:
  - ok → state='owned', start 30s heartbeat loop
  - 409 blockedBy → state='blocked', render PlaybackBlockedDialog with byDevice label
  - 429 → state='error' with retryAfterSec, toast "Riprova fra Xs"
```

### 5.2 Heartbeat (every 30s while state='owned')

```
Client:
  POST /api/video/heartbeat-playback { videoId, deviceId }

Server:
  1. Auth + admin check (same as claim)
  2. GET `playing:<userId>`
     - absent OR different deviceId OR different videoId → 409 { takenOver: true, byDevice }
     - match → refresh TTL 90s, return { ok: true }

Client reaction:
  - ok → loop continues
  - 409 takenOver → state='taken-over', stop heartbeat, pause video via Bunny postMessage,
                    render PlaybackBlockedDialog with byDevice label
  - error/network → retry next cycle; after 3 consecutive fails, pause + toast "Connessione persa"
```

### 5.3 Pause / ended / tab close

- **Pause**: stop heartbeat interval only. No server call. Lock TTL decays ~90s. If user resumes within window → next claim re-claims same lock (no UX interruption).
- **Ended**: fire-and-forget `POST /api/video/release-playback` (server deletes key if caller matches). State → 'idle'.
- **Tab close / navigation**: React cleanup stops heartbeat. Best-effort `navigator.sendBeacon('/api/video/release-playback', ...)` attempts release. If fails, TTL auto-cleans.

### 5.4 Force takeover (dialog "Continua qui")

```
Client on device B (blocked):
  takeover() → POST /api/video/claim-playback { ..., force: true }

Server:
  Same as claim, but ignore existing key and overwrite unconditionally (still rate-limited).
  Return { ok: true }.

Client device B:
  state='owned', dismiss dialog, user can press play.

Meanwhile device A (previous owner):
  Next heartbeat within 30s returns 409 { takenOver, byDevice: B-label }.
  state='taken-over', auto-pause video, render dialog with byDevice=B-label + "Riprendi qui" button.
  If user clicks "Riprendi qui" → takeover() from A → ping-pong possible.
  The ping-pong friction is the deterrent: account-sharers quickly find it unusable.
```

### 5.5 Admin bypass

Users in `admins` table skip all lock logic:
- Claim returns ok immediately without touching Redis
- Heartbeat returns ok immediately
- Release is no-op

Admin can watch on N devices concurrently without any lock interaction. Admin activity does NOT create `playing:<adminId>` keys, so regular-user locks are never affected by admin presence.

### 5.6 Rate limiting

New limiter `videoPlaybackClaimLimiter` in `src/lib/security/ratelimit.ts`:
- Key prefix: `rl:video:claim`
- Limit: 10 requests / 60s
- Scoped by `user.id` (not IP)

Applied on `claim-playback` only. Heartbeat is naturally capped at 2/min per user; release is fire-and-forget, rare, no need. 10/min = user can takeover every 6s, which accommodates legit retry without enabling rapid ping-pong spam.

## 6. Error handling

Full error matrix in brainstorming transcript § 3 (edge cases). Key decisions:

- **Upstash down on claim** → fail-closed (video doesn't start, toast retry). Better to deny than allow bypass.
- **Upstash down on heartbeat** → tolerate 3 consecutive failures (90s), then pause + toast "Connessione persa".
- **Upstash down on release** → fire-and-forget, silent catch. TTL handles cleanup.
- **localStorage blocked (Safari private)** → in-memory UUID for session. Works for session, resets on refresh. Acceptable degradation.
- **Clock skew** → only server-side TTL/timestamps used. Client doesn't validate time.
- **Race between 2 devices claiming concurrently** → Redis SET is atomic; first wins, second reads and returns 409.

## 7. Testing strategy

### Unit (vitest)

- `video-playback-lock.test.ts` — 4 tests (device id generation, localStorage fallback, label parsing)
- `useVideoPlaybackLock.test.tsx` — 7 tests (state transitions, admin bypass, heartbeat timing via fake timers, cleanup)
- `claim-playback/route.test.ts` — 8 tests (auth, admin bypass, acquire, re-claim, video switch, blocked, force, rate limit)
- `heartbeat-playback/route.test.ts` — 6 tests (auth, admin, refresh, taken-over variants)
- `release-playback/route.test.ts` — 4 tests (delete, safety check, no-op absent, admin no-op)

**Total: ~29 new unit tests** → ~98 total after merge.

### Not unit-tested

- `PlaybackBlockedDialog.tsx` — pure presentation. Screenshot verification in manual QA.
- Integration of hook into `VideoPlayer.tsx` — postMessage from Bunny iframe is not realistically mockable. Covered by manual QA.

### Manual QA

Checklist at `docs/superpowers/specs/2026-04-23-video-anti-sharing-qa-checklist.md` covering: happy path single device, multi-device scenarios (block, takeover, ping-pong), admin exemption, edge cases (private mode, network loss, rate limit), security (auth gates).

### Build / lint / typecheck gates

- `npm run lint` clean (only pre-existing TAB_ORDER warnings)
- `npx tsc --noEmit` clean
- `npx vitest run` ~98 passing
- `npm run build` succeeds

## 8. Rollout

Single PR #10 on main. No ops prerequisites. No config changes outside code.

Post-merge Vercel auto-deploy (~2 min). Verify by:
- Desktop + Android Chrome side-by-side on same account → takeover flow works
- Upstash dashboard shows `playing:<uid>` keys appearing/disappearing as expected
- Admin account on 2 devices → no locks created, both watch concurrently

### Rollback

`git revert <merge-commit>` → push → Vercel redeploy 2 min. Redis keys self-clean via TTL in ≤90s. Zero manual cleanup.

## 9. References

- Brainstorming transcript (this session, 2026-04-23)
- Related: Sub-2 `src/lib/push/dispatch.ts` (skip-if-active pattern with `active:<uid>`)
- Related: Sub-2 `src/hooks/useHeartbeat.ts` (30s polling + visibility-aware)
- Related: Sub-3 `src/lib/security/ttl-idempotency.ts` (Redis SET with TTL helper pattern)
- Parent sub-project backlog: `memory/sub4_backlog.md` item 4
- Existing: `src/components/video/VideoPlayer.tsx` (postMessage integration target)
- Existing: `src/lib/user-agent.ts` (label parser, reused from Sub-2)
