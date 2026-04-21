// src/lib/push/payload-templates.test.ts
import { describe, it, expect } from "vitest"
import {
  purchaseCompletedPayload, subscriptionRenewedPayload, paymentFailedPayload,
  refundApprovedPayload, adminResponsePayload, trialReminderPayload,
} from "./payload-templates"

describe("payload templates", () => {
  it("purchase includes package name and id in url", () => {
    const p = purchaseCompletedPayload({ packageName: "Pilates", packageId: "abc", sessionId: "sess" })
    expect(p.title).toBe("Acquisto confermato")
    expect(p.body).toContain("Pilates")
    expect(p.url).toBe("/dashboard/package/abc")
    expect(p.tag).toBe("purchase-sess")
  })
  it("trial reminder uses subscription id in tag", () => {
    const p = trialReminderPayload({ subscriptionId: "sub-1" })
    expect(p.title).toContain("2 giorni")
    expect(p.tag).toBe("trial-reminder-sub-1")
  })
  it("admin response truncates body at 100 chars", () => {
    const long = "a".repeat(200)
    const p = adminResponsePayload({ requestId: "r1", message: long })
    expect(p.body.length).toBeLessThanOrEqual(103)
  })
  it("payment failed points to billing anchor", () => {
    const p = paymentFailedPayload({ invoiceId: "inv-1" })
    expect(p.url).toBe("/dashboard#billing")
    expect(p.tag).toBe("payment-failed-inv-1")
  })
  it("refund approved payload has correct title", () => {
    const p = refundApprovedPayload({ refundId: "ref-1" })
    expect(p.title).toBe("Rimborso approvato")
  })
  it("subscription renewed payload has correct title", () => {
    const p = subscriptionRenewedPayload({ invoiceId: "inv-1" })
    expect(p.title).toBe("Abbonamento rinnovato")
  })
})
