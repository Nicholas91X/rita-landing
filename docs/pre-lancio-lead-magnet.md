# Modifiche pre-lancio funnel Lead-Magnet

> Lista delle modifiche da completare **prima** di lanciare il funnel `/lezioni-gratis`, con analisi delle implicazioni tecniche. Stato: 🔴 da fare · 🟡 in corso · 🟢 fatto.

Legenda effort: **S** = poche ore · **M** = ~1 giornata · **L** = 2-4 giorni · **XL** = >1 settimana.

---

## 1. 🔴 Sblocco sequenziale dei pacchetti — effort **L**

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

**Decisioni aperte:**
- La sequenza è una sola catena globale, o servono catene diverse per livelli diversi? (oggi i dati supportano solo globale).
- Il primo pacchetto (Bali) resta sempre sbloccato. Il pacchetto lead "Lezioni Gratis" va escluso dalla sequenza (è gratuito e parallelo).
- Cosa succede a chi ha **già acquistato** pacchetti fuori sequenza? Serve grandfathering.

---

## 2. 🔴 Email reminder fine prova, 2 giorni prima della scadenza — effort **S**

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

## 3. 🔴 Tab "1 to 1" → "1:1" — effort **S** (banale)

**Stato attuale:** l'unica label utente è in `DashboardSidebar.tsx:25` (`label: '1 to 1'`). Renderizzata su desktop e mobile.

**Cosa serve:** cambiare quella stringa in `'1:1'`. **Una riga.** NON rinominare i file/componenti (`OneToOneSection.tsx`, identificatore interno `TabType='1to1'`).

---

## 4. 🔴 Link WhatsApp → numero reale di Rita `3519398967` — effort **S**

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

## 5. 🔴 `/pacchetti`: descrizioni espandibili al tocco — effort **S**

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

### B. Proiettare i videocorsi su TV (casting) — effort alto / vincolo architetturale

**Vincolo critico:** i video sono in un **iframe cross-origin di Bunny** (`iframe.mediadelivery.net`), non un `<video>` nativo (`VideoPlayer.tsx`). Le API di casting del browser (AirPlay / Chromecast / Remote Playback) **non possono raggiungere un iframe cross-origin** dalla pagina padre. Quindi non possiamo costruire un pulsante "cast" nostro sopra il player attuale.

**Opzioni reali:**
1. **Pulsante cast nativo del player Bunny** — il player Bunny *potrebbe* avere già AirPlay/Chromecast nella sua UI (dipende da iOS/Chrome e versione player). Costo: ~0, ma UX incerta e non documentata. → **da verificare** aprendo un video su iPhone/iPad e Android e guardando se appare l'icona cast nel player.
2. **Screen mirroring del dispositivo** (l'utente specchia tutto lo schermo su TV). Funziona oggi, zero codice, ma UX poco intuitiva per utenti poco tech. → utile come "fallback documentato" con una guida.
3. **Cast custom (Chromecast/AirPlay nostro)** — richiede rifare il player con `<video>` nativo + URL HLS firmati a tempo per sessione cast + SDK Chromecast. **Riscrittura architetturale + complessità sicurezza token.** Effort **XL**, da evitare in fase di lancio.

**Raccomandazione:** per il lancio, (1) verificare se Bunny espone già il cast nel suo player e, in caso, scrivere una mini-guida; (2) documentare lo screen mirroring come alternativa. Il casting custom è fuori scope per il lancio.

---

## Ordine di esecuzione consigliato

Quick wins prima (S), poi i due interventi sostanziali:
1. Punto 3 (tab 1:1) — S
2. Punto 4 (WhatsApp) — S
3. Punto 5 (descrizioni espandibili) — S
4. Punto 2 (email reminder prova) — S
5. Punto 1 (sblocco sequenziale) — L ← il più invasivo, richiede migration + gating in 3 punti
6. NOTE A/B (PWA onboarding, casting) — da decidere scope dopo i punti bloccanti
