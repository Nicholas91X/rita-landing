# Lead Magnet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Rituale della Leggerezza" lead-magnet end-to-end: TikTok→`/lezioni-gratis`→magic-link→limited dashboard with 3 free videos, 14-day expiry, upgrade-to-standard flow, automated reminders, admin KPI view.

**Architecture:** Single Next.js app (no standalone). New `account_type` enum on `profiles`, token_hash auth flow (replaces fragile PKCE for email-driven auth), separate `<LeadDashboardClient>` sharing a new `<DashboardShell>` with the existing standard variant. Lead access modeled as `one_time_purchases(status='lead')` row, time-gated by `profiles.lead_expires_at`. Magic link sent via `auth.admin.generateLink` + Resend custom template.

**Tech Stack:** Next.js 15 App Router, React 19, TS strict, Supabase (Postgres + Auth), Bunny Stream, Resend, Upstash Redis, Tailwind v4, Vitest + React Testing Library, Sonner, shadcn/ui (Radix Dialog), canvas-confetti.

**Spec:** `docs/superpowers/specs/2026-05-28-lead-magnet-design.md`

---

## File Structure Overview

### New files
- `supabase/20260528_10_lead_magnet.sql` — migration
- `src/app/actions/lead.ts` — lead server actions (request magic link, upgrade)
- `src/app/actions/lead.schemas.ts` — Zod schemas
- `src/app/actions/lead.test.ts` — unit tests
- `src/app/actions/admin_actions/leads.ts` — admin actions
- `src/app/actions/admin_actions/leads.test.ts` — unit tests
- `src/app/lezioni-gratis/page.tsx` — landing page route
- `src/app/lezioni-gratis/LeadHero.tsx`
- `src/app/lezioni-gratis/LeadStepsPreview.tsx`
- `src/app/lezioni-gratis/LeadCaptureForm.tsx`
- `src/app/lezioni-gratis/LeadTestimonials.tsx`
- `src/app/lezioni-gratis/LeadLandingFooter.tsx`
- `src/app/dashboard/DashboardShell.tsx` — extracted shared layout
- `src/app/dashboard/LeadDashboardClient.tsx`
- `src/app/dashboard/StandardDashboardClient.tsx` — renamed from DashboardClient
- `src/app/dashboard/lead/LeadCountdownBanner.tsx`
- `src/app/dashboard/lead/LeadProfileUpsellCard.tsx`
- `src/app/dashboard/lead/UpgradeModal.tsx`
- `src/app/dashboard/lead/LeadCompletionModal.tsx`
- `src/app/admin/AdminLeads.tsx`
- `src/app/api/cron/lead-reminders/route.ts`
- `src/components/sections/LeadMagnetRibbon.tsx`
- `public/lead-magnet/hero.jpg`, `public/lead-magnet/form-bg.jpg` (assets)

### Modified files
- `src/app/auth/callback/route.ts` — add token_hash branch + lead provisioning
- `src/app/actions/user.ts` — restore `emailRedirectTo`, remove signUp welcome workaround (callback handles via token_hash now)
- `src/app/actions/content.ts` — filter `hidden_from_discover`, gate lead access by expiry
- `src/app/actions/user.ts:847` — `getPassportStamps` filter
- `src/app/dashboard/DashboardClient.tsx` — split (renamed to Standard variant; Shell extracted)
- `src/app/dashboard/page.tsx` — branch on `account_type`
- `src/app/page.tsx` — mount `<LeadMagnetRibbon>`
- `src/lib/email.ts` — add `sendLeadMagicLinkEmail`, `sendLeadReminderT10Email`, `sendLeadReminderT20Email`
- `src/lib/security/ratelimit.ts` — add `leadFormLimiter`
- `src/app/admin/DashboardClient.tsx` — register Leads tab
- `vercel.json` — schedule cron `/api/cron/lead-reminders`
- `supabase/triggers.sql` — seed alignment
- Privacy page (`src/app/privacy/page.tsx` or similar) — section on lead funnel

### Dependency graph between workstreams

```
A1 (migration) ─┬─→ B (forms, after A1)
                ├─→ C (dashboard, after A1+A3)
                └─→ D (admin/cron, after A1)

A3 (callback rewrite) ─→ A7 (provisioning in callback) ─→ B testable end-to-end
A3 also unblocks the in-flight auth task (terms-missing path stays valid)
```

A1, A2, A3 are sequential within Workstream A. B/C/D run in parallel after A1 (B and D fully parallel; C touches dashboard files concurrently editable per-task).

---

# Workstream A: DB & Auth Core

---

### Task A1: Create migration `20260528_10_lead_magnet.sql`

**Files:**
- Create: `supabase/20260528_10_lead_magnet.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260528_10_lead_magnet.sql
-- Adds the lead-magnet schema:
--   * profiles.account_type enum + lead-related timestamps
--   * packages.hidden_from_discover flag (used by Discover/passport filters)
--   * Updated handle_new_user that reads account_type, lead_source,
--     marketing_consent_at from raw_user_meta_data (forwarded by the
--     requestLeadMagicLink server action via auth.admin.generateLink).
--   * Indices for cron and admin KPI lookups.

BEGIN;

-- 1. account_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('lead', 'standard');
    END IF;
END $$;

-- 2. New columns on profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS lead_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS upgraded_from_lead_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_source text,
    ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_reminder_t10_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_reminder_t20_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS completion_modal_shown_at timestamptz;

-- 3. Flag su packages per nascondere "Lezioni Gratis" dalla Discover
ALTER TABLE public.packages
    ADD COLUMN IF NOT EXISTS hidden_from_discover boolean NOT NULL DEFAULT false;

-- 4. Replace handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (
        id, email, full_name, avatar_url,
        terms_accepted_at, account_type, lead_source, marketing_consent_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz,
        COALESCE((NEW.raw_user_meta_data->>'account_type')::account_type, 'standard'),
        NEW.raw_user_meta_data->>'lead_source',
        (NEW.raw_user_meta_data->>'marketing_consent_at')::timestamptz
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Unique constraint on one_time_purchases for idempotent lead grants
-- (only adds it if missing — older deployments may not have it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'one_time_purchases_user_package_unique'
    ) THEN
        ALTER TABLE public.one_time_purchases
            ADD CONSTRAINT one_time_purchases_user_package_unique
            UNIQUE (user_id, package_id);
    END IF;
END $$;

-- 6. Indices
CREATE INDEX IF NOT EXISTS idx_profiles_lead_expires_at
    ON public.profiles(lead_expires_at)
    WHERE account_type = 'lead';

CREATE INDEX IF NOT EXISTS idx_profiles_upgraded_from_lead_at
    ON public.profiles(upgraded_from_lead_at)
    WHERE upgraded_from_lead_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_account_type
    ON public.profiles(account_type);

COMMIT;
```

- [ ] **Step 2: Apply migration in Supabase Studio (SQL editor)**

Copy the file content into Supabase SQL Editor, run. Verify success.

- [ ] **Step 3: Verify schema**

In SQL editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name IN ('account_type','lead_expires_at','upgraded_from_lead_at','lead_source','marketing_consent_at','lead_reminder_t10_sent_at','lead_reminder_t20_sent_at','completion_modal_shown_at');
-- Expect 8 rows.

SELECT typname FROM pg_type WHERE typname='account_type';
-- Expect 1 row.

SELECT conname FROM pg_constraint WHERE conname='one_time_purchases_user_package_unique';
-- Expect 1 row.

SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_profiles_lead%' OR indexname='idx_profiles_account_type';
-- Expect 3 rows.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/20260528_10_lead_magnet.sql
git commit -m "feat(lead-magnet): add account_type enum + lead-related schema"
```

---

### Task A2: Update `supabase/triggers.sql` seed alignment

**Files:**
- Modify: `supabase/triggers.sql`

- [ ] **Step 1: Replace the file content with the aligned version**

```sql
-- Assicura che la tabella profiles esista
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  terms_accepted_at timestamptz,
  welcome_email_sent_at timestamptz,
  account_type text not null default 'standard',
  lead_expires_at timestamptz,
  upgraded_from_lead_at timestamptz,
  lead_source text,
  marketing_consent_at timestamptz,
  lead_reminder_t10_sent_at timestamptz,
  lead_reminder_t20_sent_at timestamptz,
  completion_modal_shown_at timestamptz,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

-- RLS
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- handle_new_user con coalesce per Google + lead metadata
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, email, full_name, avatar_url,
    terms_accepted_at, account_type, lead_source, marketing_consent_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz,
    coalesce(new.raw_user_meta_data->>'account_type', 'standard'),
    new.raw_user_meta_data->>'lead_source',
    (new.raw_user_meta_data->>'marketing_consent_at')::timestamptz
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Email sync trigger
create or replace function public.handle_user_email_change()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_change();
```

Note: this is the bootstrap seed, used when initializing from scratch. The migration `20260528_10` is the source of truth for existing deployments.

- [ ] **Step 2: Commit**

```bash
git add supabase/triggers.sql
git commit -m "feat(lead-magnet): align triggers.sql seed with migration 10"
```

---

### Task A3: Rewrite `/auth/callback` for `token_hash` flow + lead provisioning

**Files:**
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/app/actions/user.ts` (remove `emailRedirectTo` in `signUpAction`, no longer needed — Supabase email template now sends to callback with `token_hash`)

- [ ] **Step 1: Write failing test for token_hash branch**

Create `src/app/auth/callback/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyOtp = vi.fn()
const mockExchangeCode = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCode,
      getUser: mockGetUser,
    },
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single: vi.fn().mockResolvedValue({ data: null }),
      upsert: vi.fn().mockResolvedValue({ data: null }),
      insert: vi.fn().mockResolvedValue({ data: null }),
    })),
    auth: { admin: { deleteUser: vi.fn() } },
  })),
}))

vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn() }))

import { GET } from './route'

describe('/auth/callback token_hash flow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('uses verifyOtp when token_hash is present', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({
      data: { user: {
        id: 'u1', email: 't@e.com', created_at: '2026-05-28T10:00:00Z',
        last_sign_in_at: '2026-05-28T10:00:00Z', user_metadata: {},
      }},
    })

    const req = new Request('http://localhost/auth/callback?token_hash=abc&type=magiclink')
    const res = await GET(req)

    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'abc' })
    expect(mockExchangeCode).not.toHaveBeenCalled()
    expect(res.status).toBe(307)
  })

  it('falls back to exchangeCodeForSession for OAuth code', async () => {
    mockExchangeCode.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({
      data: { user: {
        id: 'u1', email: 't@e.com', created_at: '2026-05-28T10:00:00Z',
        last_sign_in_at: '2026-05-28T10:00:00Z', user_metadata: {},
      }},
    })

    const req = new Request('http://localhost/auth/callback?code=xyz&source=google&terms=1')
    const res = await GET(req)

    expect(mockExchangeCode).toHaveBeenCalledWith('xyz')
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/app/auth/callback/route.test.ts
```
Expected: FAIL — the route still calls `exchangeCodeForSession` unconditionally.

