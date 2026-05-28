# Lead Magnet — "Rituale della Leggerezza" (3 video gratis via magic link)

## Context

Rita Zanicchi pubblica contenuti TikTok per il brand Fit&Smile. Vogliamo trasformare il traffico TikTok in lead qualificati offrendo **3 video gratuiti (il "Rituale della Leggerezza")** in cambio di nome + email. Il lead diventa un utente Supabase a tutti gli effetti, atterra in una variante limitata della dashboard, può consumare i 3 video, guadagna uno stamp sul passaporto digitale, e — al termine di una finestra di 14 giorni — è spinto a completare la registrazione impostando una password.

Questa feature si incastra dentro `rita-landing` senza app standalone, riusando l'intera infrastruttura esistente (Supabase auth/profiles/RLS, Bunny Stream, Stripe-non-toccato, Resend, dashboard, badge/passaporto). L'unico spostamento architetturale è una pulizia del componente `DashboardClient` (oggi monolitico) e la migrazione del flow auth email-driven da PKCE a `token_hash` per garantire affidabilità dei magic link (di cui beneficia anche il fix del task auth correntemente in pausa).

Outcome atteso:
- Pagina `/lezioni-gratis` ad alta conversione, replica fedele del mock Canva del designer.
- Funnel TikTok → email → magic link → dashboard lead → upgrade a standard.
- Misurabile lato admin con KPI di conversione e funnel grafico.
- Nurture automatico via mail a T+10 e T+20.
- GDPR-compliant Italia (doppio consenso esplicito).

---

## Decisioni di design (recap)

| # | Decisione | Scelta |
|---|---|---|
| 1 | Distinzione lead vs standard | `profiles.account_type` enum esplicito (`'lead' \| 'standard'`), upgrade quando lead imposta la password |
| 2 | Accesso ai 3 video gratis in DB | Pacchetto "Lezioni Gratis" + riga `one_time_purchases(status='lead', amount=0)` inserita automaticamente al primo callback magic link |
| 3 | Magic link / conferma email | `token_hash` flow universale (no PKCE per email-driven auth), sblocca anche il task auth in pausa |
| 4 | Lead dashboard | Estrazione `<DashboardShell>` condiviso + `<LeadDashboardClient>` separato da `<StandardDashboardClient>` su stessa rotta `/dashboard` |
| 5 | Edge case "email già esistente" | Magic link spedito sempre (default `signInWithOtp`); per utenti standard esistenti diventa passwordless re-login; nessun grant lead per chi non è nuovo |
| 6 | Lead access expiry | `profiles.lead_expires_at = now() + 14 days` al primo magic link; dopo, magic link valido ma video invisibili; upgrade a standard rende accesso perpetuo |
| 7 | Reminder automatici | Cron giornaliero, mail a **T+10** (mid-trial urgency) e **T+20** (post-expiry recovery); idempotency flag dedicati |
| 8 | Route + isolamento | Pagina dedicata `/lezioni-gratis` senza top nav + ribbon CTA sulla landing principale |
| 9 | Design UI | Replica fedele del mock Canva del designer (PDF: `Landing Video Gratuiti/Home.pdf`) |
| 10 | Upsell UX | Banner sticky con countdown + Profile hero card + modal di upgrade (single password field + HIBP), confetti+toast post-upgrade, `router.refresh` cambia variant dashboard |
| 11 | Anti-abuso | Solo rate-limit Upstash (1/email/ora, 5/IP/giorno), niente blocklist temp-mail per MVP |
| 12 | GDPR | Doppio consenso esplicito: operativo (obbligatorio) + marketing (opzionale, gate per i reminder) |
| 13 | Tracking | Nessuno per MVP — TikTok Pixel/GA4 deferred a phase 2 |

---

## Architettura

### Data model

Nuova migrazione `supabase/20260528_10_lead_magnet.sql`:

