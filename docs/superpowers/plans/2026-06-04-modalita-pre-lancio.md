# Modalità Pre-Lancio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una "modalità pre-lancio" (flag unico) che spegne gli acquisti (Stripe non può andare live senza P.IVA), riformula il funnel come Community Fit&Smile con accesso ai video senza scadenza, ed espone email Community via il sistema broadcast admin esistente — il tutto reversibile in un deploy al go-live.

**Architecture:** Un flag d'ambiente `NEXT_PUBLIC_PRELAUNCH_MODE` letto da un helper puro. Una guardia server-side blocca il checkout; la UI degli acquisti diventa CTA Community. I lead nascono senza scadenza. Le email Community si inviano via l'azione `sendBroadcast` esistente, implementando il suo canale email (oggi stub "presto") con `resend.batch.send` verso i lead iscritti, con `email_unsubscribed_at` come unico interruttore di disiscrizione.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (Postgres + RLS), Resend, Vitest, Tailwind, Sonner.

> **Nota di scoperta (supera lo spec):** lo spec ipotizzava un "nuovo compositore admin". In realtà esiste già `src/app/admin/AdminBroadcasts.tsx` + `src/app/actions/admin_actions/broadcasts.ts` (in-app + push) con un canale **Email disabilitato ("presto")**. Questo piano **estende** quel sistema (canale email + target "Community/Lead") invece di crearne uno nuovo. DRY.

---

## File structure (cosa tocchiamo)

**Nuovi:**
- `src/lib/prelaunch.ts` — helper `isPrelaunch()`.
- `src/lib/prelaunch.test.ts`
- `src/components/PWAUpdatePrompt.tsx` — toast one-shot "aggiorna".
- `supabase/20260604_12_prelaunch_mode.sql` — colonna `email_unsubscribed_at` + backfill.

**Modificati:**
- `src/app/actions/stripe.ts` — guardia pre-lancio in `createCheckoutSession`.
- `src/app/actions/stripe.test.ts` — test guardia.
- `src/components/BuyButton.tsx` — ramo pre-lancio → CTA Community.
- `src/app/auth/callback/route.ts` — `provisionLeadIfNeeded`: `lead_expires_at = null` in pre-lancio.
- `src/app/dashboard/lead/LeadCountdownBanner.tsx` — copy Community quando expiry null.
- `src/lib/marketing-consent.ts` — `setEmailSubscription` / `getEmailSubscribed` su `email_unsubscribed_at`.
- `src/lib/marketing-consent.test.ts` — test nuovi helper.
- `src/app/api/unsubscribe/route.ts` — setta `email_unsubscribed_at`.
- `src/app/actions/gdpr.ts` — `getEmailSubscribed` / `updateEmailSubscribed`.
- `src/app/dashboard/ProfileSection.tsx` — toggle = interruttore iscrizione email.
- `src/lib/email.ts` — `sendCommunityBatch` (resend.batch.send).
- `src/lib/email.test.ts` — test `sendCommunityBatch`.
- `src/app/actions/admin_actions/broadcasts.schemas.ts` — target `lead` + campo `emailBody`.
- `src/app/actions/admin_actions/broadcasts.ts` — target lead + canale email.
- `src/app/actions/admin_actions/broadcasts.test.ts` — test canale email (creare se assente).
- `src/app/admin/AdminBroadcasts.tsx` — abilita email + target Community.
- `src/app/lezioni-gratis/LeadCaptureForm.tsx` — copy Community.
- `src/app/pacchetti/page.tsx` — badge "In arrivo" in pre-lancio.
- `src/app/layout.tsx` — monta `PWAUpdatePrompt`.
- `.env.example` — `NEXT_PUBLIC_PRELAUNCH_MODE`.
- `supabase/triggers.sql` — allinea colonna nuova.

**Parallelizzazione (agent-teams):** Fase 0 (migrazione + helper) blocca tutto. Poi i gruppi A (acquisti), B (lifecycle), C (iscrizione/unsubscribe), D (email Community — dipende da C), E (PWA), F (copy/env) sono in gran parte indipendenti. Vedi dipendenze nei titoli di fase.

---

## FASE 0 — Fondamenta (blocca tutto)

### Task 0.1: Migrazione `email_unsubscribed_at`

**Files:**
- Create: `supabase/20260604_12_prelaunch_mode.sql`
- Modify: `supabase/triggers.sql` (allineamento seed)

- [ ] **Step 1: Scrivere la migrazione**