- [ ] **Step 3: Rewrite the route**

Replace the contents of `src/app/auth/callback/route.ts` with:

```ts
import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import type { SupabaseClient, User } from '@supabase/supabase-js'

function isFreshUser(user: User): boolean {
  if (!user.last_sign_in_at) return true
  return user.last_sign_in_at === user.created_at
}

async function claimWelcomeEmail(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[auth-callback] welcome-email claim failed', error.message)
    return false
  }
  return !!data
}

async function provisionLeadIfNeeded(admin: SupabaseClient, userId: string) {
  const leadPackageId = process.env.LEAD_MAGNET_PACKAGE_ID
  if (!leadPackageId) return

  const { data: profile } = await admin
    .from('profiles')
    .select('account_type, lead_expires_at')
    .eq('id', userId)
    .single()

  if (profile?.account_type !== 'lead' || profile.lead_expires_at) return

  // Idempotent: ignore conflict on existing row
  await admin.from('one_time_purchases').upsert({
    user_id: userId,
    package_id: leadPackageId,
    item_type: 'package',
    amount: 0,
    status: 'lead',
  }, { onConflict: 'user_id,package_id', ignoreDuplicates: true })

  await admin.from('profiles')
    .update({ lead_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString() })
    .eq('id', userId)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'
  const source = searchParams.get('source')
  const terms = searchParams.get('terms')

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_credentials`)
  }

  const supabase = await createClient({ preventVerifierDeletion: type === 'email_change' })

  // 1. Exchange code (OAuth) or verify token_hash (email-driven)
  let authError: { message: string } | null = null
  if (tokenHash && type) {
    const validTypes = ['signup', 'magiclink', 'email', 'recovery', 'invite', 'email_change'] as const
    type OtpType = typeof validTypes[number]
    if (!validTypes.includes(type as OtpType)) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=invalid_type`)
    }
    const result = await supabase.auth.verifyOtp({
      type: type as OtpType,
      token_hash: tokenHash,
    })
    authError = result.error
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    authError = result.error
  }

  if (authError) {
    console.error('[auth-callback] exchange failed:', authError.message)
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(authError.message)}`,
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_user`)
  }

  const buildRedirect = (path: string): string => {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    if (isLocalEnv) return `${origin}${path}`
    if (forwardedHost) return `https://${forwardedHost}${path}`
    return `${origin}${path}`
  }

  if (type === 'email_change') {
    return NextResponse.redirect(buildRedirect(next))
  }

  const fresh = isFreshUser(user)

  // Google OAuth fresh-user terms gate
  if (source === 'google' && fresh && terms !== '1') {
    try {
      const admin = await createServiceRoleClient()
      await admin.auth.admin.deleteUser(user.id)
    } catch (err) {
      console.error('[auth-callback] failed to delete unconsented user', err)
    }
    return NextResponse.redirect(`${origin}/login?error=terms-missing`)
  }

  const admin = await createServiceRoleClient()

  // Persist terms_accepted_at for Google fresh signups carrying terms=1
  if (source === 'google' && fresh && terms === '1') {
    await admin.from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('terms_accepted_at', null)
  }

  // Provision lead if this is the first magic-link login for a lead account
  if (type === 'magiclink' && fresh) {
    await provisionLeadIfNeeded(admin, user.id)
  }

  // Welcome email — single send per user
  if (fresh && user.email) {
    const claimed = await claimWelcomeEmail(admin, user.id)
    if (claimed) {
      try {
        const { data: profile } = await admin
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        const name =
          profile?.full_name
          || (user.user_metadata?.name as string | undefined)
          || (user.user_metadata?.full_name as string | undefined)
          || ''
        await sendWelcomeEmail(user.email, name)
      } catch (err) {
        console.error('[auth-callback] welcome email send failed', err)
      }
    }
  }

  return NextResponse.redirect(buildRedirect(next))
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/app/auth/callback/route.test.ts
```
Expected: PASS (both test cases).

- [ ] **Step 5: Run full test suite + lint + typecheck**

```bash
npm test
npx eslint src/app/auth/callback/route.ts
npx tsc --noEmit
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts
git commit -m "feat(auth): support token_hash flow + lead provisioning in callback"
```

---

### Task A4: Update Supabase email templates (manual config step)

**Files:** None (Supabase Dashboard)

- [ ] **Step 1: Update "Confirm signup" template**

In Supabase Dashboard → Authentication → Email Templates → "Confirm signup":
Replace the `<a href="{{ .ConfirmationURL }}">` line with:
```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">CONFERMA EMAIL</a>
```
Save.

- [ ] **Step 2: Update "Magic Link" template**

Even though we use Resend custom emails for the lead flow, set this for safety on direct `signInWithOtp` calls:
```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink">ACCEDI</a>
```
Save.

- [ ] **Step 3: Update "Change Email Address" template**

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change">CONFERMA NUOVA EMAIL</a>
```
Save.

- [ ] **Step 4: Verify by signing up a test email/password user end-to-end**

Through the running app: signup new email → check inbox → click link → land on dashboard with no PKCE error → welcome email received → row in `profiles` with `terms_accepted_at` and `welcome_email_sent_at` populated.

- [ ] **Step 5: No commit (Supabase Dashboard state)**

---

### Task A5: Add `LEAD_MAGNET_PACKAGE_ID` env var

**Files:** None (env vars)

- [ ] **Step 1: Create the "Lezioni Gratis" package via admin panel**

Once Workstream B/C are running, navigate to `/admin/packages`:
- Name: "Lezioni Gratis — Rituale della Leggerezza"
- Description: as per Rita's copy
- `payment_mode='payment'`, `price=0`, `badge_type='leggerezza'` (or as Rita defines)
- After save in DB, set `hidden_from_discover=true` via SQL:
  ```sql
  UPDATE packages SET hidden_from_discover=true WHERE id='<package-id>';
  ```
- Copy the `id` UUID.

- [ ] **Step 2: Add env var to Vercel + `.env.local`**

```bash
# .env.local
LEAD_MAGNET_PACKAGE_ID=<package-uuid>
```
And same on Vercel dashboard for Production + Preview.

- [ ] **Step 3: Restart dev server, verify the callback reads it**

In `requestLeadMagicLink` flow end-to-end test (post-Workstream B): magic link → callback → DB has `one_time_purchases(user_id=test, package_id=<env-var-id>, status='lead')` row.

- [ ] **Step 4: No commit (env state)**

---

# Workstream B: Landing & Form

---

### Task B1: Add `leadFormLimiter` to ratelimit utility

**Files:**
- Modify: `src/lib/security/ratelimit.ts`

- [ ] **Step 1: Write failing test**

In `src/lib/security/ratelimit.test.ts` (add to existing file):

```ts
import { describe, it, expect } from 'vitest'
import { leadFormLimiter } from './ratelimit'

describe('leadFormLimiter', () => {
  it('returns a limiter for email scope', () => {
    const l = leadFormLimiter('email')
    expect(l).toBeDefined()
    expect(typeof l.limit).toBe('function')
  })

  it('returns a limiter for ip scope', () => {
    const l = leadFormLimiter('ip')
    expect(l).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/lib/security/ratelimit.test.ts
```
Expected: FAIL — `leadFormLimiter` not exported.

- [ ] **Step 3: Add to `ratelimit.ts`**

Append to `src/lib/security/ratelimit.ts`:

```ts
export function leadFormLimiter(scope: 'email' | 'ip') {
  return new Ratelimit({
    redis,
    limiter: scope === 'email'
      ? Ratelimit.slidingWindow(1, '1 h')
      : Ratelimit.slidingWindow(5, '24 h'),
    prefix: `rl:lead:${scope}`,
  })
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/lib/security/ratelimit.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/ratelimit.ts src/lib/security/ratelimit.test.ts
git commit -m "feat(lead-magnet): add leadFormLimiter (email + IP scopes)"
```

---

### Task B2: Create lead schemas

**Files:**
- Create: `src/app/actions/lead.schemas.ts`

- [ ] **Step 1: Write the schema file**

```ts
import { z } from 'zod'
import { emailSchema, passwordSchema } from '@/lib/security/validation'

export const leadFormSchema = z.object({
  full_name: z.string().trim().min(2, 'Nome troppo corto').max(100),
  email: emailSchema,
  terms_accepted: z.literal('on', { message: 'Devi accettare i termini' }),
  marketing_consent: z.literal('on').optional(),
  lead_source: z.string().max(50).optional(),
})
export type LeadFormInput = z.infer<typeof leadFormSchema>

export const upgradeLeadSchema = z.object({
  password: passwordSchema,
})
export type UpgradeLeadInput = z.infer<typeof upgradeLeadSchema>
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/lead.schemas.ts
git commit -m "feat(lead-magnet): add Zod schemas for lead form and upgrade"
```

---

### Task B3: Add `sendLeadMagicLinkEmail` to email layer

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/email.test.ts` (if not exists) or extend it:

```ts
import { describe, it, expect, vi } from 'vitest'

const sendMock = vi.fn().mockResolvedValue({ id: 'msg-1' })
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}))

import { sendLeadMagicLinkEmail } from './email'

