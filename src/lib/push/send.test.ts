// src/lib/push/send.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

describe("sendPush", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.VAPID_PUBLIC_KEY = "pub-test"
    process.env.VAPID_PRIVATE_KEY = "priv-test"
    process.env.VAPID_SUBJECT = "mailto:test@example.com"
  })

  it("calls web-push.sendNotification with serialized payload and TTL 86400", async () => {
    const webpush = (await import("web-push")).default as {
      setVapidDetails: ReturnType<typeof vi.fn>
      sendNotification: ReturnType<typeof vi.fn>
    }
    ;(webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
      statusCode: 201,
    })
    const { sendPush } = await import("./send")
    const sub = { endpoint: "https://x", keys: { p256dh: "a", auth: "b" } }
    const payload = { title: "T", body: "B" }
    await sendPush(sub, payload)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      sub,
      JSON.stringify(payload),
      { TTL: 86400 },
    )
  })

  it("calls setVapidDetails once per module load with env values", async () => {
    const webpush = (await import("web-push")).default as {
      setVapidDetails: ReturnType<typeof vi.fn>
    }
    await import("./send")
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "pub-test",
      "priv-test",
    )
  })
})
