// src/lib/push/payload-templates.ts
import type { PushPayload } from "./types"

export function purchaseCompletedPayload(args: { packageName: string; packageId: string; sessionId: string }): PushPayload {
  return {
    title: "Acquisto confermato",
    body: `Il pacchetto ${args.packageName} è ora nella tua Home.`,
    url: `/dashboard/package/${args.packageId}`,
    tag: `purchase-${args.sessionId}`,
  }
}

export function subscriptionRenewedPayload(args: { invoiceId: string }): PushPayload {
  return {
    title: "Abbonamento rinnovato",
    body: "Grazie, continua così!",
    url: "/dashboard#billing",
    tag: `renewal-${args.invoiceId}`,
  }
}

export function paymentFailedPayload(args: { invoiceId: string }): PushPayload {
  return {
    title: "Pagamento non riuscito",
    body: "Aggiorna il metodo di pagamento per non perdere l'accesso.",
    url: "/dashboard#billing",
    tag: `payment-failed-${args.invoiceId}`,
  }
}

export function refundApprovedPayload(args: { refundId: string }): PushPayload {
  return {
    title: "Rimborso approvato",
    body: "Riceverai l'accredito entro 5-10 giorni.",
    url: "/dashboard#billing",
    tag: `refund-${args.refundId}`,
  }
}

export function adminResponsePayload(args: { requestId: string; message: string }): PushPayload {
  const trimmed = args.message.trim().slice(0, 100)
  return {
    title: "Hai una nuova risposta dal team Rita",
    body: trimmed + (args.message.length > 100 ? "…" : ""),
    url: "/dashboard",
    tag: `response-${args.requestId}`,
  }
}

export function trialReminderPayload(args: { subscriptionId: string }): PushPayload {
  return {
    title: "Il tuo periodo di prova scade tra 2 giorni",
    body: "Rinnova per non perdere l'accesso.",
    url: "/dashboard#billing",
    tag: `trial-reminder-${args.subscriptionId}`,
  }
}
