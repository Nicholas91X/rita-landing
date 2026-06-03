# Modifiche pre-lancio funnel Lead-Magnet

> Lista delle modifiche da completare **prima** di lanciare il funnel `/lezioni-gratis`, con analisi delle implicazioni tecniche. Stato: 🔴 da fare · 🟡 in corso · 🟢 fatto.

Legenda effort: **S** = poche ore · **M** = ~1 giornata · **L** = 2-4 giorni · **XL** = >1 settimana.

---

## 1. 🟢 Sblocco sequenziale dei pacchetti — effort **L** — FATTO (89e1c7d)

Modello finale: **catena = course**. `packages.order_index` (migration 11), sblocco quando i predecessori dello stesso course sono completati (badge), gating in checkout + UI (`/pacchetti`, Discover). Utility pura `lib/package-unlock.ts` con 8 test. Lead e 1:1 esclusi naturalmente (soli nel loro course).


**Obiettivo:** un pacchetto è acquistabile/accessibile solo dopo il completamento del precedente (es. New York si sblocca solo dopo aver completato tutti i video di Bali).

**Stato attuale del codice:**
- **Non esiste un campo d'ordine** sui pacchetti. La sequenza Bali → NY → Siviglia → Avana è **hardcoded** con string-matching sul nome in `DiscoverSection.tsx:57-63` (e citata in chiaro a `DiscoverSection.tsx:258`). Fragile: dipende dai nomi.
- Il segnale di **completamento è pulito**: `user_badges` ha una riga per pacchetto completato (assegnata da `reconcileUserBadges`/`checkAndAwardPackageBadge` in `video.ts`), e `video_watch_progress.is_completed` traccia il singolo video.
- La sequenza è **globale e lineare** (uguale per tutti), non per-livello/corso.

**Cosa serve:**
1. Aggiungere colonna `order_index` (o `sequence_position`) a `packages` (migration). Sostituire lo string-matching con questo campo.
2. Funzione "il pacchetto precedente è completo?" (basata su `user_badges`).
3. Gating in **3 punti**:
   - `createCheckoutSession` (`stripe.ts:31`) → rifiuta il checkout se il precedente non è completo.
   - `getSignedVideoUrl` (`video.ts:10`) → nega l'URL video se il pacchetto è bloccato.
   - `DiscoverSection`/`/pacchetti` → mostra il pacchetto come "🔒 bloccato" invece di acquistabile.

**Decisioni prese (2026-06-03):** una sola catena globale ora ma predisporre `chain_id` nullable per future catene multiple; nessun grandfathering (solo utenti fittizi); "Lezioni Gratis" resta fuori dal gating; il primo pacchetto della catena resta sempre sbloccato. Restano aperte:
- (originariamente) La sequenza è una sola catena globale, o servono catene diverse per livelli diversi? (oggi i dati supportano solo globale).
- Il primo pacchetto (Bali) resta sempre sbloccato. Il pacchetto lead "Lezioni Gratis" va escluso dalla sequenza (è gratuito e parallelo).
- Cosa succede a chi ha **già acquistato** pacchetti fuori sequenza? Serve grandfathering.

---

## 2. 🟢 Email reminder fine prova, 2 giorni prima della scadenza — effort **S** — FATTO (5bbe04c)

**Obiettivo:** mandare una **email** 2 giorni prima della fine del periodo di prova.

**Stato attuale del codice:**
- Il cron `api/cron/trial-reminders/route.ts` **esiste già e ha il timing giusto** (finestra +2/+3 giorni su `current_period_end`, dedup via `trial_reminder_sent_at`).
- MA invia **solo push notification + notifica in-app**. **Non invia email.** ← unico gap.
- I trial sono in `user_subscriptions` (`status='trialing'`, `current_period_end` = fine prova). Nessun cambio al modello dati necessario.

**Cosa serve:**
1. Aggiungere `sendTrialReminderEmail()` in `email.ts` (template simile a `sendSubscriptionExpiringEmail`, tono "la prova scade tra 2 giorni").
2. Chiamarla nel cron accanto al push esistente.
3. (consigliato) colonna separata `trial_email_sent_at` per non rischiare doppio invio email su retry del cron, indipendente dal flag push.

**Effort basso:** la logica di timing e selezione è già lì, si aggiunge solo l'email.

---

