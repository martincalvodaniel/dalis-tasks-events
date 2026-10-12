import { expect, test } from "bun:test"
import { runInNewContext } from "node:vm"
import { THEME_STORAGE_KEY, themeBootstrapScript } from "@/config/theme"
import { parseThemePreference } from "@/schemas/theme"

test("device theme rejects corrupt values and defaults to system", () => {
  for (const value of [null, undefined, "invalid", {}, "DARK", "<script>"])
    expect(parseThemePreference(value)).toBe("system")
  for (const value of ["system", "light", "dark"] as const)
    expect(parseThemePreference(value)).toBe(value)
})
test("bootstrap sets the stored preference before any React client is mounted", () => {
  for (const value of [null, "invalid", "system", "light", "dark"]) {
    const attributes = new Map<string, string>()
    runInNewContext(themeBootstrapScript, {
      document: {
        documentElement: {
          setAttribute: (key: string, value: string) =>
            attributes.set(key, value),
        },
      },
      localStorage: {
        getItem: (key: string) => {
          expect(key).toBe(THEME_STORAGE_KEY)
          return value
        },
      },
    })
    expect(attributes.get("data-theme")).toBe(parseThemePreference(value))
  }
})
test("blocked storage still initializes a usable system theme", () => {
  const attributes = new Map<string, string>()
  runInNewContext(themeBootstrapScript, {
    document: {
      documentElement: {
        setAttribute: (key: string, value: string) =>
          attributes.set(key, value),
      },
    },
    localStorage: {
      getItem: () => {
        throw new Error("Storage unavailable")
      },
    },
  })
  expect(attributes.get("data-theme")).toBe("system")
})
