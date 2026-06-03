// src/app/api/cron/lead-reminders/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/utils/supabase/server"
import {
    sendLeadReminderT10Email,
    sendLeadReminderT20Email,
} from "@/lib/email"
import { buildUnsubscribeUrl } from "@/lib/marketing-consent"

const DAY_MS = 24 * 60 * 60 * 1000

interface LeadRow {
    id: string
    email: string | null
    full_name: string | null
    lead_expires_at: string | null
}

export async function GET(req: NextRequest) {
    const auth = req.headers.get("authorization")
    const vercelCron = req.headers.get("x-vercel-cron")
    const expected = `Bearer ${process.env.CRON_SECRET}`
    if (auth !== expected || vercelCron !== "1") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = await createServiceRoleClient()
    const now = new Date()
    const nowMs = now.getTime()

    // T+10 window: lead_expires_at is 3-4 days from now (mid-trial urgency,
    // i.e. ~10 days into the 14-day window).
    const t10From = new Date(nowMs + 3 * DAY_MS).toISOString()
    const t10To = new Date(nowMs + 4 * DAY_MS).toISOString()

    const { data: t10Rows, error: t10Err } = await admin
        .from("profiles")
        .select("id, email, full_name, lead_expires_at")
        .eq("account_type", "lead")
        .not("marketing_consent_at", "is", null)
        .is("lead_reminder_t10_sent_at", null)
        .gte("lead_expires_at", t10From)
        .lt("lead_expires_at", t10To)

    if (t10Err) {
        return NextResponse.json({ error: t10Err.message }, { status: 500 })
    }

    let t10Sent = 0
    for (const lead of (t10Rows ?? []) as LeadRow[]) {
        if (!lead.email || !lead.lead_expires_at) continue
        const daysLeft = Math.max(
            0,
            Math.ceil((new Date(lead.lead_expires_at).getTime() - nowMs) / DAY_MS),
        )
        try {
            const unsubscribeUrl = await buildUnsubscribeUrl(lead.id)
            await sendLeadReminderT10Email(lead.email, lead.full_name ?? "", daysLeft, unsubscribeUrl)
            await admin
                .from("profiles")
                .update({ lead_reminder_t10_sent_at: now.toISOString() })
                .eq("id", lead.id)
            t10Sent++
        } catch (err) {
            console.error("[cron lead-reminders] T10 send failed", lead.id, err)
        }
    }

    // T+20 window: lead_expires_at is 6-7 days in the past (post-expiry
    // recovery, i.e. ~20 days from the original signup).
    const t20From = new Date(nowMs - 7 * DAY_MS).toISOString()
    const t20To = new Date(nowMs - 6 * DAY_MS).toISOString()

    const { data: t20Rows, error: t20Err } = await admin
        .from("profiles")
        .select("id, email, full_name, lead_expires_at")
        .eq("account_type", "lead")
        .not("marketing_consent_at", "is", null)
        .is("lead_reminder_t20_sent_at", null)
        .gte("lead_expires_at", t20From)
        .lt("lead_expires_at", t20To)

    if (t20Err) {
        return NextResponse.json({ error: t20Err.message }, { status: 500 })
    }

    let t20Sent = 0
    for (const lead of (t20Rows ?? []) as LeadRow[]) {
        if (!lead.email) continue
        try {
            const unsubscribeUrl = await buildUnsubscribeUrl(lead.id)
            await sendLeadReminderT20Email(lead.email, lead.full_name ?? "", unsubscribeUrl)
            await admin
                .from("profiles")
                .update({ lead_reminder_t20_sent_at: now.toISOString() })
                .eq("id", lead.id)
            t20Sent++
        } catch (err) {
            console.error("[cron lead-reminders] T20 send failed", lead.id, err)
        }
    }

    return NextResponse.json({
        t10Sent,
        t20Sent,
        t10Total: t10Rows?.length ?? 0,
        t20Total: t20Rows?.length ?? 0,
    })
}
