import type { z } from "zod"
import {
  userSettingsInputSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import type { UserSettings } from "@/types/preferences"

export function applyUserSettingsCommand(
  currentInput: UserSettings | null,
  input: z.input<typeof userSettingsInputSchema>,
  userIdInput: string,
  timestampInput: string
): UserSettings {
  const current = userSettingsSchema.nullable().parse(currentInput)
  const userId = userIdSchema.parse(userIdInput)
  const timestamp = timestampSchema.parse(timestampInput)
  if (current && (current.userId !== userId || current.deletedAt))
    throw new Error("Personal settings are unavailable in this account")
  return userSettingsSchema.parse({
    ...userSettingsInputSchema.parse(input),
    userId,
    revision: current?.revision ?? 0,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
}
