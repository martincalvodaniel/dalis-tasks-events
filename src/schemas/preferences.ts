import { z } from "zod"
import {
  civilDateSchema,
  entityIdSchema,
  occurrenceIdSchema,
  positionSchema,
  recordMetadataShape,
  timeZoneSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const tagDraftSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: positionSchema,
})
export const tagSchema = tagDraftSchema
  .extend({
    id: entityIdSchema,
    userId: userIdSchema,
    normalizedName: z.string().min(1).max(120),
    ...recordMetadataShape,
  })
  .refine(
    (tag) => tag.normalizedName === tag.name.normalize("NFKC").toLowerCase(),
    "Tag name normalization does not match"
  )

export const itemViewSchema = z.strictObject({
  userId: userIdSchema,
  itemId: entityIdSchema,
  primaryTagId: entityIdSchema.nullable(),
  ...recordMetadataShape,
})
export const taskPlacementSchema = z.strictObject({
  userId: userIdSchema,
  occurrenceId: occurrenceIdSchema,
  scope: z.enum(["day", "overdue"]),
  date: civilDateSchema,
  tagId: entityIdSchema.nullable(),
  position: positionSchema,
  ...recordMetadataShape,
})
export const userSettingsInputSchema = z.strictObject({
  timeZone: timeZoneSchema,
  weekStartsOn: z.literal(1),
  locale: z.literal("es-ES"),
})
export const userSettingsSchema = userSettingsInputSchema.extend({
  userId: userIdSchema,
  ...recordMetadataShape,
})