```sql
-- 20260604_12_prelaunch_mode.sql
-- Pre-launch mode support.
-- email_unsubscribed_at: master switch for all bulk email (Community + future
-- marketing). NULL = subscribed. Set by /api/unsubscribe and the profile
-- toggle; honoured by the Community email send. Transactional email ignores it.
-- Backfill: in pre-launch the lead access window is removed (lead_expires_at
-- NULL = never expires, per the existing check in content.ts), so extend any
-- existing leads.

BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamptz;

-- Extend existing leads (likely none real yet) so nobody loses access during
-- the ~2 month pre-launch gap.
UPDATE public.profiles SET lead_expires_at = NULL WHERE account_type = 'lead';

COMMIT;
```

- [ ] **Step 2: Applicare la migrazione**

Applicare via MCP (orchestratore, non subagent): `mcp__supabase__apply_migration` con name `20260604_12_prelaunch_mode` e il SQL sopra. In alternativa eseguire il file su Supabase.
Verifica: `SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='email_unsubscribed_at';` → 1 riga.

- [ ] **Step 3: Allineare `supabase/triggers.sql`**

Nel `create table if not exists public.profiles (...)` aggiungere, accanto alle altre colonne nullable, la riga:
```sql
    email_unsubscribed_at timestamptz,
```
(Solo allineamento del seed bootstrap; non cambia il comportamento runtime.)

- [ ] **Step 4: Commit**

```bash
git add supabase/20260604_12_prelaunch_mode.sql supabase/triggers.sql
git commit -m "feat(db): email_unsubscribed_at + extend existing leads (pre-launch)"
```

### Task 0.2: Helper `isPrelaunch()`

**Files:**
- Create: `src/lib/prelaunch.ts`
- Test: `src/lib/prelaunch.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// src/lib/prelaunch.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { isPrelaunch } from './prelaunch'

describe('isPrelaunch', () => {
  const orig = process.env.NEXT_PUBLIC_PRELAUNCH_MODE
  afterEach(() => { process.env.NEXT_PUBLIC_PRELAUNCH_MODE = orig })

  it('is true only when the flag is exactly "true"', () => {
    process.env.NEXT_PUBLIC_PRELAUNCH_MODE = 'true'
    expect(isPrelaunch()).toBe(true)
  })
  it('is false when unset', () => {
    delete process.env.NEXT_PUBLIC_PRELAUNCH_MODE
    expect(isPrelaunch()).toBe(false)
  })
  it('is false for any other value', () => {
    process.env.NEXT_PUBLIC_PRELAUNCH_MODE = '1'
    expect(isPrelaunch()).toBe(false)
  })
})
```

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx vitest run src/lib/prelaunch.test.ts`
Expected: FAIL ("Cannot find module './prelaunch'").

- [ ] **Step 3: Implementare**

```ts
// src/lib/prelaunch.ts
/**
 * Pre-launch mode: purchases are off (no VAT number → Stripe can't go live),
 * the funnel runs as the free Community. Flipped off (with Stripe live keys)
 * at go-live in the same deploy. NEXT_PUBLIC_* so both client and server read it.
 */
export function isPrelaunch(): boolean {
  return process.env.NEXT_PUBLIC_PRELAUNCH_MODE === 'true'
}
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx vitest run src/lib/prelaunch.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prelaunch.ts src/lib/prelaunch.test.ts
git commit -m "feat: isPrelaunch() flag helper"
```

---

## FASE A — Acquisti spenti (dopo 0.2)

### Task A.1: Guardia server in `createCheckoutSession`

**Files:**
- Modify: `src/app/actions/stripe.ts` (inizio di `createCheckoutSession`, dopo l'auth)
- Test: `src/app/actions/stripe.test.ts`

- [ ] **Step 1: Scrivere il test**

Aggiungere in `src/app/actions/stripe.test.ts` (segue i mock esistenti del file; se serve un mock di `@/lib/prelaunch`, aggiungerlo in cima con `vi.mock`):

```ts
import { vi } from 'vitest'
vi.mock('@/lib/prelaunch', () => ({ isPrelaunch: vi.fn(() => true) }))

it('rifiuta il checkout in modalità pre-lancio', async () => {
  const { createCheckoutSession } = await import('./stripe')
  await expect(createCheckoutSession('any-package-id')).rejects.toThrow(
    /apriranno a breve/i,
  )
})
```

> Nota: se `stripe.test.ts` non esiste ancora con questo setup, crearlo mockando `@/utils/supabase/server` (getUser → un utente) e `@/lib/prelaunch`. La guardia è il primo statement dopo l'auth, quindi il test non deve raggiungere Stripe.

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx vitest run src/app/actions/stripe.test.ts`
Expected: FAIL (la funzione non lancia ancora).

- [ ] **Step 3: Implementare la guardia**

