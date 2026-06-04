import { describe, it, expect, vi, beforeEach } from "vitest"

const { sendMock, sendBatchMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ data: { id: "msg-1" }, error: null }),
  sendBatchMock: vi.fn().mockResolvedValue({ data: {}, error: null }),
}))
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock }
    batch = { send: sendBatchMock }
  },
}))

import {
  sendLeadMagicLinkEmail,
  sendLeadReminderT10Email,
  sendLeadReminderT20Email,
  sendCommunityBatch,
} from "./email"

describe("sendLeadMagicLinkEmail", () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it("sends a magic-link email mentioning the 14-day window", async () => {
    await sendLeadMagicLinkEmail(
      "user@e.com",
      "Mario",
      "https://x/y?token_hash=abc&type=magiclink",
    )

    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0] as {
      to: string
      subject: string
      html: string
    }
    expect(args.to).toBe("user@e.com")
    expect(args.html).toContain("Mario")
    expect(args.html).toContain("14 giorni")
    expect(args.html).toContain("https://x/y?token_hash=abc&type=magiclink")
    expect(args.subject.toLowerCase()).toContain("3 video")
  })

  it("falls back gracefully when name is empty", async () => {
    await sendLeadMagicLinkEmail("u@e.com", "", "https://x/y")
    const args = sendMock.mock.calls[0][0] as { html: string }
    expect(args.html).toContain("cara")
  })
})

describe("sendLeadReminderT10Email", () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it("sends with countdown in subject and body, plus unsubscribe", async () => {
    await sendLeadReminderT10Email("a@e.com", "Mario", 4, "https://x/api/unsubscribe?token=tok")
    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0] as { subject: string; html: string; headers?: Record<string, string> }
    expect(args.subject).toContain("4 giorni")
    expect(args.html).toContain("Mario")
    expect(args.html).toContain("Rituale della Leggerezza")
    expect(args.html).toContain("Disiscriviti")
    expect(args.headers?.["List-Unsubscribe"]).toContain("token=tok")
  })
})

describe("sendLeadReminderT20Email", () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it("sends the post-expiry recovery email with unsubscribe", async () => {
    await sendLeadReminderT20Email("a@e.com", "Asia", "https://x/api/unsubscribe?token=tok")
    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0] as { subject: string; html: string; headers?: Record<string, string> }
    expect(args.subject.toLowerCase()).toContain("riprendi")
    expect(args.html).toContain("Asia")
    expect(args.html).toContain("scaduto")
    expect(args.html).toContain("Disiscriviti")
    expect(args.headers?.["List-Unsubscribe"]).toContain("token=tok")
  })
})

describe("sendCommunityBatch", () => {
  beforeEach(() => {
    sendBatchMock.mockClear()
  })

  it("costruisce un messaggio per destinatario con disiscrizione", async () => {
    await sendCommunityBatch(
      [{ email: "a@e.com", name: "Mara", unsubscribeUrl: "https://x/api/unsubscribe?token=t1" }],
      "Nuovo video",
      "È uscito un nuovo allenamento.",
      "https://x/dashboard",
      "GUARDA ORA",
    )
    expect(sendBatchMock).toHaveBeenCalledOnce()
    const messages = sendBatchMock.mock.calls[0][0] as Array<{
      to: string
      subject: string
      html: string
      headers: Record<string, string>
    }>
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe("a@e.com")
    expect(messages[0].subject).toBe("Nuovo video")
    expect(messages[0].html).toContain("Disiscriviti")
    expect(messages[0].headers["List-Unsubscribe"]).toContain("token=t1")
  })
})
