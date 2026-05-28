import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

type AnyRow = Record<string, unknown>

interface MockState {
    userId: string | null
    subs: AnyRow[]
    oneTimes: AnyRow[]
    profile: AnyRow | null
    levels: AnyRow[]
}

const state: MockState = {
    userId: "u1",
    subs: [],
    oneTimes: [],
    profile: null,
    levels: [],
}

function buildQueryBuilder(table: string) {
    const finalThen = (cb: (v: { data: AnyRow[]; error: null }) => unknown) =>
        cb({
            data:
                table === "user_subscriptions"
                    ? state.subs
                    : table === "one_time_purchases"
                        ? state.oneTimes
                        : table === "levels"
                            ? state.levels
                            : [],
            error: null,
        })

    const builder: AnyRow = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        not: vi.fn(() => builder),
        single: vi.fn(async () => ({
            data: table === "profiles" ? state.profile : null,
            error: null,
        })),
        then: finalThen,
    }
    return builder
}

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: state.userId ? { id: state.userId } : null },
            })),
        },
        from: vi.fn((t: string) => buildQueryBuilder(t)),
    })),
}))

import { getContentHierarchy, getPublicContentHierarchy } from "./content"

function resetState() {
    state.userId = "u1"
    state.subs = []
    state.oneTimes = []
    state.profile = { account_type: "standard", lead_expires_at: null }
    state.levels = []
}

describe("getContentHierarchy — lead access gating", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetState()
    })

    it("marks lead package as purchased when lead within window", async () => {
        state.profile = {
            account_type: "lead",
            lead_expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        }
        state.oneTimes = [{ package_id: "pkg-lead", status: "lead" }]
        state.levels = [
            {
                id: "L1",
                name: "Lead",
                courses: [
                    {
                        id: "C1",
                        name: "Free",
                        packages: [
                            {
                                id: "pkg-lead",
                                name: "Lezioni Gratis",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 0,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: true,
                            },
                        ],
                    },
                ],
            },
        ]
        const result = await getContentHierarchy()
        expect(result[0].courses[0].packages[0].isPurchased).toBe(true)
    })

    it("treats lead package as not purchased when lead window expired", async () => {
        state.profile = {
            account_type: "lead",
            lead_expires_at: new Date(Date.now() - 86400000).toISOString(),
        }
        state.oneTimes = [{ package_id: "pkg-lead", status: "lead" }]
        state.levels = [
            {
                id: "L1",
                name: "Lead",
                courses: [
                    {
                        id: "C1",
                        name: "Free",
                        packages: [
                            {
                                id: "pkg-lead",
                                name: "Lezioni Gratis",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 0,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: true,
                            },
                        ],
                    },
                ],
            },
        ]
        const result = await getContentHierarchy()
        // hidden_from_discover + not in purchasedIds → filtered out
        expect(result[0].courses[0].packages).toHaveLength(0)
    })

    it("filters hidden_from_discover packages for standard users without access", async () => {
        state.profile = { account_type: "standard", lead_expires_at: null }
        state.oneTimes = []
        state.levels = [
            {
                id: "L1",
                name: "Visibile",
                courses: [
                    {
                        id: "C1",
                        name: "Mix",
                        packages: [
                            {
                                id: "pkg-public",
                                name: "Pubblico",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 1000,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: false,
                            },
                            {
                                id: "pkg-hidden",
                                name: "Nascosto",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 0,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: true,
                            },
                        ],
                    },
                ],
            },
        ]
        const result = await getContentHierarchy()
        const pkgIds = result[0].courses[0].packages.map(
            (p: { id: string }) => p.id,
        )
        expect(pkgIds).toEqual(["pkg-public"])
    })

    it("keeps hidden_from_discover package visible when user already purchased it", async () => {
        state.profile = { account_type: "standard", lead_expires_at: null }
        state.oneTimes = [{ package_id: "pkg-hidden", status: "completed" }]
        state.levels = [
            {
                id: "L1",
                name: "Visibile",
                courses: [
                    {
                        id: "C1",
                        name: "Mix",
                        packages: [
                            {
                                id: "pkg-hidden",
                                name: "Già acquistato",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 0,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: true,
                            },
                        ],
                    },
                ],
            },
        ]
        const result = await getContentHierarchy()
        expect(result[0].courses[0].packages).toHaveLength(1)
        expect(result[0].courses[0].packages[0].isPurchased).toBe(true)
    })
})

describe("getPublicContentHierarchy — hidden filter", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetState()
    })

    it("filters out hidden_from_discover packages", async () => {
        state.levels = [
            {
                id: "L1",
                name: "Public",
                courses: [
                    {
                        id: "C1",
                        name: "Mix",
                        packages: [
                            {
                                id: "pkg-public",
                                name: "Pubblico",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 1000,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: false,
                            },
                            {
                                id: "pkg-hidden",
                                name: "Nascosto",
                                title: null,
                                subtitle: null,
                                description: "",
                                stripe_price_id: "",
                                price: 0,
                                image_url: null,
                                payment_mode: "payment",
                                hidden_from_discover: true,
                            },
                        ],
                    },
                ],
            },
        ]
        const result = await getPublicContentHierarchy()
        const pkgIds = result[0].courses[0].packages.map(
            (p: { id: string }) => p.id,
        )
        expect(pkgIds).toEqual(["pkg-public"])
    })
})