describe('sendLeadMagicLinkEmail', () => {
  it('sends a magic-link email mentioning the 14-day window', async () => {
    await sendLeadMagicLinkEmail('user@e.com', 'Mario', 'https://x/y?token_hash=abc&type=magiclink')

    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0]
    expect(args.to).toBe('user@e.com')
    expect(args.html).toContain('Mario')
    expect(args.html).toContain('14 giorni')
    expect(args.html).toContain('https://x/y?token_hash=abc&type=magiclink')
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/lib/email.test.ts
```

- [ ] **Step 3: Add the function**

Append to `src/lib/email.ts`:

```ts
export async function sendLeadMagicLinkEmail(to: string, name: string, magicUrl: string) {
  const html = emailLayout(`
    <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">Benvenuta su Rita Workout, ${name || 'cara'}!</h2>
    <p style="color:#555;font-size:15px;line-height:1.7;">
      Ecco i tuoi 3 video gratuiti del <strong>Rituale della Leggerezza</strong>.<br>
      Clicca il bottone qui sotto per accedere.
    </p>
    ${button('SBLOCCA ORA', magicUrl)}
    <p style="color:#555;font-size:15px;line-height:1.7;">
      Hai <strong>14 giorni</strong> per accedere a Lezioni Gratis. Dopo, basta completare la registrazione (imposterai una password) per conservare l'accesso e sbloccare il resto del percorso Fit&Smile.
    </p>
    <p style="color:#999;font-size:13px;margin-top:24px;">
      Se non hai richiesto tu il magic link, ignora questa email.
    </p>
  `)
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'I tuoi 3 video gratuiti sono pronti',
    html,
  })
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/lib/email.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(lead-magnet): add sendLeadMagicLinkEmail Resend template"
```

---

### Task B4: Create `requestLeadMagicLink` server action

**Files:**
- Create: `src/app/actions/lead.ts`
- Create: `src/app/actions/lead.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/actions/lead.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateLink = vi.fn()
const mockSendEmail = vi.fn()
const mockHeaders = vi.fn(async () => new Map([['x-forwarded-for', '1.2.3.4']]))

vi.mock('next/headers', () => ({ headers: mockHeaders }))
vi.mock('@/utils/supabase/server', () => ({
  createServiceRoleClient: vi.fn(async () => ({
    auth: { admin: { generateLink: mockGenerateLink } },
  })),
}))
vi.mock('@/lib/email', () => ({ sendLeadMagicLinkEmail: mockSendEmail }))
vi.mock('@/lib/security/ratelimit', () => ({
  leadFormLimiter: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ success: true }) })),
  enforceRateLimit: vi.fn(),
  RateLimitError: class extends Error { retryAfter = 60 },
}))

import { requestLeadMagicLink } from './lead'

describe('requestLeadMagicLink', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid input', async () => {
    const fd = new FormData()
    fd.append('full_name', 'a') // too short
    fd.append('email', 'not-an-email')
    fd.append('terms_accepted', 'on')
    const res = await requestLeadMagicLink(fd)
    expect(res.ok).toBe(false)
  })

  it('generates link and sends Resend email on valid input', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'abc123' } },
      error: null,
    })
    const fd = new FormData()
    fd.append('full_name', 'Mario Rossi')
    fd.append('email', 'mario@example.com')
    fd.append('terms_accepted', 'on')
    fd.append('marketing_consent', 'on')

    const res = await requestLeadMagicLink(fd)

    expect(res.ok).toBe(true)
    expect(mockGenerateLink).toHaveBeenCalledOnce()
    expect(mockGenerateLink.mock.calls[0][0].type).toBe('magiclink')
    expect(mockGenerateLink.mock.calls[0][0].email).toBe('mario@example.com')
    const passedData = mockGenerateLink.mock.calls[0][0].options.data
    expect(passedData.account_type).toBe('lead')
    expect(passedData.marketing_consent_at).toBeDefined()
    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail.mock.calls[0][2]).toContain('token_hash=abc123')
  })

  it('omits marketing_consent_at when checkbox not ticked', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'abc' } },
      error: null,
    })
    const fd = new FormData()
    fd.append('full_name', 'Mario')
    fd.append('email', 'm@e.com')
    fd.append('terms_accepted', 'on')

    await requestLeadMagicLink(fd)

    const passedData = mockGenerateLink.mock.calls[0][0].options.data
    expect(passedData.marketing_consent_at).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run src/app/actions/lead.test.ts
```

- [ ] **Step 3: Implement `requestLeadMagicLink`**

Create `src/app/actions/lead.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sendLeadMagicLinkEmail } from '@/lib/email'
import {
  enforceRateLimit,
  leadFormLimiter,
  RateLimitError,
} from '@/lib/security/ratelimit'
import { validate, ValidationError, formDataToObject } from '@/lib/security/validation'
import { assertPasswordNotLeaked, LeakedPasswordError } from '@/lib/security/password'
import { leadFormSchema, upgradeLeadSchema } from './lead.schemas'
import type { ActionResult } from '@/lib/security/types'

export async function requestLeadMagicLink(
  formData: FormData,
): Promise<ActionResult<void>> {
  // 1. Validate
  let parsed
  try {
    parsed = validate(leadFormSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: 'Dati non validi', fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // 2. Rate limit (fail-open on Upstash outage)
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  try {
    await enforceRateLimit(leadFormLimiter('email'), `lead:email:${parsed.email}`)
    await enforceRateLimit(leadFormLimiter('ip'), `lead:ip:${ip}`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        message: `Troppe richieste. Riprova tra ${err.retryAfter} secondi.`,
        retryAfter: err.retryAfter,
      }
    }
  }

  // 3. Generate magic link via admin API (no Supabase email sent)
  const admin = await createServiceRoleClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fitandsmile.it'

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: parsed.email,
    options: {
      data: {
        full_name: parsed.full_name,
        account_type: 'lead',
        lead_source: parsed.lead_source ?? 'landing',
        marketing_consent_at: parsed.marketing_consent
          ? new Date().toISOString()
          : null,
      },
      redirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error || !data?.properties?.hashed_token) {
    console.error('[lead] generateLink failed', error?.message)
    return { ok: false, message: 'Errore durante la generazione del link. Riprova.' }
  }

  const magicUrl = `${siteUrl}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`

  // 4. Send via Resend custom template
  try {
    await sendLeadMagicLinkEmail(parsed.email, parsed.full_name, magicUrl)
  } catch (err) {
    console.error('[lead] magic link email send failed', err)
    return { ok: false, message: 'Errore durante l\'invio dell\'email. Riprova.' }
  }

  return { ok: true, data: undefined }
}

export async function upgradeLeadToStandard(
  formData: FormData,
): Promise<ActionResult<void>> {
  // 1. Validate
  let parsed
  try {
    parsed = validate(upgradeLeadSchema, formDataToObject(formData))
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, message: 'Dati non validi', fieldErrors: err.fieldErrors }
    }
    throw err
  }

  // 2. HIBP check (fail-open)
  try {
    await assertPasswordNotLeaked(parsed.password)
  } catch (err) {
    if (err instanceof LeakedPasswordError) {
      return {
        ok: false,
        message: 'Questa password è compromessa. Scegline una diversa.',
        fieldErrors: { password: ['Password compromessa'] },
      }
    }
  }

  // 3. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Non autorizzato' }

  // 4. Set password
  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.password,
  })
  if (updateErr) {
    return { ok: false, message: updateErr.message }
  }

  // 5. Flip account_type + clear lead expiry (service role)
  const admin = await createServiceRoleClient()
  await admin.from('profiles').update({
    account_type: 'standard',
    upgraded_from_lead_at: new Date().toISOString(),
    lead_expires_at: null,
  }).eq('id', user.id)

  return { ok: true, data: undefined }
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/app/actions/lead.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/lead.ts src/app/actions/lead.test.ts
git commit -m "feat(lead-magnet): add requestLeadMagicLink and upgradeLeadToStandard"
```

---

### Task B5: Create `<LeadHero>` component

**Files:**
- Create: `src/app/lezioni-gratis/LeadHero.tsx`
- Copy: `public/lead-magnet/hero.jpg` (from `Landing Video Gratuiti/Home.pdf` page 1 cropped, or asset provided separately)

- [ ] **Step 1: Copy hero asset**

```bash
mkdir -p public/lead-magnet
cp "C:\Users\Principale\Desktop\Documenti\Progetti\Rita\Landing Video Gratuiti\hero.jpg" public/lead-magnet/hero.jpg
```
(Asset file name may differ; verify with the designer's export.)

- [ ] **Step 2: Write the component**

Create `src/app/lezioni-gratis/LeadHero.tsx`:

```tsx
import Image from 'next/image'
import Logo from '@/components/Logo'

