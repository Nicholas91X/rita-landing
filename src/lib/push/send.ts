// src/lib/push/send.ts
import webpush from "web-push"
import type { PushPayload } from "./types"

const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT

if (publicKey && privateKey && subject) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function sendPush(
  subscription: PushSubscriptionPayload,
  payload: PushPayload,
): Promise<{ statusCode: number }> {
  const result = await webpush.sendNotification(
    subscription,
    JSON.stringify(payload),
    { TTL: 86400 },
  )
  return { statusCode: result.statusCode }
}