In `src/app/actions/stripe.ts`, aggiungere l'import in cima:
```ts
import { isPrelaunch } from '@/lib/prelaunch'
```
In `createCheckoutSession`, subito dopo il blocco "1. Authenticate user" (dopo `if (!user) { redirect('/login') }`), inserire:
```ts
    // Pre-launch: purchases are disabled (Stripe can't go live without a VAT
    // number). Hard server-side block — the UI also hides buy buttons.
    if (isPrelaunch()) {
        throw new Error('Le iscrizioni ai percorsi apriranno a breve.')
    }
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx vitest run src/app/actions/stripe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/stripe.ts src/app/actions/stripe.test.ts
git commit -m "feat(prelaunch): block checkout server-side"
```

### Task A.2: `BuyButton` → CTA Community in pre-lancio

**Files:**
- Modify: `src/components/BuyButton.tsx`

- [ ] **Step 1: Implementare il ramo pre-lancio**

In `src/components/BuyButton.tsx` aggiungere gli import:
```ts
import Link from 'next/link'
import { isPrelaunch } from '@/lib/prelaunch'
```
Subito dentro il componente, prima del `return`, aggiungere:
```ts
    // Pre-launch: no purchases. Funnel the user into the free Community.
    if (isPrelaunch()) {
        return (
            <Link
                href="/lezioni-gratis"
                className={className || "w-full inline-flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity rounded-full font-semibold px-4 py-2 min-h-[44px] text-sm md:text-base"}
            >
                Entra nella Community gratis
            </Link>
        )
    }
```

- [ ] **Step 2: Verifica build/lint**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/components/BuyButton.tsx
git commit -m "feat(prelaunch): BuyButton becomes Community CTA"
```

### Task A.3: Badge "In arrivo" su `/pacchetti`

**Files:**
- Modify: `src/app/pacchetti/page.tsx`

- [ ] **Step 1: Leggere il punto di rendering del prezzo/CTA**

Run: aprire `src/app/pacchetti/page.tsx` e individuare dove ogni pacchetto mostra prezzo/`BuyButton` (vicino al `line-clamp`/CollapsibleHtml visti nello spec).

- [ ] **Step 2: Aggiungere il badge condizionale**

In cima al file aggiungere:
```ts
import { isPrelaunch } from '@/lib/prelaunch'
```
Dove inizia il rendering della card del pacchetto (dentro il `.map`), aggiungere un badge prima del titolo/prezzo:
```tsx
{isPrelaunch() && (
  <span className="inline-block mb-2 rounded-full bg-[var(--accent)]/15 text-[var(--navy)] text-xs font-bold px-3 py-1">
    In arrivo
  </span>
)}
```
(`BuyButton` è già gestito dal Task A.2: in pre-lancio diventa la CTA Community.)

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/app/pacchetti/page.tsx
git commit -m "feat(prelaunch): 'In arrivo' badge on packages page"
```

---

## FASE B — Ciclo di vita lead (dopo 0.1)

### Task B.1: Lead senza scadenza in pre-lancio

**Contesto (verificato):** `lead_expires_at` NON è impostato dal trigger né dai metadata. È impostato
da `provisionLeadIfNeeded` in `src/app/auth/callback/route.ts:54-77` (al primo callback magic-link,
`now + 14 giorni`). Il fix va lì.

**Files:**
- Modify: `src/app/auth/callback/route.ts` (funzione `provisionLeadIfNeeded`, righe ~74-76)

- [ ] **Step 1: Implementare**

In `src/app/auth/callback/route.ts` aggiungere l'import in cima al file:
```ts
import { isPrelaunch } from '@/lib/prelaunch'
```
In `provisionLeadIfNeeded`, sostituire l'update finale della scadenza:
```ts
    await admin.from('profiles')
        .update({
            // Pre-launch: no expiry — Community access stays open until launch.
            lead_expires_at: isPrelaunch()
                ? null
                : new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        })
        .eq('id', userId)
```

> **Nota idempotenza:** la guardia `if (... || profile.lead_expires_at) return` (riga 64) salta se la
> scadenza è già impostata. In pre-lancio resta `null`, quindi la funzione può ri-eseguirsi a ogni
> login magic-link: l'upsert su `one_time_purchases` è idempotente (`ignoreDuplicates`) e ri-scrivere
> `null` è innocuo. Accettabile. (NON serve toccare `src/app/actions/lead.ts`: il trigger ignora
> comunque `lead_expires_at` dai metadata.)

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(prelaunch): leads provisioned without expiry"
```

### Task B.2: `LeadCountdownBanner` con copy Community

**Files:**
- Modify: `src/app/dashboard/lead/LeadCountdownBanner.tsx`

- [ ] **Step 1: Implementare il caso "nessuna scadenza"**

In `src/app/dashboard/lead/LeadCountdownBanner.tsx`, il caso attuale `if (expired || !expiry)` tratta `null` come "scaduto". Cambiare per distinguere `null` (= accesso aperto/Community) da scaduto. Sostituire il blocco di assegnazione `copy/Icon/tone` (righe ~29-45) con:
```ts
    let copy: string
    let Icon = Sparkles
    let tone: 'safe' | 'warn' | 'expired'

    if (!expiry) {
        // Pre-launch / extended access: no countdown, warm Community message.
        copy = 'Sei nella Community Fit&Smile 💛 — nuovi contenuti gratuiti ogni due settimane.'
        Icon = Sparkles
        tone = 'safe'
    } else if (expired) {
        copy = 'Il tuo accesso a Lezioni Gratis è scaduto. Completa la registrazione per riprenderlo.'
        Icon = AlertTriangle
        tone = 'expired'
    } else if (daysLeft <= 3) {
        copy = `Ti restano ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}: imposta una password per non perdere l'accesso ai video.`
        Icon = Clock
        tone = 'warn'
    } else {
        copy = `Hai ${daysLeft} giorni rimanenti. Completa la registrazione per conservare l'accesso e sbloccare tutto Fit&Smile.`
        Icon = Sparkles
        tone = 'safe'
    }
