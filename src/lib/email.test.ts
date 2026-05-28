import { describe, it, expect, vi, beforeEach } from "vitest"

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ data: { id: "msg-1" }, error: null }),
}))
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import {
  sendLeadMagicLinkEmail,
  sendLeadReminderT10Email,
  sendLeadReminderT20Email,
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

  it("sends with countdown in subject and body", async () => {
    await sendLeadReminderT10Email("a@e.com", "Mario", 4)
    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0] as { subject: string; html: string }
    expect(args.subject).toContain("4 giorni")
    expect(args.html).toContain("Mario")
    expect(args.html).toContain("Rituale della Leggerezza")
  })
})

describe("sendLeadReminderT20Email", () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it("sends the post-expiry recovery email", async () => {
    await sendLeadReminderT20Email("a@e.com", "Asia")
    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0] as { subject: string; html: string }
    expect(args.subject.toLowerCase()).toContain("riprendi")
    expect(args.html).toContain("Asia")
    expect(args.html).toContain("scaduto")
  })
})
