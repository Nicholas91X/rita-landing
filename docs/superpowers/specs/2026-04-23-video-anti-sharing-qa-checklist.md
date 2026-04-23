# Sub-4 item 4 — Anti-sharing Manual QA Checklist

**Date:** 2026-04-23
Run this checklist before merging PR #10.

## Happy path (single device)

- [ ] User A opens a video on Desktop → play → video plays, no dialog
- [ ] User A pauses → video pauses, no dialog
- [ ] User A resumes within 10s → video resumes, no dialog, no new claim
- [ ] User A pauses > 90s, then resumes → video plays again (fresh acquire), no dialog
- [ ] User A watches video to end → on video ended, Upstash key `playing:<uid>` gone (check Upstash dashboard)

## Multi-device scenarios

- [ ] User A Desktop plays video X. User A on Android same account → open video X → PlaybackBlockedDialog shows "in riproduzione su Chrome Windows" + "Continua qui" button
- [ ] Click "Continua qui" on Android → Android plays, dialog dismisses
- [ ] Within 30s, Desktop shows the same blocked dialog "in riproduzione su Chrome Android" + video pauses automatically. Toast "Video messo in pausa..." visible
- [ ] Click "Continua qui" on Desktop → ping-pong resumes (expected deterrent)
- [ ] Different video scenario: Desktop plays X, Android opens Y same account → Android sees block dialog (lock is per-user, not per-video)

## Admin exemption

- [ ] Login as admin user on Desktop, open video → plays immediately
- [ ] Same admin opens same video on Android → ALSO plays immediately, no dialog on either side
- [ ] Check Upstash dashboard: no `playing:<admin-uid>` key was created

## Edge cases

- [ ] Clear localStorage on Desktop mid-playback, play a new video → considered a "new device" → Android (if watching) sees takeover dialog next heartbeat
- [ ] Safari iOS private mode: video plays normally; lock uses in-memory fallback UUID; lock resets on page refresh (acceptable)
- [ ] Network offline for 60s mid-playback: heartbeat retries silently; no UI disruption until 3 consecutive fails (~90s), then pause + toast
- [ ] Close tab mid-playback without clicking pause: next device trying to claim sees the lock until TTL expires (~90s), then acquires fresh

## Rate limit

- [ ] Fire 11 consecutive `takeover()` calls in <60s → 11th gets 429 → toast "Riprova fra Xs"
- [ ] Wait 60s → limiter resets → takeover works again

## Security

- [ ] Unauthenticated `curl -X POST http://localhost:3000/api/video/claim-playback -d '{}'` → 401
- [ ] Authenticated call with invalid body (missing videoId) → 400 with fieldErrors
- [ ] Upstash dashboard: verify `playing:<uid>` TTL is 90s (not less, not more)

## Regression — existing VideoPlayer features

- [ ] Video progress still saves every 10s while playing (check `video_watch_progress` row updates)
- [ ] Video completion still fires badge logic
- [ ] Status dot indicator (connected / saving / error) still renders correctly

## Build / test gates

- [ ] `npm run lint` clean (only pre-existing TAB_ORDER warnings)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` — ~96 tests passing
- [ ] `npm run build` succeeds
