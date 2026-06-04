# Modalità Pre-Lancio — Design

> Stato: design approvato in brainstorming, in attesa di review utente.
> Data: 2026-06-04.

## 1. Contesto e obiettivo

Rita non avrà la P.IVA per circa 2 mesi → Stripe **non può andare live** (senza P.IVA non si può
emettere fattura, quindi non si può vendere come attività in Italia). Nel frattempo i contenuti
social sono già partiti e arriva forte interesse inbound.

**Obiettivo:** non sprecare il traffico caldo. Tenere acceso il funnel gratuito "Lezioni Gratis"
per assorbire l'interesse nella Community via email, **spegnere ogni possibilità di acquisto**
(vincolo legale, non solo opportuno) e riconvertire la Community al lancio. Tutto dietro un flag
unico, reversibile in un solo deploy quando si attiva Stripe.

## 2. Strategia in breve

- Funnel gratuito acceso, riformulato come ingresso nella **Community Fit&Smile** (non più "3 video
  una tantum" ma iscrizione a contenuti gratuiti continuativi via email).
- Acquisti **spenti** lato server (muro vero) e lato UI (i `BuyButton` diventano un invito a entrare
  nella Community).
- Accesso ai video **senza scadenza** durante il pre-lancio (niente pressione a convertire, perché
  non c'è nulla da comprare).
- Email **nurture** della Community (nuovi contenuti, conto alla rovescia al lancio) a tutti i lead
  iscritti.
- Al go-live: si spegne il flag insieme alle chiavi Stripe live; parte il **broadcast di lancio**
  alla Community; gli utenti PWA passano alla UI nuova grazie a un toast "aggiorna".

## 3. Il flag (spina dorsale)

Variabile d'ambiente `NEXT_PUBLIC_PRELAUNCH_MODE` (assente/`false` di default). Helper unico:

```ts
// src/lib/prelaunch.ts
export function isPrelaunch(): boolean {
  return process.env.NEXT_PUBLIC_PRELAUNCH_MODE === 'true'
}
```

Essendo `NEXT_PUBLIC_*` è leggibile **client e server**. Unica fonte di verità. Al go-live →
`false` nello stesso redeploy delle chiavi Stripe live. Nessun codice da rimuovere.

Scelta architetturale: env-var (approccio A) anziché toggle in DB (B). Il pre-lancio si spegne una
sola volta e coincide comunque con un redeploy (chiavi Stripe). Un toggle DB sarebbe infrastruttura
usata una volta sola.

## 4. Acquisti spenti (difesa in profondità)

**Lato server (il muro):** `createCheckoutSession` (`src/app/actions/stripe.ts`) all'inizio:
```ts
if (isPrelaunch()) {
  throw new Error('Le iscrizioni ai percorsi apriranno a breve.')
}
```
Anche una richiesta forgiata non può creare una sessione di pagamento. Questo è il punto
**legalmente critico**.

**Lato UI:** `src/components/BuyButton.tsx` — unico punto d'acquisto, usato in `/pacchetti`,
`DiscoverSection`, `PersonalView`, `LibrarySection`, `OneToOneSection`. In pre-lancio non mostra
"Sblocca/Abbonati" ma un CTA verso la Community:
- utente **non lead** → "Entra nella Community per essere avvisata" → `/lezioni-gratis`
- utente **già lead/standard** → stato informativo "Sei nella Community 💛 — ti avviseremo al lancio"

Tutti i punti d'acquisto si adeguano insieme perché passano da questo componente.

## 5. Community e modello di consenso

### 5.1 Riformulazione dell'offerta

Il lead magnet non è più "3 video gratis" ma **ingresso nella Community Fit&Smile**, dove le email
(video + aggiornamenti) **sono il servizio**. Copy d'iscrizione (headline approvata):

> "Inizia il tuo viaggio ed entra nella Community Fit&Smile — riceverai subito i 3 video del Rituale
> della Leggerezza e ogni due settimane nuovi contenuti gratuiti. Ti avviseremo quando partiranno i
> percorsi completi."

### 5.2 Base giuridica

Con questa cornice le email su nuovi contenuti gratuiti e annuncio lancio **non sono marketing
aggiunto: sono la consegna del servizio richiesto** dall'interessato → base **Art. 6(1)(b)**
(esecuzione di un servizio richiesto), non Art. 6(1)(a) consenso-marketing. Sparisce il problema
del "tying" (Art. 7(4) GDPR): non si condiziona nulla, l'email **è** il prodotto.

**Condizioni perché regga** (ePrivacy / art. 130 Codice Privacy):
1. Le email devono **davvero** consegnare contenuto/valore (nuovi video) — non vendita mascherata.
   Il piano di caricare nuovi video gratuiti è il fondamento legale, non un dettaglio.
2. Disiscrizione facile in ogni email (già implementata).
3. Trasparenza all'iscrizione (copy chiara + link privacy, già presenti).

**Confine:** le email coperte sono quelle "nel perimetro Community" (nuovi contenuti gratuiti,
annuncio lancio, consigli legati al percorso). Marketing **fuori perimetro** (sconti su prodotti
diversi, promo slegate) resta opt-in esplicito tramite un checkbox opzionale separato.

> Nota: NON ci si appoggia al "soft opt-in" (art. 130 c.4) perché richiede una vendita pregressa; un
> lead magnet gratuito non è una vendita e il Garante lo interpreta restrittivamente.

### 5.3 Niente waitlist per pacchetto

Conseguenza della cornice Community: **eliminata** ogni tabella/logica di waitlist per-pacchetto e
ogni consenso per-prodotto. L'annuncio di lancio è **un broadcast** a tutti i lead iscritti
(la Community), non una lista segmentata.

## 6. Architettura di consegna email e disiscrizione

Dimensionamento previsto: **≤ ~50 lead**. A questa scala **non serve** il prodotto Marketing/Broadcasts
di Resend: inviamo le email Community come **invii singoli** dal nostro codice
(`resend.batch.send`, fino a 100 destinatari per chiamata → un solo invio copre tutta la lista).
Una **sola fonte di verità** (il nostro DB), zero sincronizzazione esterna.

Quota: 50 lead × ~2 invii/mese ≈ 100 email/mese, dentro 3.000/mese e 100/giorno → headroom ampio.

| Livello | Esempi | Invio a | Disiscrivibile |
|---|---|---|---|
| **Transazionali** | magic link, ricevute, sicurezza, conferma cancellazione | sempre (codice nostro) | No (necessarie) |
| **Community** | nuovi video ogni 2 settimane, annuncio lancio | lead con `email_unsubscribed_at IS NULL` (batch send) | Sì |
| **Marketing ampio** | sconti/promo fuori perimetro (futuro) | `marketing_consent_at IS NOT NULL AND email_unsubscribed_at IS NULL` | Sì |

> Se un giorno la lista superasse ~1.000 contatti, si rivaluterebbe il passaggio a Resend Broadcasts
> (gratis/illimitati ma con Audience da sincronizzare). Oggi YAGNI.
> Sottodominio bulk (es. `community.fitandsmile.it`): non necessario a questo volume.

### 6.1 Composizione e invio (Rita autonoma, in-app)

Un **compositore nell'admin**: Rita scrive oggetto + testo, vede l'anteprima, "Invia alla Community" →
server action `sendCommunityEmail` che fa un `resend.batch.send` ai lead con `email_unsubscribed_at IS
NULL`, con footer disiscrizione + header `List-Unsubscribe` (infra già esistente). Niente dashboard
esterna, niente Audience da sincronizzare. Stesso meccanismo per l'annuncio di lancio.

### 6.2 Disiscrizione (interruttore master, solo DB)

`email_unsubscribed_at timestamptz` su `profiles` (null = iscritto) è l'**unico** interruttore master.
- **Link "Disiscriviti"** in ogni email Community (token, già implementato) + **one-click** RFC 8058
  → `src/app/api/unsubscribe/route.ts` setta `email_unsubscribed_at = now()` (e clear `marketing_consent_at`).
- **Toggle nel Profilo** (già costruito) → stessa colonna, relabellato "Email da Fit&Smile —
  contenuti gratuiti e novità".

**Cosa accade alla disiscrizione:**
1. niente più email Community/marketing (il send filtra `email_unsubscribed_at IS NULL`);
2. **continua** a ricevere le transazionali (necessarie);
3. **mantiene** l'accesso all'app e ai video (disiscrizione ≠ cancellazione account);
4. può **ri-iscriversi** dal toggle nel Profilo.

Niente webhook, niente Audience esterna, niente riconciliazione: una colonna, una verità.

Modifiche conseguenti:
- `src/app/dashboard/ProfileSection.tsx` — il toggle (costruito di recente) diventa l'interruttore
  master, backed da `email_unsubscribed_at`.
- `src/app/actions/gdpr.ts` — `getMarketingConsent`/`updateMarketingConsent` evolvono in get/set di
  `email_unsubscribed_at`.

> Gating del Livello 3 (marketing ampio) è **fuori scope** per il pre-lancio. `marketing_consent_at`
> resta registrato dal form per segmentazione futura.

## 7. Ciclo di vita lead + email Community

**Accesso esteso:** in pre-lancio i lead nascono con `lead_expires_at = null`. Il check di scadenza
esistente in `content.ts` è `account_type='lead' && lead_expires_at != null && lead_expires_at < now`
→ con `null` l'accesso non scade mai. I lead già esistenti vengono portati a `null` una tantum
(backfill).
- `src/app/actions/lead.ts` → quando `isPrelaunch()`, crea il lead con `lead_expires_at = null`.

**Banner countdown:** `src/app/dashboard/lead/LeadCountdownBanner.tsx` → con `lead_expires_at = null`
non mostra il conto alla rovescia ma un messaggio caldo: "Sei nella Community Fit&Smile 💛 — nuovi
contenuti ogni due settimane."

**Email Community (nurture):** composte da Rita nel compositore admin e inviate via
`sendCommunityEmail` (`resend.batch.send`) ai lead iscritti (§6.1). Disiscrizione solo DB (§6.2).
- Il cron `src/app/api/cron/lead-reminders/route.ts` in pre-lancio **non** invia i reminder "stai per
  scadere" (con expiry `null` le finestre non scattano comunque). Resta per i reminder transazionali
  post-lancio (es. fine trial). Nessuna logica Community nel cron.

## 8. PWA: aggiornamento al lancio

Config attuale (`next.config.mjs`) è update-friendly: `skipWaiting: true` + pagine `NetworkFirst`
(timeout 3s). Server actions mai cacheate → la guardia acquisti cambia all'istante per tutti.

**Polish "nuova versione → aggiorna" (one-shot garantito):** nuovo componente client
`src/components/PWAUpdatePrompt.tsx`, montato nel layout. Logica:
- Si arma **solo se** `navigator.serviceWorker.controller` esiste al load (salta il primo install).
- Ascolta `controllerchange` (scatta **solo** a fronte di un deploy reale).
- Flag `shown` per sessione → al massimo una volta per cambio-versione, niente loop.
- Mostra un **toast Sonner** "È disponibile una nuova versione · Aggiorna" con azione → `reload`.
  Non ricarica d'autorità (evita di interrompere un video).

Comportamento: niente all'apertura normale; niente al primo install; toast una sola volta dopo un
deploy reale.

## 9. Go-live (reversibilità)

Spegnere `NEXT_PUBLIC_PRELAUNCH_MODE` + chiavi Stripe live nello stesso deploy:
- `BuyButton` tornano d'acquisto; guardia `createCheckoutSession` disattivata dal flag.
- **Nuovi** lead tornano alla finestra 14 giorni; i lead "estesi" esistenti mantengono l'accesso
  (nessuno penalizzato al lancio).
- Parte l'**email di lancio**: Rita la compone nello stesso compositore admin ("I percorsi completi
  sono ora disponibili" + link) e la invia via `sendCommunityEmail` ai lead iscritti. Invio one-off
  manuale → nessun flag anti-duplicato necessario.
- Toast PWA porta gli utenti installati sulla UI di lancio.

## 10. Modifiche al modello dati (migrazione)

Nuova migrazione `supabase/20260604_12_prelaunch_mode.sql` (l'ultima è `20260603_11_sequential_unlock`):
- `ALTER TABLE public.profiles ADD COLUMN email_unsubscribed_at timestamptz;` (nullable, default null).
- Backfill opzionale: `UPDATE profiles SET lead_expires_at = NULL WHERE account_type = 'lead';`
  (estende i lead esistenti — verosimilmente nessun lead reale ancora).
- Allineare `supabase/triggers.sql` (seed bootstrap) con la nuova colonna.

Nessun'altra tabella nuova (waitlist eliminata).

**Nuove env:** solo `NEXT_PUBLIC_PRELAUNCH_MODE`. Da aggiungere a `.env.example`. (`RESEND_API_KEY`
già presente; nessuna env Audience/webhook con l'invio singolo.)

## 11. File da toccare

- **NEW** `src/lib/prelaunch.ts` — helper `isPrelaunch()`.
- **NEW** compositore Community nell'admin: pagina/componente + server action `sendCommunityEmail`
  (`resend.batch.send` ai lead iscritti, footer disiscrizione + List-Unsubscribe).
- **NEW** `src/components/PWAUpdatePrompt.tsx` — toast one-shot aggiornamento; montato in `layout.tsx`.
- **NEW** migrazione SQL + aggiornamento `supabase/triggers.sql`.
- `src/app/actions/stripe.ts` — guardia pre-lancio in `createCheckoutSession`.
- `src/components/BuyButton.tsx` — ramo pre-lancio → CTA Community.
- `src/app/actions/lead.ts` — `lead_expires_at = null` quando `isPrelaunch()`.
- `src/app/dashboard/lead/LeadCountdownBanner.tsx` — gestione `null`.
- `src/app/api/cron/lead-reminders/route.ts` — non invia reminder scadenza in pre-lancio (no logica Community).
- `src/lib/email.ts` — template email Community (riusa layout/footer/List-Unsubscribe esistenti).
- `src/app/api/unsubscribe/route.ts` — setta `email_unsubscribed_at` (solo DB).
- `src/app/dashboard/ProfileSection.tsx` — toggle = interruttore master iscrizione (solo DB).
- `src/app/actions/gdpr.ts` — get/update `email_unsubscribed_at`.
- `src/app/lezioni-gratis/LeadCaptureForm.tsx` — copy Community.
- `src/app/pacchetti/page.tsx` — badge "In arrivo" sui percorsi in pre-lancio (oltre al BuyButton).
- `.env.example` — `NEXT_PUBLIC_PRELAUNCH_MODE`.

## 12. Fuori scope (YAGNI)

- Waitlist per-pacchetto e consenso per-prodotto (eliminati dalla cornice Community).
- Toggle pre-lancio in DB con UI admin (basta env-var).
- Plumbing campagne marketing Livello 3 (gating differito; colonna `marketing_consent_at` solo
  registrata).
- Casting TV (rimosso dallo scope in precedenza).

## 13. Punti aperti / sign-off

- **Review legale rapida** della copy d'iscrizione Community (il Garante è rigoroso sul confine
  servizio vs marketing). Consigliato prima del go-live pubblico.
- Cadenza "ogni due settimane": dev'essere sostenibile da Rita; in alternativa copy più morbida
  ("regolarmente"). La solidità legale dipende dall'erogare davvero contenuto con continuità.
- P.IVA + indirizzo nella privacy policy: ultimo step, dati dal committente (già pianificato).
- **Setup Resend:** nessuno aggiuntivo — l'invio singolo usa `RESEND_API_KEY` già presente e il
  dominio `fitandsmile.it` già verificato ✅. (Audience/webhook rinviati a un'eventuale scala >1.000.)

## 14. Piano di test

- **Unit/integration:** guardia `createCheckoutSession` in pre-lancio (throw); `lead_expires_at = null`
  su creazione lead in pre-lancio; `sendCommunityEmail` invia solo ai lead con `email_unsubscribed_at
  IS NULL` (mock `resend.batch.send`); unsubscribe/toggle settano `email_unsubscribed_at`.
- **Manuale (flag ON):** `/pacchetti` e Discover mostrano CTA Community al posto degli acquisti;
  checkout bloccato anche via richiesta diretta; lead nuovo senza scadenza; banner Community; invio di
  prova dal compositore arriva agli iscritti e NON ai disiscritti; toggle Profilo disiscrive davvero;
  transazionali (magic link) ancora inviate.
- **Manuale (flag OFF, simulazione go-live):** BuyButton tornano; checkout funziona (test mode);
  email di lancio inviata dal compositore; toast PWA appare una sola volta dopo il "deploy".
- **Regressione:** lint, `npx tsc --noEmit`, `npx vitest run` verdi.