export default function LeadHero() {
  return (
    <section className="relative w-full min-h-[100vh] flex flex-col text-white overflow-hidden">
      <Image
        src="/lead-magnet/hero.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center z-0"
      />
      <div className="absolute inset-0 bg-black/30 z-10" />

      <div className="relative z-20 flex flex-col h-full min-h-[100vh] px-6 md:px-12">
        <header className="flex items-center justify-between py-6">
          <Logo variant="circle" height={48} showText={false} />
          <span
            className="text-white text-xl"
            style={{ fontFamily: 'var(--font-caveat)' }}
          >
            Fit&amp;Smile
          </span>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full pb-12">
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            <span className="block">Non siamo qui</span>
            <span className="block">per correre.</span>
            <span className="block text-right mt-2">Siamo qui per</span>
            <span className="block text-right">rinascere.</span>
          </h1>

          <div className="mt-12 flex justify-center">
            <a
              href="#form"
              className="inline-block bg-white text-neutral-900 font-bold uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-neutral-100 transition"
            >
              Inizia il tuo viaggio gratuito
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify it renders (Storybook-less, smoke test)**

Write `src/app/lezioni-gratis/LeadHero.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LeadHero from './LeadHero'

describe('LeadHero', () => {
  it('renders the headline and CTA', () => {
    render(<LeadHero />)
    expect(screen.getByText(/Non siamo qui/)).toBeInTheDocument()
    expect(screen.getByText(/Siamo qui per/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /inizia il tuo viaggio gratuito/i })).toHaveAttribute('href', '#form')
  })
})
```

Run: `npx vitest run src/app/lezioni-gratis/LeadHero.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/lezioni-gratis/LeadHero.tsx src/app/lezioni-gratis/LeadHero.test.tsx public/lead-magnet/hero.jpg
git commit -m "feat(lead-magnet): add LeadHero component"
```

---

### Task B6: Create `<LeadStepsPreview>` component

**Files:**
- Create: `src/app/lezioni-gratis/LeadStepsPreview.tsx`
- Create: `src/app/actions/lead.preview.ts` — server action `getLeadPackagePreview()`

- [ ] **Step 1: Write the server action to fetch the 3 videos' thumbnails**

Append to `src/app/actions/lead.ts`:

```ts
export async function getLeadPackagePreview() {
  const leadPackageId = process.env.LEAD_MAGNET_PACKAGE_ID
  if (!leadPackageId) return []

  const supabase = await createClient()
  const { data: videos } = await supabase
    .from('videos') // adjust to actual videos table name
    .select('id, title, bunny_video_id, thumbnail_url')
    .eq('package_id', leadPackageId)
    .order('order', { ascending: true })
    .limit(3)

  return videos ?? []
}
```

Note: verify the actual videos table name and columns by reading the project schema before writing the implementation; if videos live under a different table, adapt accordingly.

- [ ] **Step 2: Write the component**

Create `src/app/lezioni-gratis/LeadStepsPreview.tsx`:

```tsx
import Image from 'next/image'
import { getLeadPackagePreview } from '@/app/actions/lead'

export default async function LeadStepsPreview() {
  const videos = await getLeadPackagePreview()

  return (
    <section className="bg-[var(--bg)] py-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--secondary)]">
          Tre passi verso il benessere
        </h2>
        <p className="mt-6 text-base text-neutral-700">
          Tre video da 5-6 minuti <strong>adatti a tutte</strong>, per iniziare un passo alla volta, <strong>a stare bene</strong>
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {videos.map((v) => (
            <div key={v.id} className="relative aspect-video rounded-lg overflow-hidden border-2 border-[var(--secondary)]/30">
              {v.thumbnail_url ? (
                <Image
                  src={v.thumbnail_url}
                  alt={v.title ?? ''}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-neutral-200" />
              )}
            </div>
          ))}
          {videos.length === 0 && (
            // Placeholder slots while Rita hasn't uploaded videos yet
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="relative aspect-video rounded-lg bg-neutral-200 border-2 border-[var(--secondary)]/30" />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Add a smoke test (render without crashing)**

```tsx
// src/app/lezioni-gratis/LeadStepsPreview.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/actions/lead', () => ({
  getLeadPackagePreview: vi.fn(async () => []),
}))

import LeadStepsPreview from './LeadStepsPreview'

describe('LeadStepsPreview', () => {
  it('renders heading and placeholder slots when no videos', async () => {
    const ui = await LeadStepsPreview()
    render(ui)
    expect(screen.getByText('Tre passi verso il benessere')).toBeInTheDocument()
  })
})
```

Run: `npx vitest run src/app/lezioni-gratis/LeadStepsPreview.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/lead.ts src/app/lezioni-gratis/LeadStepsPreview.tsx src/app/lezioni-gratis/LeadStepsPreview.test.tsx
git commit -m "feat(lead-magnet): add LeadStepsPreview + getLeadPackagePreview action"
```

---

### Task B7: Create `<LeadCaptureForm>` component

**Files:**
- Create: `src/app/lezioni-gratis/LeadCaptureForm.tsx`
- Copy: `public/lead-magnet/form-bg.jpg`

- [ ] **Step 1: Copy form bg asset**

```bash
cp "C:\Users\Principale\Desktop\Documenti\Progetti\Rita\Landing Video Gratuiti\form-bg.jpg" public/lead-magnet/form-bg.jpg
```

- [ ] **Step 2: Write the client component**

Create `src/app/lezioni-gratis/LeadCaptureForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { requestLeadMagicLink } from '@/app/actions/lead'
import { leadFormSchema, type LeadFormInput } from '@/app/actions/lead.schemas'
import { Button } from '@/components/ui/button'

export default function LeadCaptureForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { lead_source: 'landing' },
  })
  const [success, setSuccess] = useState(false)

  const onSubmit = handleSubmit(async (values) => {
    const fd = new FormData()
    fd.append('full_name', values.full_name)
    fd.append('email', values.email)
    fd.append('terms_accepted', values.terms_accepted)
    if (values.marketing_consent) fd.append('marketing_consent', values.marketing_consent)
    if (values.lead_source) fd.append('lead_source', values.lead_source)

    const res = await requestLeadMagicLink(fd)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    setSuccess(true)
  })

  return (
    <section id="form" className="relative py-24 px-6 overflow-hidden">
      <Image
        src="/lead-magnet/form-bg.jpg"
        alt=""
        fill
        className="object-cover object-center z-0"
      />
      <div className="absolute inset-0 bg-black/50 z-10" />

      <div className="relative z-20 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white leading-snug">
          Ritrova il tuo equilibrio naturale e una nuova sensazione di leggerezza con il{' '}
          <span className="text-[var(--brand)]">percorso gratuito in 3 video</span>
        </h2>

        <p className="mt-4 text-white uppercase tracking-widest text-xs font-bold">
          Inserisci i tuoi dati per ricevere i 3 video del "Rituale della Leggerezza"
        </p>

        <div className="mt-10 bg-white rounded-2xl p-8 shadow-xl text-left">
          {success ? (
            <div className="text-center py-10 space-y-4">
              <h3 className="text-2xl font-bold text-[var(--secondary)]">Controlla la tua email</h3>
              <p className="text-neutral-700">
                Ti abbiamo inviato il magic link per accedere ai 3 video. Hai 14 giorni di tempo per fruirne.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="full_name" className="block text-sm font-semibold text-neutral-700">Nome</label>
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  {...register('full_name')}
                  className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--brand)] outline-none"
                />
                {errors.full_name && <p className="text-red-600 text-xs mt-1">{errors.full_name.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-neutral-700">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--brand)] outline-none"
                />
                {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value="on"
                  {...register('terms_accepted')}
                  className="mt-1"
                />
                <span className="text-xs text-neutral-600">
                  Accetto i <a href="/terms" target="_blank" className="text-[var(--brand)] underline">Termini</a> e la{' '}
                  <a href="/privacy" target="_blank" className="text-[var(--brand)] underline">Privacy Policy</a> (obbligatorio)
                </span>
              </label>
              {errors.terms_accepted && <p className="text-red-600 text-xs">{errors.terms_accepted.message}</p>}

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value="on"
                  {...register('marketing_consent')}
                  className="mt-1"
                />
                <span className="text-xs text-neutral-600">
                  Voglio ricevere consigli, novità e offerte da Fit&amp;Smile via email (puoi disiscriverti in qualsiasi momento)
                </span>
              </label>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 mt-4 rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-bold tracking-wider uppercase text-sm"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Inizia il tuo viaggio'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Write a unit test for the form**

Create `src/app/lezioni-gratis/LeadCaptureForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRequest = vi.fn()
vi.mock('@/app/actions/lead', () => ({ requestLeadMagicLink: mockRequest }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import LeadCaptureForm from './LeadCaptureForm'

describe('LeadCaptureForm', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows validation errors when submitted empty', async () => {
    render(<LeadCaptureForm />)
    fireEvent.click(screen.getByRole('button', { name: /inizia il tuo viaggio/i }))
    await waitFor(() => {
      expect(screen.getByText(/nome troppo corto/i)).toBeInTheDocument()
    })
  })

  it('calls requestLeadMagicLink and shows success state on ok', async () => {
    mockRequest.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LeadCaptureForm />)

    await user.type(screen.getByLabelText(/nome/i), 'Mario Rossi')
    await user.type(screen.getByLabelText(/email/i), 'mario@example.com')
    await user.click(screen.getByLabelText(/accetto i.*termini/i))
    await user.click(screen.getByRole('button', { name: /inizia il tuo viaggio/i }))

    await waitFor(() => {
      expect(screen.getByText(/controlla la tua email/i)).toBeInTheDocument()
    })
  })
})
```

Run: `npx vitest run src/app/lezioni-gratis/LeadCaptureForm.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/lezioni-gratis/LeadCaptureForm.tsx src/app/lezioni-gratis/LeadCaptureForm.test.tsx public/lead-magnet/form-bg.jpg
git commit -m "feat(lead-magnet): add LeadCaptureForm with double-consent GDPR"
```

---

### Task B8: Create `<LeadTestimonials>` component

**Files:**
- Create: `src/app/lezioni-gratis/LeadTestimonials.tsx`

- [ ] **Step 1: Write the component**

```tsx
const TESTIMONIALS = [
  {
    quote: 'A 48 anni, ho notato cambiamenti nel mio corpo, con una pancia gonfia che diventava un incubo. Dopo vari tentativi senza successo, ho scoperto Fit & Smile. Rita ti accoglie senza giudizio e con comprensione. Il suo metodo è stato efficace, restituendomi leggerezza fisica e mentale, facendomi sentire finalmente nel posto giusto.',
    name: 'Federica B.',
    bolds: ['Rita', 'senza giudizio', 'comprensione', 'nel posto giusto'],
  },
  {
    quote: 'Ero scettica riguardo a Fit & Smile, pensando fosse ginnastica pesante. Invece, il metodo di Rita rispetta il corpo delle donne. Le sue routine serali sono diventate una coccola; ora, mi sveglio al mattino sgonfia, leggera e con una bella energia.',
    name: 'Asia R.',
    bolds: ['Rita rispetta il corpo delle donne', 'sgonfia, leggera', 'energia'],
  },
  {
    quote: 'La sensazione di pesantezza mi opprimeva da mesi, rendendomi a disagio con i vestiti. Entrare in Fit & Smile è stata la mia salvezza. Non è un semplice corso per dimagrire, ma un percorso profondo. Il metodo di Rita lavora sul metabolismo e sullo stress in modo scientifico, senza esaurirti o imporre restrizioni. Grazie a lei, ho ritrovato armonia e ho fatto pace con lo specchio.',
    name: 'Teresa B.',
    bolds: ['percorso profondo', 'Rita', 'metabolismo', 'stress', 'fatto pace con lo specchio'],
  },
]

function applyBold(text: string, bolds: string[]) {
  const parts: (string | { bold: string })[] = []
  let cursor = 0
  bolds.forEach((b) => {
    const idx = text.indexOf(b, cursor)
    if (idx === -1) return
    if (idx > cursor) parts.push(text.slice(cursor, idx))
    parts.push({ bold: b })
    cursor = idx + b.length
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export default function LeadTestimonials() {
  return (
    <section className="bg-[var(--bg)] py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--secondary)] mb-12">
          Cosa dicono le donne in <strong>menopausa</strong> che hanno provato{' '}
          <em style={{ fontFamily: 'var(--font-caveat)' }}>Fit&amp;Smile</em>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="text-neutral-800">
              <p className="text-sm leading-relaxed italic">
                "{applyBold(t.quote, t.bolds).map((part, i) =>
                  typeof part === 'string' ? <span key={i}>{part}</span> : <strong key={i}>{part.bold}</strong>
                )}"
              </p>
              <p className="mt-4 text-[var(--brand)] font-bold text-sm">{t.name}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Smoke test**

```tsx
// src/app/lezioni-gratis/LeadTestimonials.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LeadTestimonials from './LeadTestimonials'

describe('LeadTestimonials', () => {
  it('renders the 3 testimonials with names', () => {
    render(<LeadTestimonials />)
    expect(screen.getByText('Federica B.')).toBeInTheDocument()
    expect(screen.getByText('Asia R.')).toBeInTheDocument()
    expect(screen.getByText('Teresa B.')).toBeInTheDocument()
  })
})
```

Run + expect PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/lezioni-gratis/LeadTestimonials.tsx src/app/lezioni-gratis/LeadTestimonials.test.tsx
git commit -m "feat(lead-magnet): add LeadTestimonials"
```

---

### Task B9: Create `<LeadLandingFooter>`

**Files:**
- Create: `src/app/lezioni-gratis/LeadLandingFooter.tsx`

- [ ] **Step 1: Write the component**

```tsx
import Link from 'next/link'

export default function LeadLandingFooter() {
  return (
    <footer className="bg-[var(--secondary)] text-white py-10 px-6 text-center text-xs">
      <p>© {new Date().getFullYear()} Fit&amp;Smile — Rita Zanicchi</p>
      <p className="mt-2 space-x-4">
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="hover:underline">Termini</Link>
      </p>
    </footer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/lezioni-gratis/LeadLandingFooter.tsx
git commit -m "feat(lead-magnet): add LeadLandingFooter"
```

---

### Task B10: Wire `/lezioni-gratis` page

**Files:**
- Create: `src/app/lezioni-gratis/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from 'next'
import LeadHero from './LeadHero'
import LeadStepsPreview from './LeadStepsPreview'
import LeadCaptureForm from './LeadCaptureForm'
import LeadTestimonials from './LeadTestimonials'
import LeadLandingFooter from './LeadLandingFooter'

export const metadata: Metadata = {
  title: 'Inizia gratis con il Rituale della Leggerezza | Fit&Smile',
  description: '3 video gratuiti da 5-6 minuti per ritrovare equilibrio e leggerezza. Lascia la tua email, ricevi il magic link e inizia subito.',
}

export default function LezioniGratisPage() {
  return (
    <main className="bg-[var(--bg)]">
      <LeadHero />
      <LeadStepsPreview />
      <LeadCaptureForm />
      <LeadTestimonials />
      <LeadLandingFooter />
    </main>
  )
}
```

- [ ] **Step 2: Verify locally**

```bash
npm run dev
# visit http://localhost:3000/lezioni-gratis — verify all 5 sections render
```

- [ ] **Step 3: Lint + typecheck**

```bash
npx eslint src/app/lezioni-gratis/
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/lezioni-gratis/page.tsx
git commit -m "feat(lead-magnet): wire /lezioni-gratis landing page"
```

---

### Task B11: Add `<LeadMagnetRibbon>` to main landing

**Files:**
- Create: `src/components/sections/LeadMagnetRibbon.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the ribbon component**

```tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function LeadMagnetRibbon() {
  return (
    <Link
      href="/lezioni-gratis"
      className="block bg-[var(--brand)] text-white py-3 px-6 text-center hover:opacity-95 transition"
    >
      <span className="text-sm md:text-base font-semibold inline-flex items-center gap-2">
        Inizia gratis con il Rituale della Leggerezza
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}
```

- [ ] **Step 2: Mount in main landing**

In `src/app/page.tsx`, add the import and place `<LeadMagnetRibbon />` between `<Hero />` and `<Metodo />` (or wherever it visually fits per Rita's preference).

```tsx
import LeadMagnetRibbon from "@/components/sections/LeadMagnetRibbon";
// ...
<Hero />
<LeadMagnetRibbon />
<Metodo />
```

- [ ] **Step 3: Lint + typecheck**

```bash
npx eslint src/app/page.tsx src/components/sections/LeadMagnetRibbon.tsx
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/LeadMagnetRibbon.tsx src/app/page.tsx
git commit -m "feat(lead-magnet): add ribbon CTA on main landing"
```

---

### Task B12: Update Privacy section for lead funnel

**Files:**
- Modify: `src/app/privacy/page.tsx` (or wherever the privacy page lives)

- [ ] **Step 1: Add a new section "#newsletter" describing the lead funnel**

Append after existing sections (find appropriate place in current copy):

```tsx
<section id="newsletter" className="mt-8">
  <h2 className="text-xl font-bold mb-3">Newsletter e contenuti gratuiti</h2>
  <p>
    Quando lasci la tua email tramite la pagina "Inizia gratis", i tuoi dati (nome e email)
    vengono memorizzati nei nostri server Supabase per offrirti l'accesso ai 3 video gratuiti
    del "Rituale della Leggerezza". L'accesso è valido per 14 giorni, dopo i quali ti
    invitiamo a completare la registrazione.
  </p>
  <p className="mt-3">
    Se hai prestato consenso al trattamento dei dati a fini commerciali, potremo inviarti
    occasionalmente comunicazioni promozionali, consigli e novità. Puoi revocare il consenso
    in qualsiasi momento contattandoci a info@fitandsmile.it o cliccando sul link di
    disiscrizione presente in ogni email.
  </p>
  <p className="mt-3">
    I dati dei lead non convertiti vengono conservati per 24 mesi, dopo i quali vengono
    automaticamente eliminati.
  </p>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "feat(lead-magnet): privacy section for lead funnel + GDPR retention"
```

---

# Workstream C: Dashboard refactor & Lead UX

---

### Task C1: Update `getContentHierarchy` for `hidden_from_discover` + lead expiry

**Files:**
- Modify: `src/app/actions/content.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/actions/content.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const queries: Record<string, { data: unknown; error: null }> = {}

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(queries[`${table}.single`] ?? { data: null }),
      then: (cb: (v: unknown) => unknown) => cb(queries[table] ?? { data: [], error: null }),
    })),
  })),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { getContentHierarchy } from './content'