## 3. 🟢 Tab "1 to 1" → "1:1" — effort **S** — FATTO (586a700)

**Stato attuale:** l'unica label utente è in `DashboardSidebar.tsx:25` (`label: '1 to 1'`). Renderizzata su desktop e mobile.

**Cosa serve:** cambiare quella stringa in `'1:1'`. **Una riga.** NON rinominare i file/componenti (`OneToOneSection.tsx`, identificatore interno `TabType='1to1'`).

---

## 4. 🟢 Link WhatsApp → numero reale di Rita `3519398967` — effort **S** — FATTO (586a700)

**Numero corretto:** `3519398967` → internazionale `393519398967` → `wa.me/393519398967`.

**Stato attuale (numeri sparsi, non centralizzati):**
- `Nav.tsx:13` → usa `393472292627` (vecchio) ❌
- `sections/Contact.tsx:18` → `393472292627` ❌
- `DiscoverSection.tsx:269` → `wa.me/your-number` (placeholder!) ❌
- `content/it.ts:3` → `phone: "+39 347 229 2627"` (usato da `Cta.tsx`/`waLink`) ❌
- `Cta.tsx:14` → default `"+39 347 229 2627"` ❌
- `PersonalView.tsx:84,190` → **già corretti** ✅

**Cosa serve:** aggiornare i 5 punti sbagliati. **Consigliato**: centralizzare il numero in `content/it.ts` come unica fonte, e far puntare tutti lì (evita che si ri-sparpagli in futuro). Helper `utils/whatsapp.ts` (`waLink()`) già pronto, accetta il numero come parametro.

---

## 5. 🟢 `/pacchetti`: descrizioni espandibili al tocco — effort **S** — FATTO (586a700)

**Stato attuale:** descrizione troncata con `line-clamp-3` (CSS) a `pacchetti/page.tsx:165`.

**Buona notizia:** esiste già `components/CollapsibleHtml.tsx` — tronca a N parole, mostra toggle "Leggi di più"/"Leggi meno", gestisce HTML. **Riusabile direttamente.**

**Cosa serve:** sostituire il `<CardDescription line-clamp-3>` con `<CollapsibleHtml html={pkg.description} maxWords={...} />`. ~3 righe.

---

## NOTE / Analisi di fattibilità (non ancora decise)

### A. Guidare gli utenti poco tech all'installazione PWA — effort variabile

