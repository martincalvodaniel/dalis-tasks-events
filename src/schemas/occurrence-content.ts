import { z } from "zod"
import { descriptionSchema, titleSchema } from "@/schemas/primitives"

export const occurrenceContentSchema = z.strictObject({
  title: titleSchema,
  description: descriptionSchema,
})
