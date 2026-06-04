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

Resend espone due prodotti con quote **distinte** sul piano free. Li usiamo come due canali separati:

| Livello | Esempi | Canale Resend | Quota free | Disiscrivibile |
|---|---|---|---|---|
| **Transazionali** | magic link, ricevute, sicurezza, conferma cancellazione | **Transactional** (`resend.emails.send`, codice nostro) | 3.000/mese · 100/giorno | No (necessarie) |
| **Community** | nuovi video ogni 2 settimane, annuncio lancio | **Broadcasts + Audiences** | Broadcasts **illimitati** · 1.000 contatti | Sì |
| **Marketing ampio** | sconti/promo fuori perimetro (futuro) | Broadcasts (segmento dedicato) | come sopra | Sì |

Le email Community **non** passano dal loop transazionale (così la quota dei magic link resta intatta)
ma da **Broadcasts**, gratis e illimitati. Rita può comporle e inviarle dalla dashboard Resend
(no-code) scegliendo l'audience Community, oppure si triggerano via Broadcast API.

> **Deliverability / sottodominio (consigliato, opzionale):** inviare i Broadcasts da un sottodominio
> dedicato (es. `community.fitandsmile.it`) e tenere il transazionale critico (magic link) sul dominio
> principale. Così un eventuale calo di reputazione del bulk non compromette l'arrivo dei magic link.
> Si aggiunge come dominio separato verificato in Resend. Non bloccante per partire.

### 6.1 Audience Community (sincronizzazione)

Una Audience Resend "Community" (id in env `RESEND_COMMUNITY_AUDIENCE_ID`). I lead vi sono sincronizzati
come contatti (chiave = email, nessun id da memorizzare):
- **Lead creato** → upsert contatto nell'Audience (iscritto). In `src/app/actions/lead.ts`.
- Helper dedicato `src/lib/resend-audience.ts` (add/update/unsubscribe contatto).

Cap 1.000 contatti sul free → avvicinandosi, valutare cleanup o piano.

### 6.2 Disiscrizione e riconciliazione (il punto delicato)

`email_unsubscribed_at timestamptz` su `profiles` (null = iscritto) è il **mirror locale** dello stato,
usato per la UI del Profilo e la logica app. La fonte autorevole per i Broadcasts è il campo
`unsubscribed` del contatto in Resend. Si tengono allineati nei due versi:

1. **Disiscrizione da una newsletter** (link gestito da Resend nel Broadcast) → Resend marca il
   contatto `unsubscribed` → **webhook** → `src/app/api/webhooks/resend/route.ts` (verifica firma
   Svix) → setta `email_unsubscribed_at = now()`.
2. **Disiscrizione/toggle dall'app** (Profilo, o link nostro) → server action: update contatto Resend
   `unsubscribed = true` **+** `email_unsubscribed_at = now()` (e clear `marketing_consent_at`).
3. **Ri-iscrizione dal toggle** → update contatto Resend `unsubscribed = false` + clear
   `email_unsubscribed_at`.

**Cosa accade alla disiscrizione:**
1. niente più email Community/marketing (Resend esclude il contatto dai Broadcasts);
2. **continua** a ricevere le transazionali (necessarie);
3. **mantiene** l'accesso all'app e ai video (disiscrizione ≠ cancellazione account);
4. può **ri-iscriversi** dal toggle nel Profilo.

Modifiche conseguenti:
- **NEW** `src/app/api/webhooks/resend/route.ts` — webhook unsubscribe → DB.
- **NEW** `src/lib/resend-audience.ts` — helper contatto Audience.
- `src/app/dashboard/ProfileSection.tsx` — il toggle (costruito di recente) diventa l'interruttore
  master "Email da Fit&Smile — contenuti gratuiti e novità", sincronizza Resend + DB.
- `src/app/actions/gdpr.ts` — `getMarketingConsent`/`updateMarketingConsent` evolvono in get/set dello
  stato master (Resend + `email_unsubscribed_at`).
- `src/app/api/unsubscribe/route.ts` — resta come fallback token-based (setta DB + Resend); il canale
  primario di disiscrizione Community è quello integrato nei Broadcasts Resend.

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

**Email Community (nurture):** vanno via **Resend Broadcasts** sull'Audience "Community" (§6), NON dal
nostro cron/loop. Rita le compone e invia dalla dashboard Resend (no-code), oppure si triggerano via
Broadcast API. Vantaggio: gratis/illimitate e fuori dalla quota transazionale; disiscrizione gestita
da Resend e riconciliata via webhook (§6.2).
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
- Parte il **broadcast di lancio**: un **Resend Broadcast** all'Audience Community ("I percorsi
  completi sono ora disponibili" + link), inviato da Rita dalla dashboard o via Broadcast API. Niente
  invio one-by-one né flag anti-duplicato nostro: Resend gestisce un Broadcast come invio singolo alla
  lista, rispettando le disiscrizioni.
