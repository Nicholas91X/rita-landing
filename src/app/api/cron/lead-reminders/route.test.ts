import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { sendT10, sendT20 } = vi.hoisted(() => ({
    sendT10: vi.fn().mockResolvedValue(undefined),
    sendT20: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/email", () => ({
    sendLeadReminderT10Email: sendT10,
    sendLeadReminderT20Email: sendT20,
}))

// In-memory mock of the supabase service-role client. Each test sets
// `rowsByFilter` to control which leads the cron sees. The mock recognises the
// `is(lead_reminder_t10_sent_at, null)` vs `is(lead_reminder_t20_sent_at, null)`
// chain to route between the two windows.

type Lead = {
    id: string
    email: string | null
    full_name: string | null
    lead_expires_at: string | null
}

type MockState = {
    t10Rows: Lead[]
    t20Rows: Lead[]
    updateCalls: Array<{ id: string; payload: Record<string, unknown> }>
    selectError: { message: string } | null
}

const { state } = vi.hoisted(() => ({
    state: {
        t10Rows: [] as Lead[],
        t20Rows: [] as Lead[],
        updateCalls: [] as Array<{ id: string; payload: Record<string, unknown> }>,
        selectError: null as { message: string } | null,
    } satisfies MockState,
}))

function buildQuery() {
    let bucket: "t10" | "t20" | null = null
    const q: Record<string, unknown> = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        not: vi.fn(() => q),
        gte: vi.fn(() => q),
        lt: vi.fn(() => q),
        is: vi.fn((col: string, _val: unknown) => {
            if (col === "lead_reminder_t10_sent_at") bucket = "t10"
            else if (col === "lead_reminder_t20_sent_at") bucket = "t20"
            return q
        }),
        then: (resolve: (v: unknown) => unknown) => {
            const data =
                bucket === "t10"
                    ? state.t10Rows
                    : bucket === "t20"
                    ? state.t20Rows
                    : []
            return Promise.resolve({ data, error: state.selectError }).then(resolve)
        },
    }
    return q
}

function buildUpdateBuilder(payload: Record<string, unknown>) {
    const upd: Record<string, unknown> = {
        eq: vi.fn((_col: string, val: string) => {
            state.updateCalls.push({ id: val, payload })
            return Promise.resolve({ data: null, error: null })
        }),
    }
    return upd
}

vi.mock("@/utils/supabase/server", () => ({
    createServiceRoleClient: vi.fn(async () => ({
        from: vi.fn(() => ({
            select: (..._a: unknown[]) => buildQuery(),
            update: (payload: Record<string, unknown>) => buildUpdateBuilder(payload),
        })),
    })),
}))

import { GET } from "./route"

function makeReq(headers: Record<string, string>): import("next/server").NextRequest {
    return new Request("http://localhost/api/cron/lead-reminders", {
        headers,
    }) as unknown as import("next/server").NextRequest
}

describe("/api/cron/lead-reminders", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.t10Rows = []
        state.t20Rows = []
        state.updateCalls = []
        state.selectError = null
        process.env.CRON_SECRET = "secret"
    })

    afterEach(() => {
        delete process.env.CRON_SECRET
    })

    it("rejects request without Bearer auth", async () => {
        const req = makeReq({ "x-vercel-cron": "1" })
        const res = await GET(req)
        expect(res.status).toBe(401)
    })

    it("rejects request missing x-vercel-cron header", async () => {
        const req = makeReq({ authorization: "Bearer secret" })
        const res = await GET(req)
        expect(res.status).toBe(401)
    })

    it("rejects request with wrong secret", async () => {
        const req = makeReq({
            authorization: "Bearer wrong",
            "x-vercel-cron": "1",
        })
        const res = await GET(req)
        expect(res.status).toBe(401)
    })

    it("sends T+10 reminder to eligible leads and marks idempotency flag", async () => {
        state.t10Rows = [
            {
                id: "u1",
                email: "lead@example.com",
                full_name: "Mario",
                lead_expires_at: new Date(Date.now() + 3.5 * 86400000).toISOString(),
            },
        ]
        const req = makeReq({
            authorization: "Bearer secret",
            "x-vercel-cron": "1",
        })
        const res = await GET(req)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.t10Sent).toBe(1)
        expect(sendT10).toHaveBeenCalledOnce()
        const [email, name, daysLeft] = sendT10.mock.calls[0]
        expect(email).toBe("lead@example.com")
        expect(name).toBe("Mario")
        expect(daysLeft).toBeGreaterThanOrEqual(3)
        expect(daysLeft).toBeLessThanOrEqual(4)
        const t10Update = state.updateCalls.find(
            c => c.id === "u1" && "lead_reminder_t10_sent_at" in c.payload,
        )
        expect(t10Update).toBeDefined()
    })

    it("sends T+20 reminder when window matches", async () => {
        state.t20Rows = [
            {
                id: "u2",
                email: "expired@example.com",
                full_name: "Lucia",
                lead_expires_at: new Date(Date.now() - 6.5 * 86400000).toISOString(),
            },
        ]
        const req = makeReq({
            authorization: "Bearer secret",
            "x-vercel-cron": "1",
        })
        const res = await GET(req)
        const body = await res.json()
        expect(body.t20Sent).toBe(1)
        expect(sendT20).toHaveBeenCalledWith("expired@example.com", "Lucia")
        const t20Update = state.updateCalls.find(
            c => c.id === "u2" && "lead_reminder_t20_sent_at" in c.payload,
        )
        expect(t20Update).toBeDefined()
    })

    it("skips leads without an email address", async () => {
        state.t10Rows = [
            {
                id: "u3",
                email: null,
                full_name: "NoMail",
                lead_expires_at: new Date(Date.now() + 3.5 * 86400000).toISOString(),
            },
        ]
        const req = makeReq({
            authorization: "Bearer secret",
            "x-vercel-cron": "1",
        })
        const res = await GET(req)
        const body = await res.json()
        expect(body.t10Sent).toBe(0)
        expect(sendT10).not.toHaveBeenCalled()
    })

    it("returns 200 with zero counts when no eligible leads", async () => {
        const req = makeReq({
            authorization: "Bearer secret",
            "x-vercel-cron": "1",
        })
        const res = await GET(req)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.t10Sent).toBe(0)
        expect(body.t20Sent).toBe(0)
        expect(sendT10).not.toHaveBeenCalled()
        expect(sendT20).not.toHaveBeenCalled()
    })

    it("does not mark idempotency flag if email send fails", async () => {
        sendT10.mockRejectedValueOnce(new Error("resend down"))
        state.t10Rows = [
            {
                id: "u4",
                email: "boom@example.com",
                full_name: "Boom",
                lead_expires_at: new Date(Date.now() + 3.5 * 86400000).toISOString(),
            },
        ]
        const req = makeReq({
            authorization: "Bearer secret",
            "x-vercel-cron": "1",
        })
        const res = await GET(req)
        const body = await res.json()
        expect(body.t10Sent).toBe(0)
        const updates = state.updateCalls.filter(c => c.id === "u4")
        expect(updates).toHaveLength(0)
    })
})