**Stato attuale (buona base):** `PWAInstallPrompt.tsx` è già evoluto:
- Rileva piattaforma (iOS Safari / Android Chrome / Samsung / desktop) e mostra istruzioni passo-passo **in italiano**.
- Gestisce `beforeinstallprompt` (Android/desktop → prompt nativo dell'OS).
- iOS: istruzioni manuali "Condividi → Aggiungi a Home" (obbligatorio, iOS non espone il prompt nativo).
- Cooldown 3 giorni dopo dismiss. Manifest installabile OK (icone, `standalone`).

**Gap per utenti poco tech (le donne target):**
1. **Nessuno screenshot/GIF** — solo testo+icone. Per chi non sa "dov'è il pulsante ⋮/Condividi" servono immagini reali dei pulsanti, o un breve video tutorial.
2. **Nessun pulsante "Installa app" persistente** in un menu/impostazioni — se l'utente sbaglia o dismissa, lo ritrova solo dopo 3 giorni.
3. **Nessuna conferma di successo** — su iOS l'installazione è silenziosa, l'utente non capisce se ce l'ha fatta.
4. **Contesto iOS confuso** — il dialog iOS è legato al prompt push, non a un onboarding chiaro "installa per usare l'app".

**Proposta (da decidere):** onboarding dedicato con screenshot annotati per i 2 casi principali (iOS Safari + Android Chrome), pulsante "Come installare l'app" sempre raggiungibile, schermata di conferma. Effort **M**.

> _(B. Casting TV — rimosso dallo scope su decisione del committente, 2026-06-03.)_

---

## Ordine di esecuzione consigliato

Quick wins prima (S), poi i due interventi sostanziali:
1. Punto 3 (tab 1:1) — S
2. Punto 4 (WhatsApp) — S
3. Punto 5 (descrizioni espandibili) — S
4. Punto 2 (email reminder prova) — S
5. Punto 1 (sblocco sequenziale) — L ← il più invasivo, richiede migration + gating in 3 punti
6. NOTE A/B (PWA onboarding, casting) — da decidere scope dopo i punti bloccanti

---

# Pre-lancio: Analisi infrastruttura & compliance (2026-06-03)

## A. Stripe — stato: TEST MODE 🔴 da portare in live

Funzionalmente **completo** ma punta all'account di test (`sk_test_...`). Implementato: checkout (subscription + payment, trial 7gg, loyalty coupon), portal, refund (14gg), cancel, webhook (checkout.session.completed, invoice succeeded/failed, subscription updated/deleted) con idempotenza, mirroring `stripe_payments`. Prodotti/prezzi creati via admin (`createPackage`) → ID salvati su `packages.stripe_price_id/product_id`.

**Per andare LIVE serve (azioni manuali):**
1. Live keys (`sk_live_...`, publishable, `whsec_...` del webhook live).
2. **Registrare il webhook endpoint** `/api/webhooks/stripe` nel dashboard Stripe LIVE → copiare il secret.
3. **Ricreare i pacchetti a pagamento in live** (BALI, NEW YORK, Percorso Rinascita Guidata): gli `stripe_price_id`/`product_id` attuali sono di TEST e **non esistono in live** → il checkout fallirebbe. Vanno ricreati (admin UI in modalità live, o script) e aggiornati nel DB. Il lead magnet "Rituale della Leggerezza" (gratis) non passa da checkout → nessuna azione.
4. `STRIPE_LOYALTY_COUPON_ID` non è settato → loyalty no-op finché non crei il coupon in live e setti la var.
5. 🟢 **FATTO** — Fallback `sk_test_placeholder` sostituito con helper centralizzato `src/lib/stripe.ts` (`getStripeKey()`): fallisce esplicitamente in produzione se la chiave manca, placeholder solo in dev/test.

**Prerequisito in corso:** account Stripe in attesa di verifica/attivazione pagamenti live (lato committente). Lo sviluppo locale resta in TEST; le chiavi live andranno solo su Vercel (prod) al lancio.

## B. GDPR / Compliance — base buona, gap mirati 🟡

**C'è già:** export dati (ZIP completo), cancellazione account (richiesta → conferma email → delete + anonimizzazione fiscale 10 anni), audit log, pagine `/privacy` e `/terms` (con sezione `#newsletter`). Il cron reminder **rispetta il consenso** (`marketing_consent_at IS NOT NULL`).

**Gap da chiudere prima del lancio (priorità):**
1. 🟢 **FATTO** — Toggle revoca consenso marketing (Art. 21) in `ProfileSection` (set/clear `marketing_consent_at`), stile coerente col toggle tema. Servito anche da `/api/unsubscribe`.
2. 🔴 **Privacy policy con placeholder** `[INDIRIZZO DA COMPLETARE]`, `[P.IVA DA COMPLETARE]` → da completare con dati reali (ultimo step, dati dal committente).
3. 🟢 **FATTO** — Header `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) e link "Disiscriviti" nei template marketing (`lib/email.ts`), endpoint `/api/unsubscribe` con token firmato.
4. 🟢 **FATTO** — Banner cookie ePrivacy informativo (`CookieBanner.tsx`), allineato il testo della privacy policy (sez. 8).
5. 🟢 Export/delete/audit già a posto. Privacy policy: data aggiornata a Giugno 2026.

## C. Variabili d'ambiente — tutte usate, mancano azioni prod 🟡

Nessuna var morta. Manca un `.env.example` (creato in questo commit).

**Azioni critiche per il deploy su Vercel:**
- 🔴 `NEXT_PUBLIC_SITE_URL` — ora è `http://localhost:3000` (override per i test auth locali). In prod DEVE essere il dominio reale (magic link, OAuth redirect, Referer Bunny dipendono da questo).
- 🔴 `LEAD_MAGNET_PACKAGE_ID` — se non settato su Vercel, il flusso lead **no-op silenzioso**.
- 🔴 `STRIPE_SECRET_KEY` + webhook secret — test → live.
- Tutte le altre (Supabase, Bunny, Resend, Upstash, VAPID, CRON_SECRET, GDPR_DELETE_SECRET) → provisionare in prod.
- Opzionali: `LEAD_NOTIFY_EMAIL` (default studio), `STRIPE_LOYALTY_COUPON_ID`, `NEXT_PUBLIC_MAINTENANCE_MODE`.