describe('getContentHierarchy lead access gating', () => {
  beforeEach(() => { Object.keys(queries).forEach(k => delete queries[k]) })

  it('excludes lead-status package from purchased when lead expired', async () => {
    queries['user_subscriptions'] = { data: [], error: null }
    queries['one_time_purchases'] = {
      data: [{ package_id: 'pkg-lead', status: 'lead' }],
      error: null,
    }
    queries['profiles.single'] = {
      data: {
        account_type: 'lead',
        lead_expires_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
    }
    queries['levels'] = { data: [], error: null }

    const result = await getContentHierarchy()
    // No level has the lead package; verify by ensuring no level produces an isPurchased=true for pkg-lead
    expect(result).toBeInstanceOf(Array)
  })
})
```

This is a sketch — the actual existing test infrastructure may need a more sophisticated mock setup. Adapt to the existing pattern in the project.

- [ ] **Step 2: Modify `getContentHierarchy`**

In `src/app/actions/content.ts`, update the function to:

```ts
export async function getContentHierarchy() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Subscriptions (unchanged)
    const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('package_id, current_period_end')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])

    const nowMs = Date.now()
    const activeSubIds = (subs || [])
        .filter(s => !s.current_period_end || new Date(s.current_period_end).getTime() > nowMs)
        .map(s => s.package_id)

    // One-time purchases (now with status)
    const { data: oneTime } = await supabase
        .from('one_time_purchases')
        .select('package_id, status')
        .eq('user_id', user.id)
        .neq('status', 'refunded')

    // Lead expiry gating
    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, lead_expires_at')
        .eq('id', user.id)
        .single()

    const isLeadExpired = profile?.account_type === 'lead'
        && profile.lead_expires_at != null
        && new Date(profile.lead_expires_at).getTime() < nowMs

    const purchasedIds = [
        ...activeSubIds,
        ...(oneTime || [])
            .filter(p => !(p.status === 'lead' && isLeadExpired))
            .map(p => p.package_id),
    ]

    // Query levels/courses/packages (filter hidden_from_discover unless purchased)
    const { data, error } = await supabase
        .from('levels')
        .select(`
            id,
            name,
            courses (
                id,
                name,
                packages (
                    id,
                    name,
                    title,
                    subtitle,
                    description,
                    stripe_price_id,
                    price,
                    image_url,
                    payment_mode,
                    hidden_from_discover
                )
            )
        `)

    if (error) {
        console.error('Error fetching content hierarchy:', error)
        return []
    }

    // ... existing mapping logic, but filter packages where hidden_from_discover=true
    // AND user does NOT have access (not in purchasedIds)

    const typedData = (data as unknown) as Array<{
        id: string;
        name: string;
        courses: Array<{
            id: string;
            name: string;
            packages: Array<{
                id: string;
                name: string;
                title: string | null;
                subtitle: string | null;
                description: string;
                stripe_price_id: string;
                price: number;
                image_url: string | null;
                payment_mode: 'subscription' | 'payment';
                hidden_from_discover: boolean;
            }>;
        }>;
    }>;

    const hierarchy = (typedData || []).map((level) => ({
        ...level,
        courses: (level.courses || []).map((course) => ({
            ...course,
            packages: (course.packages || [])
                .filter((pkg) => !pkg.hidden_from_discover || purchasedIds.includes(pkg.id))
                .map((pkg) => ({
                    ...pkg,
                    isPurchased: purchasedIds.includes(pkg.id),
                })),
        })),
    }))

    return hierarchy as Level[]
}
```

Apply the equivalent `hidden_from_discover` filter to `getPublicContentHierarchy` as well (always filter out hidden packages for unauthenticated/public view).

- [ ] **Step 3: Run tests, expect pass**

```bash
npx vitest run src/app/actions/content.test.ts
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/content.ts src/app/actions/content.test.ts
git commit -m "feat(lead-magnet): gate lead access by expiry; filter hidden_from_discover in hierarchy"
```

---

### Task C2: Update `getPassportStamps` filter

**Files:**
- Modify: `src/app/actions/user.ts` (function around line 847)

- [ ] **Step 1: Update the query**

Replace the current `getPassportStamps()`:

```ts
export async function getPassportStamps() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Slots: all visible packages with a badge_type — EXCEPT hidden_from_discover ones
    // unless the user already earned that badge (so the stamp is shown as filled).
    const { data: visiblePackages } = await supabase
        .from('packages')
        .select('id, name, badge_type, hidden_from_discover')
        .not('badge_type', 'is', null)
        .order('name')

    const { data: userBadges } = await supabase
        .from('user_badges')
        .select('package_id')
        .eq('user_id', user.id)

    const earnedPkgIds = new Set((userBadges || []).map(b => b.package_id))

    const slots = (visiblePackages || []).filter(
        (p) => !p.hidden_from_discover || earnedPkgIds.has(p.id),
    )

    return slots
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/user.ts
git commit -m "feat(lead-magnet): filter passport slots by hidden_from_discover + earned"
```

---

### Task C3: Extract `<DashboardShell>` from `<DashboardClient>`

**Files:**
- Create: `src/app/dashboard/DashboardShell.tsx`
- Modify: `src/app/dashboard/DashboardClient.tsx` (will rename in next task)

- [ ] **Step 1: Read current `DashboardClient.tsx` to identify the shell parts**

Identify: theme provider, sidebar, layout container, transition overlay — these become `DashboardShell`.

- [ ] **Step 2: Create `DashboardShell.tsx`**

```tsx
'use client'