```
Inoltre, quando non c'è scadenza, il CTA "Completa profilo →" resta utile (consente comunque l'upgrade gratuito), quindi **lasciarlo invariato**.

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/lead/LeadCountdownBanner.tsx
git commit -m "feat(prelaunch): Community banner when access has no expiry"
```

---

## FASE C — Iscrizione email & disiscrizione (dopo 0.1)

### Task C.1: Helper `setEmailSubscription` / `getEmailSubscribed`

**Files:**
- Modify: `src/lib/marketing-consent.ts`
- Test: `src/lib/marketing-consent.test.ts`

- [ ] **Step 1: Scrivere il test**

Aggiungere in `src/lib/marketing-consent.test.ts` (creare il file se assente; mock di un client supabase minimale che cattura l'update):

```ts
import { describe, it, expect, vi } from 'vitest'
import { setEmailSubscription } from './marketing-consent'

function mockAdmin() {
  const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return { admin: { from: vi.fn(() => ({ update })) }, update }
}

describe('setEmailSubscription', () => {
  it('unsubscribe → setta email_unsubscribed_at e azzera marketing_consent_at', async () => {
    const { admin, update } = mockAdmin()
    await setEmailSubscription(admin as never, 'u1', false)
    const payload = update.mock.calls[0][0]
    expect(payload.email_unsubscribed_at).toBeTypeOf('string')
    expect(payload.marketing_consent_at).toBeNull()
  })
  it('subscribe → azzera email_unsubscribed_at', async () => {
    const { admin, update } = mockAdmin()
    await setEmailSubscription(admin as never, 'u1', true)
    const payload = update.mock.calls[0][0]
    expect(payload.email_unsubscribed_at).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx vitest run src/lib/marketing-consent.test.ts`
Expected: FAIL ("setEmailSubscription is not a function").

- [ ] **Step 3: Implementare**

In `src/lib/marketing-consent.ts` aggiungere (dopo `setMarketingConsent`):
```ts
/**
 * Master email subscription switch backed by profiles.email_unsubscribed_at.
 * subscribe=false → unsubscribed now + clear marketing consent (one off-switch
 * for all bulk email). subscribe=true → re-subscribe. Transactional email is
 * never gated by this.
 */
export async function setEmailSubscription(
    admin: SupabaseClient,
    userId: string,
    subscribe: boolean,
): Promise<void> {
    await admin
        .from('profiles')
        .update(
            subscribe
                ? { email_unsubscribed_at: null }
                : { email_unsubscribed_at: new Date().toISOString(), marketing_consent_at: null },
        )
        .eq('id', userId)
}

/** True if the user currently receives bulk email (email_unsubscribed_at IS NULL). */
export async function getEmailSubscribed(
    client: SupabaseClient,
    userId: string,
): Promise<boolean> {
    const { data } = await client
        .from('profiles')
        .select('email_unsubscribed_at')
        .eq('id', userId)
        .single()
    return !data?.email_unsubscribed_at
}
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx vitest run src/lib/marketing-consent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing-consent.ts src/lib/marketing-consent.test.ts
git commit -m "feat: email subscription master switch helpers"
```

### Task C.2: `/api/unsubscribe` setta `email_unsubscribed_at`

**Files:**
- Modify: `src/app/api/unsubscribe/route.ts`

- [ ] **Step 1: Sostituire la chiamata di consenso**

In `src/app/api/unsubscribe/route.ts` cambiare l'import:
```ts
import { verifyUnsubscribeToken, setEmailSubscription } from '@/lib/marketing-consent'
```
e nella funzione `unsubscribe`, sostituire `await setMarketingConsent(admin, userId, false)` con:
```ts
        await setEmailSubscription(admin, userId, false)
```

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/unsubscribe/route.ts
git commit -m "feat: unsubscribe sets master email switch"
```

### Task C.3: `gdpr.ts` → stato iscrizione email

**Files:**
- Modify: `src/app/actions/gdpr.ts`

- [ ] **Step 1: Sostituire le funzioni consenso**

In `src/app/actions/gdpr.ts`:
- import: cambiare `import { setMarketingConsent } from "@/lib/marketing-consent"` in
  `import { setEmailSubscription, getEmailSubscribed } from "@/lib/marketing-consent"`.
- Sostituire `getMarketingConsent` e `updateMarketingConsent` con:
```ts
export async function getEmailSubscribed(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { getEmailSubscribed: read } = await import('@/lib/marketing-consent')
  return read(supabase, user.id)
}

export async function updateEmailSubscribed(subscribe: boolean): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Non autorizzato' }
  const admin = await createServiceRoleClient()
  await setEmailSubscription(admin, user.id, subscribe)
  return { ok: true, data: undefined }
}
```
> Naming: rinominiamo da `getMarketingConsent/updateMarketingConsent` a `getEmailSubscribed/updateEmailSubscribed`. Il consumer (`ProfileSection`) viene aggiornato nel Task C.4. (L'import-aliasing interno evita il conflitto col re-export.) In alternativa importare `getEmailSubscribed as readSub` in cima e usarlo, senza dynamic import.

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit`
Expected: errori solo in `ProfileSection.tsx` (consumer da aggiornare nel prossimo task) — accettabile finché C.4 non è fatto. Se si lavora in TDD stretto, fare C.3 e C.4 nello stesso commit.

