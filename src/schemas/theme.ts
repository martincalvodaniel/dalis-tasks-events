import { z } from "zod"
export const themePreferenceSchema = z.enum(["system", "light", "dark"])
export function parseThemePreference(value: unknown) {
  const result = themePreferenceSchema.safeParse(value)
  return result.success ? result.data : "system"
}
