import { z } from "zod"
import { overduePlacementDate, taskReferenceIdSchema } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import {
  entityIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const maximumPreferenceEffectsBytes = 512 * 1024
const remoteRevision = revisionSchema.min(1)

export const preferenceEffectSchema = z.discriminatedUnion("store", [
  z.strictObject({
    store: z.literal("tags"),
    record: tagSchema.safeExtend({ revision: remoteRevision }),
  }),
  z.strictObject({
    store: z.literal("itemViews"),
    record: itemViewSchema.extend({ revision: remoteRevision }),
  }),
  z.strictObject({
    store: z.literal("taskPlacements"),
    record: taskPlacementSchema
      .extend({ revision: remoteRevision, occurrenceId: taskReferenceIdSchema })
      .refine(
        (record) =>
          record.scope !== "overdue" || record.date === overduePlacementDate,
        "Remote overdue placements require their canonical date"
      ),
  }),
  z.strictObject({
    store: z.literal("settings"),
    record: userSettingsSchema.extend({ revision: remoteRevision }),
  }),
])

// Document identity is distinct from the primary entity key of an intention.
export function preferenceEffectKey(
  effect: z.infer<typeof preferenceEffectSchema>
): string {
  const record = effect.record
  switch (effect.store) {
    case "tags":
      return JSON.stringify([effect.store, record.userId, effect.record.id])
    case "itemViews":
      return JSON.stringify([effect.store, record.userId, effect.record.itemId])
    case "taskPlacements":
      return JSON.stringify([
        effect.store,
        record.userId,
        effect.record.occurrenceId,
        effect.record.scope,
        effect.record.date,
      ])
    case "settings":
      return JSON.stringify([effect.store, record.userId])
  }
}

// This preparatory DTO does not change the active transport or grant an ACK.
export const remotePreferenceEffectsSchema = z
  .strictObject({
    version: z.literal(1),
    userId: userIdSchema,
    operationId: entityIdSchema,
    sequence: revisionSchema.min(1),
    effects: z.array(preferenceEffectSchema).min(1).max(10000),
  })
  .superRefine((value, context) => {
    const keys = new Set<string>()
    for (const [index, effect] of value.effects.entries()) {
      if (effect.record.userId !== value.userId)
        context.addIssue({
          code: "custom",
          path: ["effects", index, "record", "userId"],
          message: "Preference effect belongs to another account",
        })
      const key = preferenceEffectKey(effect)
      if (keys.has(key))
        context.addIssue({
          code: "custom",
          path: ["effects", index],
          message: "Duplicate preference effect identity",
        })
      keys.add(key)
    }
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      maximumPreferenceEffectsBytes
    )
      context.addIssue({
        code: "custom",
        message: "Preference effects exceed their byte limit",
      })
  })