- [ ] **Step 3: Commit (insieme a C.4)**

(Vedi C.4 per il commit unico.)

### Task C.4: Toggle Profilo → iscrizione email

**Files:**
- Modify: `src/app/dashboard/ProfileSection.tsx`

- [ ] **Step 1: Aggiornare import e handler**

In `src/app/dashboard/ProfileSection.tsx`:
- import: `import { getEmailSubscribed, updateEmailSubscribed } from '@/app/actions/gdpr'` (al posto di `getMarketingConsent/updateMarketingConsent`).
- Rinominare lo stato `marketingConsent` → `emailSubscribed` (e `setMarketingConsent` locale → `setEmailSubscribed`), `consentSaving` → `subSaving` (oppure tenere i nomi e cambiare solo le chiamate). Aggiornare l'`useEffect` di caricamento per chiamare `getEmailSubscribed()`.
- `handleToggleMarketing` → `handleToggleSubscription(next: boolean)` che chiama `updateEmailSubscribed(next)` (stessa logica ottimistica + toast).

- [ ] **Step 2: Aggiornare la card**

Nella card "Email di marketing" (quella col toggle custom costruito di recente): cambiare la label in **"Email da Fit&Smile"** e il sotto-testo in *"Contenuti gratuiti e novità della Community. Le email di servizio sul tuo account arrivano comunque."* Il `button` toggle ora usa `emailSubscribed` / `handleToggleSubscription`.

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit (C.3 + C.4)**

```bash
git add src/app/actions/gdpr.ts src/app/dashboard/ProfileSection.tsx
git commit -m "feat: profile toggle controls Community email subscription"
```

---

## FASE D — Email Community via broadcast (dopo C; canale email del sistema esistente)

### Task D.1: `sendCommunityBatch` in `email.ts`

**Files:**
- Modify: `src/lib/email.ts`
- Test: `src/lib/email.test.ts`

- [ ] **Step 1: Scrivere il test**

Aggiungere in `src/lib/email.test.ts` (il file mocka già `resend`; estendere il mock per `batch.send`):
```ts
// nel vi.mock("resend", ...) aggiungere batch:
//   batch = { send: sendBatchMock }
// con: const { sendBatchMock } = vi.hoisted(() => ({ sendBatchMock: vi.fn().mockResolvedValue({ data: {}, error: null }) }))

import { sendCommunityBatch } from './email'

describe('sendCommunityBatch', () => {
  it('costruisce un messaggio per destinatario con disiscrizione', async () => {
    await sendCommunityBatch(
      [{ email: 'a@e.com', name: 'Mara', unsubscribeUrl: 'https://x/api/unsubscribe?token=t1' }],
      'Nuovo video',
      'È uscito un nuovo allenamento.',
      'https://x/dashboard',
      'GUARDA ORA',
    )
    expect(sendBatchMock).toHaveBeenCalledOnce()
    const messages = sendBatchMock.mock.calls[0][0]
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe('a@e.com')
    expect(messages[0].subject).toBe('Nuovo video')
    expect(messages[0].html).toContain('Disiscriviti')
    expect(messages[0].headers['List-Unsubscribe']).toContain('token=t1')
  })
})
```

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx vitest run src/lib/email.test.ts`
Expected: FAIL ("sendCommunityBatch is not a function").

- [ ] **Step 3: Implementare**

In `src/lib/email.ts` aggiungere (dopo `sendLeadReminderT20Email`, dove `emailLayout`/`button`/`marketingFooter`/`unsubscribeHeaders` sono in scope):
```ts
function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Community newsletter to ≤100 recipients in one Resend Batch call. Each message
 * carries its own unsubscribe link + List-Unsubscribe headers. bodyText is plain
 * text (admin-authored): escaped and newline-to-<br>.
 */
