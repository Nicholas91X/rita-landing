import { describe, it, expect } from "vitest"
import {
  emailSchema,
  passwordSchema,
  shortTextSchema,
  validate,
  ValidationError,
  formDataToObject,
} from "./validation"

describe("emailSchema", () => {
  it("accepts valid email and normalizes", () => {
    expect(emailSchema.parse("  Test@Example.COM  ")).toBe("test@example.com")
  })
  it("rejects invalid", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow()
  })
  it("rejects too long", () => {
    expect(() => emailSchema.parse("a".repeat(250) + "@b.com")).toThrow()
  })
})

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.parse("Abcdef12")).toBe("Abcdef12")
  })
  it("rejects too short", () => {
    expect(() => passwordSchema.parse("Abc12")).toThrow()
  })
  it("rejects missing uppercase", () => {
    expect(() => passwordSchema.parse("abcdef12")).toThrow()
  })
  it("rejects missing lowercase", () => {
    expect(() => passwordSchema.parse("ABCDEF12")).toThrow()
  })
  it("rejects missing digit", () => {
    expect(() => passwordSchema.parse("Abcdefgh")).toThrow()
  })
})

describe("shortTextSchema", () => {
  it("trims and accepts", () => {
    expect(shortTextSchema.parse("  hello  ")).toBe("hello")
  })
  it("rejects empty after trim", () => {
    expect(() => shortTextSchema.parse("   ")).toThrow()
  })
  it("rejects too long", () => {
    expect(() => shortTextSchema.parse("x".repeat(501))).toThrow()
  })
})

describe("validate()", () => {
  it("returns parsed data on success", () => {
    const result = validate(emailSchema, "user@test.com")
    expect(result).toBe("user@test.com")
  })
  it("throws ValidationError with fieldErrors on failure", () => {
    try {
      validate(emailSchema, "junk")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).fieldErrors).toBeDefined()
    }
  })
})

describe("formDataToObject()", () => {
  it("converts FormData entries to plain object", () => {
    const fd = new FormData()
    fd.append("a", "1")
    fd.append("b", "2")
    expect(formDataToObject(fd)).toEqual({ a: "1", b: "2" })
  })
})