```sql
BEGIN;

-- 1. account_type enum + colonne nuove su profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('lead', 'standard');
    END IF;
END $$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS lead_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS upgraded_from_lead_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_source text,
    ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_reminder_t10_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_reminder_t20_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS completion_modal_shown_at timestamptz;

-- Flag su packages per nascondere il pacchetto "Lezioni Gratis" dalla Discover
-- normale (lead lo riceve via grant automatico, standard non deve poterlo
-- acquistare). I callsite di getContentHierarchy/getPublicContentHierarchy
-- filtrano packages.hidden_from_discover=false.
ALTER TABLE public.packages
    ADD COLUMN IF NOT EXISTS hidden_from_discover boolean NOT NULL DEFAULT false;

-- 2. handle_new_user va aggiornata per leggere account_type, lead_source,
-- marketing_consent_at da raw_user_meta_data
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

-- 3. Indice per cron lead-reminders e admin KPI
CREATE INDEX IF NOT EXISTS idx_profiles_lead_expires_at
    ON public.profiles(lead_expires_at)
    WHERE account_type = 'lead';

CREATE INDEX IF NOT EXISTS idx_profiles_upgraded_from_lead_at
    ON public.profiles(upgraded_from_lead_at)
    WHERE upgraded_from_lead_at IS NOT NULL;

COMMIT;
```

Dati aggiuntivi necessari (inseriti via admin panel o seed manuale, non automatico):
- Un pacchetto `packages` "Lezioni Gratis — Rituale della Leggerezza", `payment_mode='payment'`, `price=0`, `hidden_from_discover=true`, con `badge_type='leggerezza'` (nome definito da Rita).
- I 3 video Bunny associati a questo pacchetto.
- Env var `LEAD_MAGNET_PACKAGE_ID` settata all'ID del pacchetto (usata da callback per il grant automatico).

`getContentHierarchy()` e `getPublicContentHierarchy()` (`src/app/actions/content.ts`) vanno modificate per filtrare `packages.hidden_from_discover=false` nell'inner select dei package. Anche `getPassportStamps()` (`src/app/actions/user.ts:847`) andrà filtrato per non mostrare slot vuoti del passport per pacchetti hidden, eccetto se l'utente ha già guadagnato quel badge (allora lo stamp è guadagnato e va mostrato).

### Status filtro su `one_time_purchases`

Il valore `status='lead'` è NUOVO. Code che oggi filtra `status != 'refunded'` (vedi `src/app/actions/content.ts:54-59`, `src/app/actions/user.ts:372-373`, ecc.) continua a funzionare. Il nuovo valore va riconosciuto come "attivo" — la condizione `status != 'refunded'` è già permissiva. Nessuna modifica necessaria nei callsite esistenti, ma da verificare.

L'unica modifica al gating è: per i lead, **l'accesso al pacchetto "Lezioni Gratis" è condizionato anche al `lead_expires_at > now()`**. Implementato in `getContentHierarchy()`:

```ts
// In src/app/actions/content.ts
const { data: oneTime } = await supabase
    .from('one_time_purchases')
    .select('package_id, status')
    .eq('user_id', user.id)
    .neq('status', 'refunded')

const { data: profile } = await supabase
    .from('profiles')
    .select('account_type, lead_expires_at')
    .eq('id', user.id)
    .single()

const isLeadExpired = profile?.account_type === 'lead'
    && profile.lead_expires_at != null
    && new Date(profile.lead_expires_at) < new Date()

const purchasedIds = [
    ...activeSubIds,
    ...(oneTime || [])
        .filter(p => !(p.status === 'lead' && isLeadExpired))
        .map(p => p.package_id),
]
```

### Auth flow change: `token_hash` universale

Modifico `src/app/auth/callback/route.ts`:
- Detect `token_hash` + `type` (`signup`, `magiclink`, `email`, `recovery`) → chiama `supabase.auth.verifyOtp({type, token_hash})`. **Niente PKCE verifier richiesto**.
- Detect `code` (OAuth) → fallback al `exchangeCodeForSession` esistente.

Cambi richiesti in Supabase Dashboard → Authentication → Email Templates:
- "Confirm signup": URL diventa `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
- "Magic Link": URL diventa `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` *(ma poi useremo `auth.admin.generateLink` + Resend custom, vedi sotto, quindi il template Supabase non viene usato per i lead — lo aggiorniamo comunque per coerenza)*
- "Change Email Address" (per `type=email`): URL `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`

Welcome email idempotente in callback resta valida (claim atomico su `welcome_email_sent_at`). Per il flusso magic-link-lead, il welcome è la stessa cosa del primo `verifyOtp` riuscito.

### Server actions

#### `requestLeadMagicLink(formData)` — `src/app/actions/lead.ts` (file nuovo)

```ts
'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendLeadMagicLinkEmail } from '@/lib/email'
import { enforceRateLimit, leadFormLimiter, RateLimitError } from '@/lib/security/ratelimit'
import { validate, ValidationError } from '@/lib/security/validation'
import { leadFormSchema } from './lead.schemas'
import type { ActionResult } from '@/lib/security/types'

