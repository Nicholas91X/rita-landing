---
description: Guida Completa all'Avvio e Sviluppo in Ambiente Locale (Stripe & Next.js)
---

# Avvio Progetto in Locale: Procedura Completa

Questa guida è un promemoria essenziale per poter testare **tutte le funzionalità** dell'applicazione in sviluppo locale (`localhost`), inclusi gli acquisti Stripe e l'upload di grandi file.

Quando riprendi in mano il progetto e vuoi che tutto (Specialmente i pagamenti) funzioni, devi avere attivi **due processi in parallelo**.

## 1. Avvio del Server Web (Next.js)

Apri il primo terminale nel percorso del progetto.

Verifica che il tuo `.env.local` punti alla porta corretta:
`NEXT_PUBLIC_SITE_URL=http://localhost:3002`

Avvia il server forzando la porta indicata:

```bash
npm run dev -- -p 3002
```

> **Se la porta risulta occupata** da vecchi processi:
> Esegui su PowerShell (Windows): `Stop-Process -Name node -Force; npm run dev -- -p 3002`

Il sito sarà raggiungibile su http://localhost:3002

---

## 2. Attivazione del "Ponte" per i Pagamenti (Stripe CLI)

In locale (localhost), Stripe e Supabase non possono comunicare tra loro. Se fai un acquisto senza questo passaggio, i soldi "finti" scalano su Stripe ma la tua applicazione non registra l'utente o il pacchetto perché il Webhook non arriva al tuo computer.

Per risolvere, usa Stripe CLI per "ascoltare" cosa succede su Stripe e inoltrarlo forzatamente al tuo server locale.

1. Apri un **SECONDO terminale** (lasciando acceso quello del server Next.js).
2. Lancia il listener di Stripe (assicurati che la porta combaci col server web):

```bash
stripe listen --forward-to localhost:3002/api/webhooks/stripe
```

3. Nel terminale apparirà una frase come:
   `Ready! You are using Stripe API Version... Your webhook signing secret is whsec_xyz123...`
4. **Copia interamente la chiave** `whsec_xyz123...` generata dal comando.

### 2.1 Aggiornamento del Secret

Questo passaggio va fatto **ogni volta che chiudi e riapri la Stripe CLI**, perché il secret cambia a ogni riavvio del comando `stripe listen`.

1. Apri il file `.env.local` del progetto.
2. Trova la riga:
   `STRIPE_WEBHOOK_SECRET="whsec_..."`
3. Sostituisci il vecchio secret con **quello nuovo appena copiato dal terminale**.
4. Salva il file `.env.local`.
5. (Se il server web era già acceso, riavvialo fermandolo e dando di nuovo `npm run dev -- -p 3002` per far caricare la nuova chiave d'ambiente).

---

## 🚀 Sei Pronto a Sviluppare!

Con entrambi i terminali aperti e running, se provi ad acquistare un pacchetto vedrai nel terminale di `stripe listen` che vengono stampati gli eventi (come `checkout.session.completed`).
Il tuo DB si aggiornerà in base alle logiche dell'App.