import { type ReactNode } from 'react'
import { DashboardThemeProvider } from './ThemeContext'
import DashboardSidebar from './DashboardSidebar'

type DashboardShellProps = {
  isLead: boolean
  children: ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
  visibleTabs: Array<{ id: string; label: string; icon: string }>
}

export default function DashboardShell({
  isLead,
  children,
  activeTab,
  onTabChange,
  visibleTabs,
}: DashboardShellProps) {
  return (
    <DashboardThemeProvider>
      <div className="min-h-screen bg-[var(--dash-bg)] flex">
        <DashboardSidebar
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          isLead={isLead}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </DashboardThemeProvider>
  )
}
```

(Adapt props to match what `DashboardSidebar` already expects — extract from current `DashboardClient.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): extract DashboardShell from DashboardClient"
```

---

### Task C4: Rename `DashboardClient.tsx` → `StandardDashboardClient.tsx`

**Files:**
- Rename: `src/app/dashboard/DashboardClient.tsx` → `src/app/dashboard/StandardDashboardClient.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Rename the file**

```bash
git mv src/app/dashboard/DashboardClient.tsx src/app/dashboard/StandardDashboardClient.tsx
```

- [ ] **Step 2: Rename the export**

In the renamed file: `export default function StandardDashboardClient(...)`.

- [ ] **Step 3: Refactor to use `DashboardShell`**

Replace the outer JSX (the shell parts) with `<DashboardShell ...>{children}</DashboardShell>`. The standard tabs list (Home, Library, Discover, Training, OneToOne, Billing, Profile) is passed to `visibleTabs`.

- [ ] **Step 4: Update `page.tsx` import**

In `src/app/dashboard/page.tsx`:

```tsx
import StandardDashboardClient from './StandardDashboardClient'
// (will add Lead branch in task C6)
```

- [ ] **Step 5: Run typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(dashboard): rename DashboardClient to StandardDashboardClient + use Shell"
```

---

### Task C5: Create `<LeadDashboardClient>`

**Files:**
- Create: `src/app/dashboard/LeadDashboardClient.tsx`
- Create: `src/app/dashboard/lead/LeadCountdownBanner.tsx`
- Create: `src/app/dashboard/lead/LeadProfileUpsellCard.tsx`

- [ ] **Step 1: Create the banner**

```tsx
// src/app/dashboard/lead/LeadCountdownBanner.tsx
'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UpgradeModal from './UpgradeModal'

type Props = { leadExpiresAt: string | null }

export default function LeadCountdownBanner({ leadExpiresAt }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const expiry = leadExpiresAt ? new Date(leadExpiresAt) : null
  const now = new Date()
  const expired = expiry ? expiry < now : false
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000)) : 0

  const copy = expired
    ? 'Il tuo accesso a Lezioni Gratis è scaduto — completa la registrazione per riprenderlo.'
    : daysLeft <= 3
      ? `Hai ${daysLeft} giorni rimanenti — completa la registrazione per non perdere l'accesso ai video.`
      : `Hai ${daysLeft} giorni rimanenti — completa la registrazione per conservare l'accesso a Lezioni Gratis e sbloccare tutto Fit&Smile.`

  const bgClass = expired
    ? 'bg-red-50 border-red-300 text-red-900'
    : daysLeft <= 3
      ? 'bg-orange-50 border-orange-300 text-orange-900'
      : 'bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--secondary)]'

  return (
    <>
      <div className={`sticky top-0 z-20 border-b py-3 px-4 md:px-6 ${bgClass}`}>
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{copy}</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[var(--brand)] text-white font-bold whitespace-nowrap text-xs px-4 py-2 rounded-full hover:opacity-90"
          >
            COMPLETA PROFILO →
          </Button>
        </div>
      </div>
      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
```

- [ ] **Step 2: Create the profile upsell card**

```tsx
// src/app/dashboard/lead/LeadProfileUpsellCard.tsx
'use client'

import { useState } from 'react'
import { Lock, Award, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UpgradeModal from './UpgradeModal'

export default function LeadProfileUpsellCard() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bg-gradient-to-br from-[var(--brand)]/15 to-[var(--secondary)]/10 border border-[var(--brand)]/30 rounded-2xl p-6 mb-6">
        <h3 className="text-xl font-bold text-[var(--secondary)] mb-4">Conserva il tuo viaggio</h3>
        <ul className="space-y-2 text-sm text-neutral-700 mb-6">
          <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--brand)]" /> Mantieni i 3 video gratuiti per sempre</li>
          <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-[var(--brand)]" /> Sblocca il catalogo completo</li>
          <li className="flex items-center gap-2"><Award className="h-4 w-4 text-[var(--brand)]" /> Conserva il passaporto e i badge guadagnati</li>
        </ul>
        <Button
          onClick={() => setOpen(true)}
          className="w-full bg-[var(--brand)] text-white font-bold py-3 rounded-xl hover:opacity-90"
        >
          Completa la registrazione
        </Button>
      </div>
      <UpgradeModal open={open} onOpenChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 3: Create LeadDashboardClient**

```tsx
// src/app/dashboard/LeadDashboardClient.tsx
'use client'

import { useState } from 'react'
import DashboardShell from './DashboardShell'
import LibrarySection from './LibrarySection'
import ProfileSection from './ProfileSection'
import LeadCountdownBanner from './lead/LeadCountdownBanner'
import LeadProfileUpsellCard from './lead/LeadProfileUpsellCard'

type Props = {
  userProfile: {
    full_name: string | null
    lead_expires_at: string | null
    // ...other Profile props as required by ProfileSection
  }
  // pass-through props
  hierarchy: unknown
}

export default function LeadDashboardClient({ userProfile, hierarchy }: Props) {
  const [activeTab, setActiveTab] = useState('library')
  const visibleTabs = [
    { id: 'library', label: 'Library', icon: 'library' },
    { id: 'profile', label: 'Profile', icon: 'user' },
  ]

  return (
    <DashboardShell
      isLead
      activeTab={activeTab}
      onTabChange={setActiveTab}
      visibleTabs={visibleTabs}
    >
      <LeadCountdownBanner leadExpiresAt={userProfile.lead_expires_at} />
      <div className="p-6">
        {activeTab === 'library' && <LibrarySection hierarchy={hierarchy} />}
        {activeTab === 'profile' && (
          <>
            <LeadProfileUpsellCard />
            <ProfileSection />
          </>
        )}
      </div>
    </DashboardShell>
  )
}
```

(Adapt prop signatures to actual `<LibrarySection>` and `<ProfileSection>` expectations.)

- [ ] **Step 4: Update `dashboard/page.tsx` to branch on `account_type`**

```tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import StandardDashboardClient from './StandardDashboardClient'
import LeadDashboardClient from './LeadDashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, lead_expires_at, account_type')
    .eq('id', user.id)
    .single()

  if (profile?.account_type === 'lead') {
    // Fetch what LeadDashboardClient needs
    return <LeadDashboardClient userProfile={profile} hierarchy={/* fetch */} />
  }

  // Default standard rendering
  return <StandardDashboardClient /* existing props */ />
}
```

