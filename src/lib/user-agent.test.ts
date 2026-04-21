// src/lib/user-agent.test.ts
import { describe, it, expect } from "vitest"
import { parseUserAgent } from "./user-agent"

describe("parseUserAgent", () => {
  it("parses Chrome on Windows", () => {
    const r = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
    expect(r.browser).toBe("Chrome")
    expect(r.os).toBe("Windows")
  })
  it("parses Safari on iPhone", () => {
    const r = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604")
    expect(r.browser).toBe("Safari")
    expect(r.os).toBe("iOS")
  })
  it("parses Firefox on macOS", () => {
    const r = parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/120.0")
    expect(r.browser).toBe("Firefox")
    expect(r.os).toBe("macOS")
  })
  it("falls back to Sconosciuto on junk", () => {
    const r = parseUserAgent("node")
    expect(r.browser).toBe("Sconosciuto")
    expect(r.os).toBe("Sconosciuto")
  })
})
