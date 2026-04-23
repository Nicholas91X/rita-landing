// @vitest-environment jsdom
// src/components/auth/PasswordStrengthMeter.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"

vi.mock("@/lib/password-strength", () => ({
  computeStrength: vi.fn(async (v: string) => {
    if (!v) return { score: 0, label: "" }
    if (v === "weak") return { score: 1, label: "Debole" }
    if (v === "strong") return { score: 4, label: "Ottima" }
    return { score: 2, label: "Media" }
  }),
}))

describe("<PasswordStrengthMeter />", () => {
  it("renders 5 segments, all empty style, when value is empty", () => {
    const { container } = render(<PasswordStrengthMeter value="" />)
    const bars = container.querySelectorAll("[data-bar]")
    expect(bars.length).toBe(5)
    bars.forEach((bar) => {
      expect(bar.className).toContain("bg-neutral-200")
    })
    expect(screen.queryByText(/debole|media|forte|ottima/i)).toBeNull()
  })

  it("renders label and colored bars when value is strong", async () => {
    render(<PasswordStrengthMeter value="strong" />)
    await waitFor(() => {
      expect(screen.getByText("Ottima")).toBeInTheDocument()
    })
  })
})