- [ ] **Step 5: Typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/LeadDashboardClient.tsx src/app/dashboard/lead/LeadCountdownBanner.tsx src/app/dashboard/lead/LeadProfileUpsellCard.tsx src/app/dashboard/page.tsx
git commit -m "feat(lead-magnet): add LeadDashboardClient + banner + profile upsell card"
```

---

### Task C6: Create `<UpgradeModal>`

**Files:**
- Create: `src/app/dashboard/lead/UpgradeModal.tsx`

- [ ] **Step 1: Write failing test**

Create `src/app/dashboard/lead/UpgradeModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUpgrade = vi.fn()
vi.mock('@/app/actions/lead', () => ({ upgradeLeadToStandard: mockUpgrade }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import UpgradeModal from './UpgradeModal'

describe('UpgradeModal', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows inline error when upgrade returns ok=false', async () => {
    mockUpgrade.mockResolvedValue({ ok: false, message: 'Password troppo debole' })
    render(<UpgradeModal open={true} onOpenChange={vi.fn()} />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /completa/i }))

    await waitFor(() => {
      expect(screen.getByText(/password troppo debole/i)).toBeInTheDocument()
    })
  })

  it('calls upgrade and closes on success', async () => {
    mockUpgrade.mockResolvedValue({ ok: true })
    const onOpenChange = vi.fn()
    render(<UpgradeModal open={true} onOpenChange={onOpenChange} />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/password/i), 'StrongPass123!')
    await user.click(screen.getByRole('button', { name: /completa/i }))

    await waitFor(() => {
      expect(mockUpgrade).toHaveBeenCalledOnce()
    })
  })
})
```

Run: expect FAIL.

- [ ] **Step 2: Implement the modal**

```tsx
// src/app/dashboard/lead/UpgradeModal.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Loader2, Eye, EyeOff } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { upgradeLeadToStandard } from '@/app/actions/lead'
import { upgradeLeadSchema, type UpgradeLeadInput } from '@/app/actions/lead.schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UpgradeModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<UpgradeLeadInput>({
    resolver: zodResolver(upgradeLeadSchema),
  })
  const passwordValue = watch('password', '')

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const fd = new FormData()
    fd.append('password', values.password)
    const res = await upgradeLeadToStandard(fd)
    if (!res.ok) {
      setError(res.message)
      return
    }
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    toast.success('Registrazione completata. Bentornata nel percorso completo!')
    onOpenChange(false)
    router.refresh()
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Completa la registrazione</DialogTitle>
          <DialogDescription>
            Ti basta scegliere una password. Mantieni email, profilo, badge e i 3 video.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-1">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                className="w-full px-3 py-2 border rounded-md pr-10 focus:ring-2 focus:ring-[var(--brand)] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Nascondi' : 'Mostra'}
                className="absolute right-2 top-2 text-neutral-500"
              >
                {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <PasswordStrengthMeter value={passwordValue} />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[var(--brand)] hover:opacity-90 text-white font-bold py-3 rounded-xl"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Completa →'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/app/dashboard/lead/UpgradeModal.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/lead/UpgradeModal.tsx src/app/dashboard/lead/UpgradeModal.test.tsx
git commit -m "feat(lead-magnet): add UpgradeModal with confetti and toast"
```

---

### Task C7: Create `<LeadCompletionModal>` one-shot

**Files:**
- Create: `src/app/dashboard/lead/LeadCompletionModal.tsx`
- Modify: `src/app/dashboard/LeadDashboardClient.tsx`
- Create: `src/app/actions/lead.ts` — new function `markCompletionModalShown`

- [ ] **Step 1: Add `markCompletionModalShown` action**

In `src/app/actions/lead.ts`:

```ts
export async function markCompletionModalShown(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const admin = await createServiceRoleClient()
  await admin.from('profiles')
    .update({ completion_modal_shown_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('completion_modal_shown_at', null)
}
```

- [ ] **Step 2: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { markCompletionModalShown } from '@/app/actions/lead'

type Props = {
  shouldShow: boolean
  onUpgradeClick: () => void
}

export default function LeadCompletionModal({ shouldShow, onUpgradeClick }: Props) {
  const [open, setOpen] = useState(shouldShow)

  useEffect(() => {
    if (shouldShow) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } })
      void markCompletionModalShown()
    }
  }, [shouldShow])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hai completato il Rituale della Leggerezza!</DialogTitle>
          <DialogDescription>
            Hai guadagnato il primo stamp sul tuo passaporto. Pronta a continuare il viaggio?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Più tardi</Button>
          <Button
            onClick={() => { setOpen(false); onUpgradeClick() }}
            className="bg-[var(--brand)] text-white"
          >
            Completa la registrazione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Trigger from `LeadDashboardClient`**

In `LeadDashboardClient`, compute `shouldShow` server-side via prop:
- `profile.completion_modal_shown_at === null`
- AND user has a `user_badges` row for the lead package

Pass `shouldShow` from `dashboard/page.tsx`:

```tsx
const { data: leadBadge } = await supabase
  .from('user_badges')
  .select('id')
  .eq('user_id', user.id)
  .eq('package_id', process.env.LEAD_MAGNET_PACKAGE_ID)
  .maybeSingle()

const shouldShowCompletion =
  profile?.completion_modal_shown_at === null && !!leadBadge

return <LeadDashboardClient userProfile={profile} hierarchy={...} shouldShowCompletion={shouldShowCompletion} />
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/lead/LeadCompletionModal.tsx src/app/dashboard/LeadDashboardClient.tsx src/app/dashboard/page.tsx src/app/actions/lead.ts
git commit -m "feat(lead-magnet): add one-shot completion modal after 3rd video"
```

---

# Workstream D: Admin & Cron

---

### Task D1: Create admin lead actions

**Files:**
- Create: `src/app/actions/admin_actions/leads.ts`
- Create: `src/app/actions/admin_actions/leads.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/actions/admin_actions/leads.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin1' } } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'admin1' } }),
    })),
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      then: (cb: (v: unknown) => unknown) => cb({ count: 5, data: [], error: null }),
    })),
  })),
}))

import { getLeadKPIs } from './leads'

describe('getLeadKPIs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns KPI shape', async () => {
    const kpis = await getLeadKPIs()
    expect(kpis).toHaveProperty('activeLeads')
    expect(kpis).toHaveProperty('expiredLeads')
    expect(kpis).toHaveProperty('totalUpgrades')
    expect(kpis).toHaveProperty('conversionRate')
  })
})
```

- [ ] **Step 2: Implement**

```ts
'use server'

import { createClient, createServiceRoleClient } from '@/utils/supabase/server'

async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: admin } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single()
  if (!admin) throw new Error('Forbidden')
  return user.id
}

export async function getLeadKPIs() {
  await requireAdmin()
  const admin = await createServiceRoleClient()
  const now = new Date().toISOString()

  const { count: activeLeads } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('account_type', 'lead')
    .gte('lead_expires_at', now)

  const { count: expiredLeads } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('account_type', 'lead')
    .lte('lead_expires_at', now)

  const { count: totalUpgrades } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('upgraded_from_lead_at', 'is', null)

  const { count: everLead } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .or(`account_type.eq.lead,upgraded_from_lead_at.not.is.null`)

  const conversionRate = everLead && everLead > 0
    ? (totalUpgrades ?? 0) / everLead
    : 0

  return {
    activeLeads: activeLeads ?? 0,
    expiredLeads: expiredLeads ?? 0,
    totalUpgrades: totalUpgrades ?? 0,
    conversionRate,
  }
}

export async function getLeadsList(filters: {
  status?: 'active' | 'expired' | 'converted'
  search?: string
  limit?: number
  offset?: number
} = {}) {
  await requireAdmin()
  const admin = await createServiceRoleClient()
  const now = new Date().toISOString()
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  let query = admin
    .from('profiles')
    .select('id, email, full_name, account_type, lead_expires_at, upgraded_from_lead_at, lead_source, created_at, marketing_consent_at', { count: 'exact' })

  if (filters.status === 'active') {
    query = query.eq('account_type', 'lead').gte('lead_expires_at', now)
  } else if (filters.status === 'expired') {
    query = query.eq('account_type', 'lead').lte('lead_expires_at', now)
  } else if (filters.status === 'converted') {
    query = query.not('upgraded_from_lead_at', 'is', null)
  } else {
    query = query.or(`account_type.eq.lead,upgraded_from_lead_at.not.is.null`)
  }

  if (filters.search) {
    query = query.or(`email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`)
  }

  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false })

  const { data, count, error } = await query
  if (error) throw error
  return { leads: data ?? [], total: count ?? 0 }
}

export async function extendLeadWindow(userId: string, days: number) {
  await requireAdmin()
  if (days < 1 || days > 30) throw new Error('Days must be 1-30')
  const admin = await createServiceRoleClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('lead_expires_at')
    .eq('id', userId)
    .single()

  const base = profile?.lead_expires_at && new Date(profile.lead_expires_at) > new Date()
    ? new Date(profile.lead_expires_at)
    : new Date()
  const newExpiry = new Date(base.getTime() + days * 86400000)

  await admin.from('profiles').update({ lead_expires_at: newExpiry.toISOString() }).eq('id', userId)
  return { newExpiry: newExpiry.toISOString() }
}

export async function exportLeadsCSV(filters: Parameters<typeof getLeadsList>[0]) {
  await requireAdmin()
  const { leads } = await getLeadsList({ ...filters, limit: 10000 })
  const headers = ['Email', 'Nome', 'Status', 'Lead Source', 'Marketing Consent', 'Created At', 'Lead Expires At', 'Upgraded At']
  const rows = leads.map((l) => [
    l.email,
    l.full_name ?? '',
    l.upgraded_from_lead_at ? 'converted' : (new Date(l.lead_expires_at ?? 0) > new Date() ? 'active' : 'expired'),
    l.lead_source ?? '',
    l.marketing_consent_at ? 'yes' : 'no',
    l.created_at,
    l.lead_expires_at ?? '',
    l.upgraded_from_lead_at ?? '',
  ])
  const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  return csv
}
```

- [ ] **Step 3: Run tests, expect pass**

```bash
npx vitest run src/app/actions/admin_actions/leads.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/admin_actions/leads.ts src/app/actions/admin_actions/leads.test.ts
git commit -m "feat(lead-magnet): admin actions for lead KPIs/list/extend/export"
```

---

### Task D2: Create `<AdminLeads>` view

**Files:**
- Create: `src/app/admin/AdminLeads.tsx`
- Modify: `src/app/admin/DashboardClient.tsx` (admin)

- [ ] **Step 1: Implement the view**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLeadKPIs, getLeadsList, extendLeadWindow, exportLeadsCSV } from '@/app/actions/admin_actions/leads'

type KPI = Awaited<ReturnType<typeof getLeadKPIs>>
type Lead = Awaited<ReturnType<typeof getLeadsList>>['leads'][number]

export default function AdminLeads() {
  const [kpis, setKpis] = useState<KPI | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<'active' | 'expired' | 'converted' | undefined>()
  const [search, setSearch] = useState('')

  useEffect(() => {
    void Promise.all([
      getLeadKPIs().then(setKpis),
      getLeadsList({ status: filter, search }).then(r => setLeads(r.leads)),
    ])
  }, [filter, search])

  const handleExport = async () => {
    const csv = await exportLeadsCSV({ status: filter, search })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Lead Magnet</h2>

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-neutral-500">Lead attivi</p>
            <p className="text-3xl font-bold">{kpis.activeLeads}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-neutral-500">Lead scaduti</p>
            <p className="text-3xl font-bold">{kpis.expiredLeads}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-neutral-500">Upgrade totali</p>
            <p className="text-3xl font-bold">{kpis.totalUpgrades}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-neutral-500">Conversion rate</p>
            <p className="text-3xl font-bold">{(kpis.conversionRate * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select value={filter ?? ''} onChange={(e) => setFilter((e.target.value || undefined) as typeof filter)} className="px-3 py-2 border rounded-md">
          <option value="">Tutti</option>
          <option value="active">Attivi</option>
          <option value="expired">Scaduti</option>
          <option value="converted">Convertiti</option>
        </select>
        <input
          type="search"
          placeholder="Cerca per email o nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md"
        />
        <Button onClick={handleExport} className="bg-[var(--brand)] text-white">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <table className="w-full bg-white rounded-xl border">
        <thead className="bg-neutral-50">
          <tr>
            <th className="text-left p-3">Nome</th>
            <th className="text-left p-3">Email</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Scade</th>
            <th className="text-left p-3">Marketing</th>
            <th className="text-left p-3">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const status = l.upgraded_from_lead_at
              ? 'convertito'
              : (l.lead_expires_at && new Date(l.lead_expires_at) > new Date() ? 'attivo' : 'scaduto')
            return (
              <tr key={l.id} className="border-t">
                <td className="p-3">{l.full_name ?? '-'}</td>
                <td className="p-3">{l.email}</td>
                <td className="p-3">{status}</td>
                <td className="p-3">{l.lead_expires_at ? new Date(l.lead_expires_at).toLocaleDateString() : '-'}</td>
                <td className="p-3">{l.marketing_consent_at ? '✓' : '—'}</td>
                <td className="p-3 space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await extendLeadWindow(l.id, 7)
                      // refresh
                      const r = await getLeadsList({ status: filter, search })
                      setLeads(r.leads)
                    }}
                  >
                    +7gg
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Register the tab in `src/app/admin/DashboardClient.tsx`**

Add "Lead Magnet" to the tabs array and render `<AdminLeads />` when active.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/AdminLeads.tsx src/app/admin/DashboardClient.tsx
git commit -m "feat(lead-magnet): admin Leads tab with KPI + list + extend + export"
```