export async function sendCommunityBatch(
    recipients: Array<{ email: string; name: string; unsubscribeUrl: string }>,
    subject: string,
    bodyText: string,
    ctaUrl?: string,
    ctaLabel?: string,
) {
    const bodyHtml = `<p style="color:#555;font-size:15px;line-height:1.7;">${escapeHtml(bodyText).replace(/\n/g, '<br>')}</p>`
    const messages = recipients.map((r) => ({
        from: FROM_EMAIL,
        to: r.email,
        subject,
        html: emailLayout(`
            <h2 style="margin:0 0 16px;color:#2a2e30;font-size:22px;">Ciao ${escapeHtml(r.name) || 'cara'}!</h2>
            ${bodyHtml}
            ${ctaUrl ? button(ctaLabel || 'SCOPRI', ctaUrl) : ''}
            ${marketingFooter(r.unsubscribeUrl)}
        `),
        headers: unsubscribeHeaders(r.unsubscribeUrl),
    }))
    return resend.batch.send(messages)
}
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx vitest run src/lib/email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat: sendCommunityBatch (Resend batch newsletter)"
```

### Task D.2: Schema broadcast — target `lead` + `emailBody`

**Files:**
- Modify: `src/app/actions/admin_actions/broadcasts.schemas.ts`

- [ ] **Step 1: Aggiornare lo schema**

Sostituire il contenuto di `broadcasts.schemas.ts` con:
```ts
// src/app/actions/admin_actions/broadcasts.schemas.ts
import { z } from "zod"

export const broadcastSchema = z.object({
  title: z.string().trim().min(3, "Titolo min 3 caratteri").max(80, "Titolo max 80 caratteri"),
  body: z.string().trim().min(5, "Messaggio min 5 caratteri").max(150, "Messaggio max 150 caratteri"),
  // Optional longer text used only by the email channel (newsletter body).
  emailBody: z.string().trim().max(2000).optional(),
  url: z.string().startsWith("/", "URL deve iniziare con /").max(200),
  targetType: z.enum(["all", "package", "level", "lead"]),
  targetId: z.string().uuid().optional(),
  channels: z.object({
    inApp: z.boolean(),
    push: z.boolean(),
    email: z.boolean().default(false),
  }),
}).refine(
  (d) => d.targetType === "all" || d.targetType === "lead" || !!d.targetId,
  { message: "targetId richiesto quando targetType è 'package' o 'level'", path: ["targetId"] },
)

export type BroadcastInput = z.infer<typeof broadcastSchema>
```
(Title max alzato a 80 per oggetti email più descrittivi; `lead` non richiede targetId.)

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore (gli usi esistenti restano validi).

- [ ] **Step 3: Commit (insieme a D.3)**

### Task D.3: Canale email + target lead in `sendBroadcast`

**Files:**
- Modify: `src/app/actions/admin_actions/broadcasts.ts`
- Test: `src/app/actions/admin_actions/broadcasts.test.ts` (creare se assente)

- [ ] **Step 1: Scrivere il test**

Creare/estendere `src/app/actions/admin_actions/broadcasts.test.ts`. Mockare `@/utils/supabase/server` (admin client che per `from('profiles').select(...).eq('account_type','lead')...` ritorna lead con email), `@/lib/email` (`sendCommunityBatch`), `@/lib/marketing-consent` (`buildUnsubscribeUrl`), e l'admin-check. Asserzione chiave:
```ts
it('canale email: invia solo ai lead iscritti via sendCommunityBatch', async () => {
  // arrange: due lead, uno con email_unsubscribed_at != null
  // act: sendBroadcast({ targetType:'lead', channels:{inApp:false,push:false,email:true}, title, body, emailBody, url })
  // assert: sendCommunityBatch chiamato con un solo destinatario (l'iscritto)
  expect(sendCommunityBatch).toHaveBeenCalledOnce()
  expect(sendCommunityBatch.mock.calls[0][0]).toHaveLength(1)
})
```
(Modellare i mock sullo stile di `lead-reminders/route.test.ts`.)

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `npx vitest run src/app/actions/admin_actions/broadcasts.test.ts`
Expected: FAIL (canale email non implementato).

- [ ] **Step 3: Implementare**

In `src/app/actions/admin_actions/broadcasts.ts`:

3a. Import in cima:
```ts
import { sendCommunityBatch } from "@/lib/email"
import { buildUnsubscribeUrl } from "@/lib/marketing-consent"
```

3b. In `resolveRecipientIds`, aggiungere il ramo `lead` prima del `// level`:
```ts
  if (input.targetType === "lead") {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("account_type", "lead")
      .is("email_unsubscribed_at", null)
    return (data ?? []).map((r) => r.id as string)
  }
```

