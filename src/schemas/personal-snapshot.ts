import { z } from "zod"
import { overduePlacementDate } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import {
  personalShadowEntityKey,
  personalShadowEntityKeySchema,
} from "@/schemas/remote-shadow-v2"

export const observedTaskPlacementSchema = taskPlacementSchema.refine(
  (record) =>
    record.scope !== "overdue" || record.date === overduePlacementDate,
  "Observed overdue placements require their canonical date"
)

// Optimistic local records may still have revision zero; remote effects require positive revisions.
export const localPreferenceRecordSchema = z.discriminatedUnion("store", [
  z.strictObject({ store: z.literal("tags"), record: tagSchema }),
  z.strictObject({ store: z.literal("itemViews"), record: itemViewSchema }),
  z.strictObject({
    store: z.literal("taskPlacements"),
    record: observedTaskPlacementSchema,
  }),
  z.strictObject({ store: z.literal("settings"), record: userSettingsSchema }),
])
export const personalSnapshotRecordSchema = z
  .strictObject({
    entityKey: personalShadowEntityKeySchema,
    record: localPreferenceRecordSchema.nullable(),
  })
  .refine(
    (snapshot) =>
      snapshot.record === null ||
      snapshot.entityKey === personalShadowEntityKey(snapshot.record),
    "Personal snapshot identity does not match its record"
  )

export const personalSnapshotKeysSchema = z
  .array(personalShadowEntityKeySchema)
  .max(10000)
  .refine(
    (keys) => new Set(keys).size === keys.length,
    "Duplicate personal snapshot keys"
  )
export const maximumPersonalSnapshotBytes = 2 * 1024 * 1024
export const personalSnapshotSchema = z
  .array(personalSnapshotRecordSchema)
  .max(10000)
  .refine(
    (records) =>
      new Set(records.map((record) => record.entityKey)).size ===
      records.length,
    "Duplicate personal snapshot identities"
  )
  .refine(
    (records) =>
      new TextEncoder().encode(JSON.stringify(records)).byteLength <=
      maximumPersonalSnapshotBytes,
    "Personal snapshot exceeds its byte limit"
  )
