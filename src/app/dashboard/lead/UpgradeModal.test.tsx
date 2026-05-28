// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest"
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react"

const {
    mockUpgrade,
    mockRouterRefresh,
    mockConfetti,
    mockToastSuccess,
    mockToastError,
} = vi.hoisted(() => ({
    mockUpgrade: vi.fn(),
    mockRouterRefresh: vi.fn(),
    mockConfetti: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
}))

vi.mock("@/app/actions/lead", () => ({
    upgradeLeadToStandard: mockUpgrade,
}))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRouterRefresh }),
}))
vi.mock("canvas-confetti", () => ({
    default: (...args: unknown[]) => mockConfetti(...args),
}))
vi.mock("sonner", () => ({
    toast: { success: mockToastSuccess, error: mockToastError },
}))
vi.mock("@/lib/password-strength", () => ({
    computeStrength: vi.fn(async () => ({ score: 4, label: "Ottima" })),
}))

import UpgradeModal from "./UpgradeModal"

function fillPassword(value: string) {
    fireEvent.change(screen.getByLabelText("Password"), { target: { value } })
}

function submit() {
    fireEvent.click(screen.getByRole("button", { name: /completa/i }))
}

describe("<UpgradeModal />", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })
    afterEach(() => {
        cleanup()
    })

    it("shows inline error when upgrade returns ok=false", async () => {
        mockUpgrade.mockResolvedValue({ ok: false, message: "Password compromessa" })

        render(<UpgradeModal open={true} onOpenChange={vi.fn()} />)
        fillPassword("ValidPass123!")
        submit()

        await waitFor(() => {
            expect(screen.getByText(/password compromessa/i)).toBeInTheDocument()
        })
        expect(mockRouterRefresh).not.toHaveBeenCalled()
    })

    it("fires confetti, toast, refresh and closes on success", async () => {
        mockUpgrade.mockResolvedValue({ ok: true, data: undefined })
        const onOpenChange = vi.fn()

        render(<UpgradeModal open={true} onOpenChange={onOpenChange} />)
        fillPassword("ValidPass123!")
        submit()

        await waitFor(() => {
            expect(mockUpgrade).toHaveBeenCalled()
        }, { timeout: 3000 })
        await waitFor(() => {
            expect(mockConfetti).toHaveBeenCalled()
        })
        expect(mockToastSuccess).toHaveBeenCalled()
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(mockRouterRefresh).toHaveBeenCalled()
    })

    it("does not submit when the form is invalid", async () => {
        render(<UpgradeModal open={true} onOpenChange={vi.fn()} />)
        // No password entered → resolver should block submission
        submit()
        // Give react-hook-form a tick to run the resolver
        await new Promise((r) => setTimeout(r, 50))
        expect(mockUpgrade).not.toHaveBeenCalled()
    })
})