---

### Task D3: Add lead reminder emails to `email.ts`

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/lib/email.test.ts`

- [ ] **Step 1: Add the two functions**

```ts
export async function sendLeadReminderT10Email(to: string, name: string, daysLeft: number) {
  const html = emailLayout(`
    <h2 style="...">Ti restano ${daysLeft} giorni, ${name || 'cara'}</h2>
    <p>Non perdere i tuoi 3 video gratuiti del <strong>Rituale della Leggerezza</strong>.</p>
    <p>Completa la registrazione (basta una password) per conservare l'accesso anche dopo la scadenza.</p>
    ${button('COMPLETA ORA', `${SITE_URL}/dashboard?upgrade=1`)}
  `)
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Ti restano ${daysLeft} giorni`,
    html,
  })
}

export async function sendLeadReminderT20Email(to: string, name: string) {
  const html = emailLayout(`
    <h2 style="...">${name || 'Cara'}, l'accesso è scaduto</h2>
    <p>Il tuo periodo di prova ai 3 video del <strong>Rituale della Leggerezza</strong> è terminato.</p>
    <p>Completa la registrazione per riavere accesso e conservare ciò che hai conquistato.</p>
    ${button('RIPRENDI IL TUO POSTO', `${SITE_URL}/dashboard?upgrade=1`)}
  `)
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Riprendi Lezioni Gratis',
    html,
  })
}
```

- [ ] **Step 2: Add tests in `email.test.ts`**

```ts
describe('sendLeadReminderT10Email', () => {
  it('sends with countdown', async () => {
    await sendLeadReminderT10Email('a@e.com', 'Mario', 4)
    const args = sendMock.mock.calls[sendMock.mock.calls.length - 1][0]
    expect(args.subject).toContain('4 giorni')
  })
})
```

Run, pass, commit:

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(lead-magnet): add T+10 and T+20 reminder email templates"
```

---

### Task D4: Create `/api/cron/lead-reminders` route

**Files:**
- Create: `src/app/api/cron/lead-reminders/route.ts`
- Create: `src/app/api/cron/lead-reminders/route.test.ts`

- [ ] **Step 1: Read existing `trial-reminders` route for pattern**

```bash
cat src/app/api/cron/trial-reminders/route.ts
```
Replicate the auth-via-secret pattern.

- [ ] **Step 2: Write failing test (Vitest with happy-dom)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateMock = vi.fn().mockResolvedValue({ error: null })
const sendT10 = vi.fn()
const sendT20 = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createServiceRoleClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      update: vi.fn(() => ({ eq: updateMock })),
      then: (cb: (v: unknown) => unknown) => cb({ data: [
        { id: 'u1', email: 'a@e.com', full_name: 'Mario', lead_expires_at: new Date(Date.now() + 3.5 * 86400000).toISOString() },
      ], error: null }),
    })),
  })),
}))
vi.mock('@/lib/email', () => ({
  sendLeadReminderT10Email: sendT10,
  sendLeadReminderT20Email: sendT20,
}))

import { GET } from './route'

describe('lead-reminders cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'
  })

  it('rejects without secret', async () => {
    const req = new Request('http://l/api/cron/lead-reminders')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('sends T10 to eligible leads', async () => {
    const req = new Request('http://l/api/cron/lead-reminders', { headers: { 'X-Cron-Secret': 'secret' } })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(sendT10).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/cron/lead-reminders/route.ts
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendLeadReminderT10Email, sendLeadReminderT20Email } from '@/lib/email'

export async function GET(request: Request) {
  if (request.headers.get('X-Cron-Secret') !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = await createServiceRoleClient()
  const now = new Date()
  const t10From = new Date(now.getTime() + 3 * 86400000) // expires in ~3-4 days
  const t10To = new Date(now.getTime() + 4 * 86400000)
  const t20From = new Date(now.getTime() - 7 * 86400000) // expired 6-7 days ago
  const t20To = new Date(now.getTime() - 6 * 86400000)

  // T+10: send to leads whose window expires in ~4 days (mid-trial urgency)
  const { data: t10Leads } = await admin
    .from('profiles')
    .select('id, email, full_name, lead_expires_at')
    .eq('account_type', 'lead')
    .not('marketing_consent_at', 'is', null)
    .is('lead_reminder_t10_sent_at', null)
    .gte('lead_expires_at', t10From.toISOString())
    .lt('lead_expires_at', t10To.toISOString())

  let t10Sent = 0
  for (const lead of t10Leads ?? []) {
    if (!lead.email) continue
    const daysLeft = Math.ceil((new Date(lead.lead_expires_at!).getTime() - now.getTime()) / 86400000)
    try {
      await sendLeadReminderT10Email(lead.email, lead.full_name ?? '', daysLeft)
      await admin.from('profiles')
        .update({ lead_reminder_t10_sent_at: now.toISOString() })
        .eq('id', lead.id)
      t10Sent++
    } catch (err) {
      console.error('[lead-reminders] T10 send failed', lead.id, err)
    }
  }

  // T+20: send to leads whose window expired ~6 days ago (post-expiry recovery)
  const { data: t20Leads } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('account_type', 'lead')
    .not('marketing_consent_at', 'is', null)
    .is('lead_reminder_t20_sent_at', null)
    .gte('lead_expires_at', t20From.toISOString())
    .lt('lead_expires_at', t20To.toISOString())

  let t20Sent = 0
  for (const lead of t20Leads ?? []) {
    if (!lead.email) continue
    try {
      await sendLeadReminderT20Email(lead.email, lead.full_name ?? '')
      await admin.from('profiles')
        .update({ lead_reminder_t20_sent_at: now.toISOString() })
        .eq('id', lead.id)
      t20Sent++
    } catch (err) {
      console.error('[lead-reminders] T20 send failed', lead.id, err)
    }
  }

  return NextResponse.json({ t10Sent, t20Sent })
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/app/api/cron/lead-reminders/
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/lead-reminders/
git commit -m "feat(lead-magnet): T+10 and T+20 reminder cron with idempotency flags"
```

---

### Task D5: Schedule cron in `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Read current `vercel.json` to identify existing crons**

```bash
cat vercel.json
```

- [ ] **Step 2: Add a new cron entry**

```json
{
  "crons": [
    { "path": "/api/cron/trial-reminders", "schedule": "0 9 * * *" },
    { "path": "/api/cron/lead-reminders", "schedule": "0 10 * * *" }
  ]
}
```

(Adapt to match the existing format; if the file already has the trial-reminders entry, append next to it.)

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(lead-magnet): schedule lead-reminders cron daily at 10:00"
```

---

## End-to-end verification (after all workstreams complete)

- [ ] **Apply migration** in Supabase: paste `20260528_10_lead_magnet.sql` into SQL editor, run.
- [ ] **Configure Supabase email templates** (Task A4).
- [ ] **Create "Lezioni Gratis" package** via admin panel, upload 3 videos via Bunny, set `hidden_from_discover=true`, copy `id` to `LEAD_MAGNET_PACKAGE_ID` env var (Task A5).
- [ ] **Set `CRON_SECRET`** env var on Vercel.
- [ ] **Run automated suite**:
  ```bash
  npm test
  npm run lint
  npx tsc --noEmit
  npm run build
  ```
  All green.

- [ ] **Manual E2E scenarios** (per spec § "Verifica end-to-end"):
  1. Lead happy path: `/lezioni-gratis` → form → email arrives with Resend template → click → dashboard variant lead → 3 videos visible → watch all → completion modal → upgrade → variant flips to standard.
  2. Lead expiry: manually `update profiles set lead_expires_at=now()-1d` → refresh → banner copy aggressive, videos hidden → upgrade → access restored.
  3. Existing standard user submits lead form: receives magic link, lands on standard dashboard, no grant.
  4. Rate limit: 2 submits same email within 1h → 2nd rejected.
  5. Cron: `update profiles set lead_expires_at=now()+3.5d` → curl cron endpoint with secret → T10 email received, flag set, second curl → no resend.
  6. Admin: visit /admin Leads tab → KPI correct, list shows lead, +7gg button extends, CSV export downloads.
  7. GDPR: submit without marketing consent → reminder cron skips that user.
  8. Regressions: existing email/password login, Google OAuth, Stripe checkout/refund all unchanged.

- [ ] **Final commit if anything else discovered**:

```bash
git add -A
git commit -m "feat(lead-magnet): final E2E adjustments"
```