export async function requestLeadMagicLink(formData: FormData): Promise<ActionResult<void>> {
    let parsed
    try {
        parsed = validate(leadFormSchema, Object.fromEntries(formData))
    } catch (err) {
        if (err instanceof ValidationError) return { ok: false, message: 'Dati non validi', fieldErrors: err.fieldErrors }
        throw err
    }

    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

    try {
        await enforceRateLimit(leadFormLimiter('email'), `lead:email:${parsed.email}`)
        await enforceRateLimit(leadFormLimiter('ip'), `lead:ip:${ip}`)
    } catch (err) {
        if (err instanceof RateLimitError) return {
            ok: false,
            message: `Troppe richieste. Riprova tra ${err.retryAfter} secondi.`,
        }
        // fail-open su Upstash outage
    }

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
                marketing_consent_at: parsed.marketing_consent ? new Date().toISOString() : null,
            },
            redirectTo: `${siteUrl}/auth/callback`,
        },
    })

    if (error || !data.properties) {
        return { ok: false, message: 'Errore durante la generazione del link. Riprova.' }
    }

    const magicUrl = `${siteUrl}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`
    await sendLeadMagicLinkEmail(parsed.email, parsed.full_name, magicUrl)

    return { ok: true, data: undefined }
}
```

Schema in `src/app/actions/lead.schemas.ts`:
```ts
export const leadFormSchema = z.object({
    full_name: z.string().trim().min(2).max(100),
    email: emailSchema,
    terms_accepted: z.literal('on', { message: 'Devi accettare i termini' }),
    marketing_consent: z.literal('on').optional(),
    lead_source: z.string().optional(),
})
```

#### Callback: post-verify lead provisioning

In `src/app/auth/callback/route.ts`, dopo `verifyOtp` riuscita per `type=magiclink`:

```ts
const { data: profile } = await admin
    .from('profiles')
    .select('account_type, lead_expires_at')
    .eq('id', user.id)
    .single()

if (profile?.account_type === 'lead' && profile.lead_expires_at === null) {
    // Primo accesso del lead — provisioning idempotente:
    // 1. inserisce one_time_purchases(status='lead') solo se non esiste già
    //    (PK composta su user_id+package_id già garantita da unique constraint)
    // 2. setta lead_expires_at = now + 14gg
    const leadPackageId = process.env.LEAD_MAGNET_PACKAGE_ID
    if (leadPackageId) {
        await admin.from('one_time_purchases').upsert({
            user_id: user.id,
            package_id: leadPackageId,
            item_type: 'package',
            amount: 0,
            status: 'lead',
        }, { onConflict: 'user_id,package_id', ignoreDuplicates: true })
        await admin.from('profiles').update({
            lead_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        }).eq('id', user.id)
    }
}
```

Nota: se `one_time_purchases` non ha già un unique constraint su `(user_id, package_id)`, va aggiunto in migrazione separata o nella stessa. Verificare nel passaggio di implementazione.

`LEAD_MAGNET_PACKAGE_ID` è una env var che punta al pacchetto "Lezioni Gratis" creato manualmente.

#### `upgradeLeadToStandard(formData)` — sempre in `src/app/actions/lead.ts`

```ts
export async function upgradeLeadToStandard(formData: FormData): Promise<ActionResult<void>> {
    // 1. validate (zod, single password field)
    // 2. assertPasswordNotLeaked
    // 3. supabase.auth.updateUser({password})
    // 4. update profile: account_type='standard', upgraded_from_lead_at=now(), lead_expires_at=null
    // 5. return ok → client fa router.refresh() + confetti
}
```

### Componenti UI

#### Landing `/lezioni-gratis`

Nuova rotta `src/app/lezioni-gratis/page.tsx` (server component, no SSG/SSR auth check). Layout senza top nav: niente `<Nav>`, niente `<Footer>` standard. Reuse `<SeoJsonLd>` per structured data.

Sotto-componenti (tutti in `src/app/lezioni-gratis/`):
- `LeadHero.tsx` — full-bleed bg image (asset Rita: `Landing Video Gratuiti/Home.pdf` → estraggo le 2 foto), headline "Non siamo qui per correre. Siamo qui per rinascere." con layout left-then-right shift, pill CTA con scroll-anchor `#form`.
- `LeadStepsPreview.tsx` — sezione bg `--bg`, headline navy "Tre passi verso il benessere", sottotitolo con grassetti selettivi, 3 thumbnail Bunny (server-fetched dal pacchetto Lezioni Gratis via `getLeadPackagePreview()` action).
- `LeadCaptureForm.tsx` — Client Component, react-hook-form + zodResolver, Sonner toast per errori, success state ("Controlla la tua email") che sostituisce il form. Input fields: nome, email, checkbox terms (obbligatorio), checkbox marketing (opzionale). Hidden field `lead_source='landing'`.
- `LeadTestimonials.tsx` — sezione bg `--bg`, headline navy con "menopausa" bold e "Fit&Smile" in font Caveat italic, 3 colonne testimonial con copy dal PDF (verbatim).
- `LeadLandingFooter.tsx` — versione minimal di `<Footer>`, solo link a /privacy e /terms.

