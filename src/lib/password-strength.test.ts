// src/lib/password-strength.test.ts
import { describe, it, expect } from "vitest"
import { computeStrength } from "./password-strength"

describe("computeStrength", () => {
  it("returns score 0 and empty label for empty string", async () => {
    const r = await computeStrength("")
    expect(r.score).toBe(0)
    expect(r.label).toBe("")
  })

  it("returns score 0 with label 'Molto debole' for common dictionary word", async () => {
    const r = await computeStrength("password")
    expect(r.score).toBe(0)
    expect(r.label).toBe("Molto debole")
  })

  it("returns score >= 3 for a strong mixed password", async () => {
    const r = await computeStrength("MyN3wP@ssw0rdFit2026!")
    expect(r.score).toBeGreaterThanOrEqual(3)
  })

  it("produces a non-empty label for every non-empty input", async () => {
    const inputs = ["a", "ab", "abcd1234", "Pilates2026"]
    for (const input of inputs) {
      const r = await computeStrength(input)
      expect(r.label).not.toBe("")
    }
  })

  it("maps score 4 to 'Ottima'", async () => {
    const r = await computeStrength("correct horse battery staple 2026!")
    expect(r.score).toBe(4)
    expect(r.label).toBe("Ottima")
  })
})