- Toast PWA porta gli utenti installati sulla UI di lancio.

## 10. Modifiche al modello dati (migrazione)

Nuova migrazione `supabase/20260604_12_prelaunch_mode.sql` (l'ultima è `20260603_11_sequential_unlock`):
- `ALTER TABLE public.profiles ADD COLUMN email_unsubscribed_at timestamptz;` (nullable, default null).
- Backfill opzionale: `UPDATE profiles SET lead_expires_at = NULL WHERE account_type = 'lead';`
  (estende i lead esistenti — verosimilmente nessun lead reale ancora).
- Allineare `supabase/triggers.sql` (seed bootstrap) con la nuova colonna.

Nessun'altra tabella nuova (waitlist eliminata).

**Nuove env:** `NEXT_PUBLIC_PRELAUNCH_MODE`, `RESEND_COMMUNITY_AUDIENCE_ID`, `RESEND_WEBHOOK_SECRET`
(verifica firma del webhook Resend). Da aggiungere a `.env.example`.

## 11. File da toccare

- **NEW** `src/lib/prelaunch.ts` — helper `isPrelaunch()`.
- **NEW** `src/lib/resend-audience.ts` — helper add/update/unsubscribe contatto nell'Audience Community.
- **NEW** `src/app/api/webhooks/resend/route.ts` — webhook unsubscribe Resend → DB (verifica firma Svix).
- **NEW** `src/components/PWAUpdatePrompt.tsx` — toast one-shot aggiornamento; montato in `layout.tsx`.
- **NEW** migrazione SQL + aggiornamento `supabase/triggers.sql`.
- `src/app/actions/stripe.ts` — guardia pre-lancio in `createCheckoutSession`.
- `src/components/BuyButton.tsx` — ramo pre-lancio → CTA Community.
- `src/app/actions/lead.ts` — `lead_expires_at = null` quando `isPrelaunch()`; upsert contatto Audience.
- `src/app/dashboard/lead/LeadCountdownBanner.tsx` — gestione `null`.
- `src/app/api/cron/lead-reminders/route.ts` — non invia reminder scadenza in pre-lancio (no logica Community).
- `src/app/api/unsubscribe/route.ts` — setta `email_unsubscribed_at` + sync Resend (fallback token).
- `src/app/dashboard/ProfileSection.tsx` — toggle = interruttore master iscrizione (sync Resend + DB).
- `src/app/actions/gdpr.ts` — get/update stato iscrizione master (Resend + DB).
- `src/app/lezioni-gratis/LeadCaptureForm.tsx` — copy Community.
- `src/app/pacchetti/page.tsx` — badge "In arrivo" sui percorsi in pre-lancio (oltre al BuyButton).
- `.env.example` — nuove env (`NEXT_PUBLIC_PRELAUNCH_MODE`, `RESEND_COMMUNITY_AUDIENCE_ID`, `RESEND_WEBHOOK_SECRET`).
- (broadcast di lancio) composto/inviato da Rita in dashboard Resend, oppure via Broadcast API.

> Nota: i **template** delle email Community non vivono più in `src/lib/email.ts` (quello resta per le
> transazionali). Le newsletter si compongono in Resend Broadcasts.

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
- **Setup Resend (operativo, una tantum):** creare l'Audience "Community" e copiarne l'id
  (`RESEND_COMMUNITY_AUDIENCE_ID`); configurare il webhook unsubscribe + segreto firma
  (`RESEND_WEBHOOK_SECRET`); (opzionale) verificare il sottodominio bulk. Cap 1.000 contatti free.
- Dominio `fitandsmile.it` già verificato ✅ (confermato).

## 14. Piano di test

- **Unit/integration:** guardia `createCheckoutSession` in pre-lancio (throw); `lead_expires_at = null`
  su creazione lead in pre-lancio; upsert contatto Audience al signup (mock Resend); webhook Resend →
  setta `email_unsubscribed_at`; toggle/azione app → sync contatto Resend + DB.
- **Manuale (flag ON):** `/pacchetti` e Discover mostrano CTA Community al posto degli acquisti;
  checkout bloccato anche via richiesta diretta; lead nuovo senza scadenza + comparso nell'Audience
  Resend; banner Community; toggle Profilo disiscrive davvero (contatto Resend `unsubscribed`);
  un Broadcast di prova NON arriva ai disiscritti; transazionali (magic link) ancora inviate.
- **Manuale (flag OFF, simulazione go-live):** BuyButton tornano; checkout funziona (test mode);
  Broadcast di lancio parte dalla dashboard; toast PWA appare una sola volta dopo il "deploy".
- **Regressione:** lint, `npx tsc --noEmit`, `npx vitest run` verdi.
