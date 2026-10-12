import { z } from "zod"
import {
  civilDateSchema,
  entityIdSchema,
  occurrenceIdSchema,
} from "@/schemas/primitives"

export const birthdayAppearanceSchema = z
  .strictObject({
    kind: z.literal("birthday"),
    id: occurrenceIdSchema,
    seriesId: entityIdSchema,
    slotKey: civilDateSchema,
    date: civilDateSchema,
    age: z.number().int().min(0).max(9998).nullable(),
  })
  .refine(
    (appearance) =>
      appearance.slotKey === appearance.date &&
      appearance.id === `${appearance.seriesId}:${appearance.slotKey}`,
    "Birthday appearance identity must preserve its civil date"
  )