3c. In `sendBroadcast`, dopo il blocco push, aggiungere il canale email:
```ts
  let emailSent = 0
  if (parsed.channels.email) {
    const { data: recips } = await admin
      .from("profiles")
      .select("id, email, full_name, email_unsubscribed_at")
      .in("id", ids)
      .is("email_unsubscribed_at", null)
      .not("email", "is", null)
    const list = (recips ?? []) as Array<{ id: string; email: string; full_name: string | null }>
    if (list.length > 0) {
      const recipients = await Promise.all(
        list.map(async (r) => ({
          email: r.email,
          name: r.full_name ?? "",
          unsubscribeUrl: await buildUnsubscribeUrl(r.id),
        })),
      )
      // Resend batch caps at 100 per call; chunk for safety.
      for (let i = 0; i < recipients.length; i += 100) {
        await sendCommunityBatch(
          recipients.slice(i, i + 100),
          parsed.title,
          parsed.emailBody ?? parsed.body,
          parsed.url.startsWith("/") ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.fitandsmile.it"}${parsed.url}` : parsed.url,
          "SCOPRI",
        )
      }
      emailSent = recipients.length
    }
  }
```

3d. Aggiornare il tipo di ritorno e l'oggetto `data` per includere `emailSent`:
```ts
// firma:
export async function sendBroadcast(input: BroadcastInput): Promise<ActionResult<{
  recipients: number
  inApp: number
  pushSent: number
  pushSkipped: number
  pushFailed: number
  emailSent: number
}>> {
// return finale:
  return { ok: true, data: { recipients: ids.length, inApp, pushSent, pushSkipped, pushFailed, emailSent } }
```

> Nota validazione: oggi `handleSend` UI richiede almeno inApp o push. Per i lead vogliamo email-only — l'UI viene aggiornata in D.4 per accettare email come canale valido.

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `npx vitest run src/app/actions/admin_actions/broadcasts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (D.2 + D.3)**

```bash
git add src/app/actions/admin_actions/broadcasts.ts src/app/actions/admin_actions/broadcasts.schemas.ts src/app/actions/admin_actions/broadcasts.test.ts
git commit -m "feat: broadcast email channel + Community(lead) target"
```

### Task D.4: UI AdminBroadcasts — abilita email + target Community

**Files:**
- Modify: `src/app/admin/AdminBroadcasts.tsx`

- [ ] **Step 1: Estendere i tipi e i target**

- `type TargetType = 'all' | 'package' | 'level' | 'lead'`.
- Aggiungere un `TargetButton` "Community" (icona `Users` o `Megaphone`) che setta `targetType('lead')`.
- Aggiornare `confirmSend` per mostrare anche `emailSent` nel toast.

- [ ] **Step 2: Abilitare il canale email**

Sostituire il `ChannelToggle` disabilitato:
```tsx
<ChannelToggle checked={channels.email} onChange={(v) => setChannels({ ...channels, email: v })} label="Email" />
```
Aggiungere uno stato `emailBody` e una `textarea` (mostrata solo se `channels.email`) con `maxLength={2000}`, passata in `sendBroadcast({ ..., emailBody })`.

- [ ] **Step 3: Rilassare la validazione canali**

In `handleSend`, cambiare il check "almeno in-app o push" in "almeno un canale tra in-app, push, email":
```ts
if (!channels.inApp && !channels.push && !channels.email) {
  toast.error('Abilita almeno un canale'); return
}
```
E in `countBroadcastRecipients`/`resolveRecipientIds` il target `lead` è già gestito (D.3); il contatore funziona perché `resolveRecipientIds` ritorna gli id lead.

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit` ; `npm run lint`
Expected: nessun errore sui file toccati.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/AdminBroadcasts.tsx
git commit -m "feat(admin): enable email channel + Community target in broadcasts"
```

---

## FASE E — PWA update prompt (indipendente)

### Task E.1: `PWAUpdatePrompt`

**Files:**
- Create: `src/components/PWAUpdatePrompt.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Implementare il componente**

```tsx
// src/components/PWAUpdatePrompt.tsx
'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Shows a one-shot "new version available" toast after a real deploy.
 * Armed only if a SW already controls the page (skips first install).
 * Triggered by `controllerchange`, which only fires when a new SW takes
 * control — i.e. only after an actual deploy. A per-session guard prevents
 * repeats/loops. The user reloads on their terms (no forced reload → no
 * interrupted video).
 */
export default function PWAUpdatePrompt() {
    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
        // Skip the very first install (no controller yet = not an update).
        if (!navigator.serviceWorker.controller) return

        let shown = false
        const onChange = () => {
            if (shown) return
            shown = true
            toast('È disponibile una nuova versione', {
                description: 'Aggiorna per usare le novità.',
                duration: Infinity,
                action: { label: 'Aggiorna', onClick: () => window.location.reload() },
            })
        }
        navigator.serviceWorker.addEventListener('controllerchange', onChange)
        return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
    }, [])

    return null
}
```

- [ ] **Step 2: Montare nel layout**

In `src/app/layout.tsx`, aggiungere l'import e montarlo accanto a `CookieBanner`:
```tsx
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
// ...nel body, dopo <CookieBanner />:
        <PWAUpdatePrompt />
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/components/PWAUpdatePrompt.tsx src/app/layout.tsx
git commit -m "feat(pwa): one-shot update-available toast"
```

---

## FASE F — Copy & env (indipendente)

### Task F.1: Copy Community sul form lead

**Files:**
- Modify: `src/app/lezioni-gratis/LeadCaptureForm.tsx`

- [ ] **Step 1: Aggiornare la headline/sottotesto**

Individuare il titolo/sottotitolo del form (sopra i campi). Aggiornare la copy a:
- Titolo: **"Inizia il tuo viaggio ed entra nella Community Fit&Smile"**
- Sottotesto: *"Riceverai subito i 3 video del Rituale della Leggerezza e, ogni due settimane, nuovi contenuti gratuiti. Ti avviseremo quando partiranno i percorsi completi."*

(Se questi testi vivono in un componente padre della pagina `lezioni-gratis/page.tsx`, aggiornarli lì; il punto è che la copy comunichi la continuità dei contenuti, base della cornice legale "servizio".)

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/lezioni-gratis/LeadCaptureForm.tsx
git commit -m "feat(prelaunch): Community copy on lead form"
```

