import JSZip from "jszip"
import { createServiceRoleClient } from "@/utils/supabase/server"

export async function exportUserData(userId: string, userEmail: string | null): Promise<Blob> {
  const admin = await createServiceRoleClient()

  const [profile, subs, purchases, payments, invoices, refunds, progress, notifs, badges] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).single(),
      admin.from("user_subscriptions").select("*, packages(name)").eq("user_id", userId),
      admin.from("one_time_purchases").select("*, packages(name)").eq("user_id", userId),
      admin.from("stripe_payments").select("*").eq("user_id", userId),
      admin.from("stripe_invoices").select("*").eq("user_id", userId),
      admin.from("refund_requests").select("*").eq("user_id", userId),
      admin.from("video_watch_progress").select("*").eq("user_id", userId),
      admin.from("user_notifications").select("*").eq("user_id", userId),
      admin.from("user_badges").select("*").eq("user_id", userId),
    ])

  const zip = new JSZip()
  const write = (name: string, payload: unknown) =>
    zip.file(name, JSON.stringify(payload, null, 2))

  write("profile.json", { ...profile.data, auth_email: userEmail })
  write("subscriptions.json", subs.data ?? [])
  write("purchases.json", purchases.data ?? [])
  write("payments.json", payments.data ?? [])
  write("invoices.json", invoices.data ?? [])
  write("refund_requests.json", refunds.data ?? [])
  write("video_progress.json", progress.data ?? [])
  write("notifications.json", notifs.data ?? [])
  write("badges.json", badges.data ?? [])

  zip.file("README.txt", readme())

  return await zip.generateAsync({ type: "blob" })
}

function readme(): string {
  return `Esportazione dei tuoi dati personali — Rita Workout
Generata il: ${new Date().toISOString()}

Questo archivio contiene tutti i dati personali che conserviamo su di te:
- profile.json: dati del profilo (nome, email, preferenze)
- subscriptions.json: abbonamenti (attivi e scaduti)
- purchases.json: acquisti singoli
- payments.json, invoices.json: pagamenti e fatture Stripe
- refund_requests.json: richieste di rimborso
- video_progress.json: progresso di visualizzazione dei video
- notifications.json: notifiche in-app
- badges.json: badge ottenuti

Non sono inclusi contenuti del catalogo (pacchetti, corsi, video) perché non sono dati tuoi.
Per chiarimenti: support@fitandsmile.it
`
}