Le foto del designer (`Landing Video Gratuiti/*.jpg` o `.png`) vanno spostate in `public/lead-magnet/`. Le 3 thumbnail dei video le genera Bunny Stream automaticamente; il componente le pesca via `BUNNY_LIBRARY_ID`.

#### Ribbon CTA sulla landing principale

Aggiungo un `<LeadMagnetRibbon>` in `src/components/sections/`, montato dentro `src/app/page.tsx` subito dopo `<Hero>` o sopra `<Faq>` (UX da testare al momento dell'implementazione). Copy: "Inizia gratis con il Rituale della Leggerezza →" link a `/lezioni-gratis`.

#### Dashboard split

Refactor di `src/app/dashboard/`:
1. Estrai `<DashboardShell>` da `<DashboardClient>` — contiene `<DashboardSidebar>`, `<ThemeContext>` provider, layout container.
2. Rinomina l'attuale `<DashboardClient>` in `<StandardDashboardClient>`. Logica invariata.
3. Crea `<LeadDashboardClient>` — solo Library + Profile, sticky banner countdown in cima.
4. `src/app/dashboard/page.tsx` legge `profiles.account_type` server-side e renderizza la variant giusta dentro lo Shell:
   ```tsx
   <DashboardShell isLead={profile.account_type === 'lead'}>
       {profile.account_type === 'lead'
           ? <LeadDashboardClient ... />
           : <StandardDashboardClient ... />}
   </DashboardShell>
   ```

#### Banner countdown + Profile upsell card + Modal upgrade

Tutto in `src/app/dashboard/lead/`:
- `LeadCountdownBanner.tsx` — sticky top, calcola days/hours rimanenti, varia copy + colore in base alla soglia (>3gg azzurro/orange leggero, ≤3gg arancione forte, scaduto rosso/navy con CTA "Riprendi"). Click → apre `UpgradeModal`.
- `LeadProfileUpsellCard.tsx` — montata in cima alla Profile section quando `account_type==='lead'`, con il copy "Conserva il tuo viaggio" + bullet di valore.
- `UpgradeModal.tsx` — Radix Dialog, single password field, `<PasswordStrengthMeter>`, inline errors (no toast nel modal), CTA "Completa →".
- `LeadCompletionModal.tsx` — modale celebrativa one-shot dopo completamento dei 3 video (`completion_modal_shown_at` come idempotency); auto-mounted se condizioni rispettate.

### Email layer

Aggiungo a `src/lib/email.ts`:

```ts
export async function sendLeadMagicLinkEmail(to: string, name: string, magicUrl: string) {
    const html = emailLayout(`
        <h2 style="...">Benvenuta su Rita Workout, ${name}!</h2>
        <p style="...">Ecco i tuoi 3 video gratuiti del <strong>Rituale della Leggerezza</strong>.</p>
        ${button('SBLOCCA ORA', magicUrl)}
        <p style="...">Hai <strong>14 giorni</strong> per accedere a Lezioni Gratis. Dopo, completi la registrazione (basta una password) per conservare l'accesso e sbloccare il resto del percorso Fit&Smile.</p>
    `)
    return resend.emails.send({ from: FROM_EMAIL, to, subject: 'I tuoi 3 video gratuiti sono pronti', html })
}

export async function sendLeadReminderT10Email(to: string, name: string, daysLeft: number) { ... }
export async function sendLeadReminderT20Email(to: string, name: string) { ... }
```

### Cron lead-reminders

Nuovo file `src/app/api/cron/lead-reminders/route.ts`. Pattern speculare a `trial-reminders`:

```ts
export async function GET(request: Request) {
    // Auth via header X-Cron-Secret
    const admin = await createServiceRoleClient()
    const now = new Date()

    // T+10: lead_expires_at - now < 4 days AND > 3 days, idempotent
    const t10Window = {
        from: new Date(now.getTime() + 3 * 86400000),
        to:   new Date(now.getTime() + 4 * 86400000),
    }
    const { data: t10Leads } = await admin
        .from('profiles')
        .select('id, email, full_name, lead_expires_at')
        .eq('account_type', 'lead')
        .is('lead_reminder_t10_sent_at', null)
        .not('marketing_consent_at', 'is', null)  // gate marketing
        .gte('lead_expires_at', t10Window.from.toISOString())
        .lt('lead_expires_at', t10Window.to.toISOString())

    for (const lead of t10Leads ?? []) {
        await sendLeadReminderT10Email(lead.email, lead.full_name, daysLeft(lead.lead_expires_at))
        await admin.from('profiles').update({ lead_reminder_t10_sent_at: now.toISOString() }).eq('id', lead.id)
    }

    // T+20: lead_expires_at + 6 days < now < lead_expires_at + 7 days, idempotent
    // (cioè 6 giorni dopo la scadenza), simmetrico al T+10 in window
    // ...

    return Response.json({ t10_sent: t10Leads?.length ?? 0 })
}
```

Schedulazione: `vercel.json` cron declaration daily at 09:00 Europe/Rome. Aggiungere il path al config del cron secret esistente.

### Admin

Nuova sezione `src/app/admin/AdminLeads.tsx` montata in `<DashboardClient>` come nuova tab "Lead". Layout:

- 4 KPI card (Lead attivi, Lead scaduti, Upgrade totali, Conversion rate)
- Sparkline 30gg per ogni KPI
- Funnel grafico stacked (Submission → Magic link consegnato → Primo login → Video completati → Upgrade)
- Tabella lead con filtri (status: attivi/scaduti/convertiti, ricerca per email, source)
- Azioni per riga: "Reinvia magic link", "Estendi finestra di 7gg" (admin override), "Invia promemoria custom"
- Bottone "Export CSV" — server action che restituisce un blob con tutti i lead filtrati

Server actions in `src/app/actions/admin_actions/leads.ts`:
- `getLeadKPIs()` — query aggregate per le card e sparkline
- `getLeadsList(filters)` — paginazione + filtri
- `resendLeadMagicLink(userId)` — reuse `auth.admin.generateLink` + Resend
- `extendLeadWindow(userId, days)` — `update profiles set lead_expires_at = lead_expires_at + interval`
- `exportLeadsCSV(filters)` — return CSV string

### Anti-abuso

In `src/lib/security/ratelimit.ts`, aggiungo:

```ts
export function leadFormLimiter(scope: 'email' | 'ip') {
    return new Ratelimit({
        redis,
        limiter: scope === 'email'
            ? Ratelimit.slidingWindow(1, '1h')   // 1 submit/email/ora
            : Ratelimit.slidingWindow(5, '24h'), // 5 submit/IP/giorno
        prefix: `rl:lead:${scope}`,
    })
}
```

Coarse IP limiter su `/api/*` esiste già; il lead form usa Server Actions quindi va su questo limiter dedicato.

### GDPR

Doppio consenso nel form (`<LeadCaptureForm>`):
- ☐ Accetto i [Termini](/terms) e la [Privacy Policy](/privacy) — `required`
- ☐ Voglio ricevere consigli, novità e offerte da Fit&Smile via email — opzionale, settato in `marketing_consent_at` come timestamp se spuntato

Sezione aggiunta a `/privacy` dedicata al funnel lead (chi siamo, cosa raccogliamo, retention 24 mesi se no upgrade poi cancellazione, come disiscriversi). Copy work ~30 min.

I cron reminder filtrano `WHERE marketing_consent_at IS NOT NULL` — chi consente solo all'operativo riceve solo il magic link iniziale, niente push commerciale.

---

## Effort breakdown

| Area | Effort |
|---|---|
| Migration SQL (account_type, colonne, indici, trigger update) | 1h |
| Pacchetto "Lezioni Gratis" + seed admin manuale | 0.5h (Rita work) |
| Token_hash flow nel callback + template Supabase | 1.5h |
| `requestLeadMagicLink` + schema + rate-limit | 2h |
| `generateLink` + sendLeadMagicLinkEmail Resend | 1h |
| Landing `/lezioni-gratis` (Hero, Steps, Form, Testimonials, Footer) | 5h |
| Ribbon sulla landing principale | 0.5h |
| Refactor DashboardShell + Standard/Lead variants | 3h |
| Banner countdown + Profile upsell card + UpgradeModal | 3h |
| `upgradeLeadToStandard` + confetti + toast | 1h |
| Completion modal one-shot post 3-video | 1h |
| Cron lead-reminders + 2 email Resend | 2h |
| Admin Leads view (KPI + funnel + tabella + export) | 5h |
| Privacy copy update | 0.5h |
| **Totale dev** | **~27h** |

Più: produzione contenuti Rita (3 video + foto), upload pacchetto, configurazione env var `LEAD_MAGNET_PACKAGE_ID`, edit template Supabase, setup vercel.json cron.

---

## Verifica end-to-end

Test sequenza al completamento:

1. **Migration**: applicare `20260528_10_lead_magnet.sql`. Verificare presenza colonne, enum, indici, trigger update.
2. **Seed**: creare il pacchetto "Lezioni Gratis" via admin, caricare i 3 video, settare `LEAD_MAGNET_PACKAGE_ID` env var.
3. **Auth token_hash**:
   - Signup email/password → email Supabase → click → atterra dashboard senza PKCE error.
   - Magic link `signInWithOtp` manuale → email Supabase → click → atterra dashboard.
4. **Lead flow happy path**:
   - Visita `/lezioni-gratis` → form name+email+consensi → submit → "Controlla la tua email".
   - Click magic link → atterra dashboard variant lead → Library mostra solo i 3 video.
   - DB: `profiles.account_type='lead'`, `lead_expires_at=now+14d`, `one_time_purchases(status='lead')` inserito.
   - Guarda i 3 video → badge "leggerezza" guadagnato → stamp sul passaporto.
   - Banner countdown visibile, copy "11 giorni rimanenti" (o simile).
5. **Lead upgrade**:
   - Click "Completa profilo" sul banner o card profilo → modal → password → submit.
   - DB: `account_type='standard'`, `upgraded_from_lead_at=now()`, `lead_expires_at=null`.
   - UI: `router.refresh` → ora vede `<StandardDashboardClient>` con tutte le tab.
   - Login successivo con email+password funziona.
6. **Lead expiry path**:
   - Manualmente `update profiles set lead_expires_at=now() - 1d where id=...`
   - Refresh dashboard → Library mostra "Accesso scaduto" overlay sul pacchetto Lezioni Gratis, banner copy aggressiva.
   - Upgrade → riprende accesso.
7. **Edge case email esistente standard**:
   - Su `/lezioni-gratis` inserisco mia mail già registrata come standard → magic link spedito → click → atterra dashboard standard come normale (no grant lead).
8. **Rate-limit**:
   - 2 submit consecutivi stessa email → 2° rifiutato con messaggio "Troppe richieste".
9. **Reminder cron**:
   - Simulare manualmente: `update profiles set lead_expires_at=now()+3d where id=...`
   - Trigger cron handler con `curl` → mail T+10 ricevuta, `lead_reminder_t10_sent_at` valorizzato, secondo trigger → no re-send (idempotency).
10. **Admin**:
    - Visita /admin/leads → KPI corretti, funnel grafico carica, tabella mostra il lead di test, export CSV scarica un file valido.
11. **GDPR**:
    - Submit senza spuntare terms → errore inline.
    - Submit senza marketing → utente creato ma `marketing_consent_at=null` → cron salta i reminder per lui.
12. **Regression**:
    - Login email/password esistente → invariato.
    - Login Google → invariato.
    - Acquisto Stripe → invariato.
    - Refund → invariato.

---

## Open / deferred

- TikTok Pixel / Meta CAPI / GA4: deferred a phase 2 dopo i primi numeri reali.
- Blocklist temp-mail domains: deferred, da attivare se osserveremo abuso.
- Reminder T+30: deferred, valuteremo dopo aver visto la curva di conversione.
- A/B testing del copy della landing: deferred.
- Re-engagement automation per chi ha fatto upgrade ma non ha mai comprato: out of scope (è un'altra feature, lead-magnet termina al primo magic link → upgrade).
