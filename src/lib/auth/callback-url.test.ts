import { describe, expect, test } from "bun:test"
import { getSafeCallbackUrl } from "./callback-url"

describe("getSafeCallbackUrl", () => {
  test("keeps internal paths", () => {
    expect(getSafeCallbackUrl("/household?tab=tasks")).toBe(
      "/household?tab=tasks"
    )
  })

  test("rejects absolute and protocol-relative URLs", () => {
    expect(getSafeCallbackUrl("https://example.com")).toBe("/")
    expect(getSafeCallbackUrl("//example.com")).toBe("/")
  })

  test("falls back when no callback is provided", () => {
    expect(getSafeCallbackUrl(undefined)).toBe("/")
  })
})
