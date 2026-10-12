import { z } from "zod"
import { userIdSchema } from "@/schemas/primitives"

export function userSettingsEntityKey(actorInput: unknown): string {
  return `settings:${userIdSchema.parse(actorInput)}`
}
export const userSettingsEntityKeySchema = z.string().refine((value) => {
  if (!value.startsWith("settings:")) return false
  const actor = userIdSchema.safeParse(value.slice(9))
  return actor.success && value === userSettingsEntityKey(actor.data)
}, "Invalid personal settings entity key")