### Task F.2: `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Aggiungere la variabile**

Aggiungere in `.env.example`, in una sezione coerente (es. vicino a `NEXT_PUBLIC_MAINTENANCE_MODE`):
```
# Pre-launch mode: 'true' disables purchases and runs the Community funnel.
# Flip to false (with Stripe live keys) at go-live.
NEXT_PUBLIC_PRELAUNCH_MODE=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): NEXT_PUBLIC_PRELAUNCH_MODE"
```

---

## FASE G — Regressione finale

### Task G.1: Suite verde

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errori (warning preesistenti TAB_ORDER tollerati).

- [ ] **Step 3: Test**

Run: `npx vitest run`
Expected: tutti verdi (≥166 preesistenti + i nuovi: prelaunch, marketing-consent, email batch, stripe guard, broadcasts email).

- [ ] **Step 4: Smoke manuale con flag ON**

Mettere `NEXT_PUBLIC_PRELAUNCH_MODE=true` in `.env.local`, `npm run dev`, e verificare il piano di test §14 dello spec.

- [ ] **Step 5: Commit (se restano fix)**

```bash
git add -A && git commit -m "chore(prelaunch): regression fixes"
```

---

## Self-review (copertura spec)

- §3 flag → Task 0.2, A.1, A.2 ✅
- §4 acquisti spenti (server+UI) → A.1 (server), A.2 (UI), A.3 (badge) ✅
- §5 Community/consenso → copy F.1; cornice legale è copy + nessuna waitlist (rimossa) ✅
- §6 livelli email + disiscrizione (email_unsubscribed_at) → 0.1, C.1–C.4, D.1–D.4 ✅
- §7 lifecycle (expiry null) + nurture via broadcast → B.1, B.2, D.* ✅
- §8 PWA toast → E.1 ✅
- §9 go-live: flip flag (helper già condizionato ovunque); email di lancio = un broadcast email al target Community → D.* ✅
- §10 migrazione + env → 0.1, F.2 ✅
- §11 file → coperti; il "compositore" è l'estensione di AdminBroadcasts (nota in testa) ✅

**Punti di attenzione segnalati nei task:**
- B.1 (verificato): `lead_expires_at` è impostato in `provisionLeadIfNeeded` (callback), non nel trigger né nei metadata → il fix è nel callback. Nessuna micro-migrazione al trigger necessaria.
- C.3/C.4 vanno committati insieme (rinomina funzioni + consumer).
- D.3 il canale email rispetta `email_unsubscribed_at` anche per target diversi da `lead` (filtro esplicito).

**Type consistency:** `setEmailSubscription`/`getEmailSubscribed` (C.1) usati coerentemente in C.2/C.3; `sendCommunityBatch(recipients, subject, bodyText, ctaUrl?, ctaLabel?)` (D.1) chiamato con la stessa firma in D.3; `BroadcastInput` esteso con `emailBody`/`lead` (D.2) usato in D.3/D.4.
