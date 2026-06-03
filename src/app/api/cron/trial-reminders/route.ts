// src/app/api/cron/trial-reminders/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/utils/supabase/server"
import { sendToUser } from "@/lib/push/dispatch"
import { trialReminderPayload } from "@/lib/push/payload-templates"
import { sendTrialEndingEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const vercelCron = req.headers.get("x-vercel-cron")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (auth !== expected || vercelCron !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = await createServiceRoleClient()

  // For status='trialing' rows, `current_period_end` holds the Stripe
  // `trial_end` (the webhook writes it there — see
  // src/app/api/webhooks/stripe/route.ts `checkout.session.completed`).
  // There is no dedicated `trial_end` column in `user_subscriptions`.
  const { data: rows, error } = await admin
    .from("user_subscriptions")
    .select("id, user_id, current_period_end, package_id")
    .eq("status", "trialing")
    .is("trial_reminder_sent_at", null)
    .gte("current_period_end", new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString())
    .lte("current_period_end", new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let processed = 0
  for (const row of rows ?? []) {
    try {
      await sendToUser(
        admin,
        row.user_id,
        trialReminderPayload({ subscriptionId: row.id }),
        { category: "transactional" },
      )
      await admin.from("user_notifications").insert({
        user_id: row.user_id,
        type: "trial_reminder",
        title: "Il tuo periodo di prova scade tra 2 giorni",
        message: "Rinnova per non perdere l'accesso.",
      })

      // Email reminder — best-effort. A send failure must NOT prevent the
      // dedup flag from being set, otherwise the next run would re-send the
      // push. (Same trade-off as the welcome email: miss > duplicate.)
      try {
        const [{ data: profile }, { data: pkg }] = await Promise.all([
          admin.from("profiles").select("email, full_name").eq("id", row.user_id).single(),
          admin.from("packages").select("name").eq("id", row.package_id).single(),
        ])
        if (profile?.email) {
          const expiryDate = row.current_period_end
            ? new Date(row.current_period_end).toLocaleDateString("it-IT")
            : ""
          await sendTrialEndingEmail(
            profile.email,
            profile.full_name ?? "",
            pkg?.name ?? "il tuo pacchetto",
            expiryDate,
          )
        }
      } catch (emailErr) {
        console.error("[cron trial-reminders] email failed", row.id, emailErr)
      }

      await admin.from("user_subscriptions").update({ trial_reminder_sent_at: new Date().toISOString() }).eq("id", row.id)
      processed++
    } catch (err) {
      console.error("[cron trial-reminders]", row.id, err)
    }
  }

  return NextResponse.json({ processed, total: rows?.length ?? 0 })
}
