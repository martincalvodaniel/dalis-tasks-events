import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"
import { remoteTagSchema } from "@/schemas/remote-tag-planning"
import { settingsIncidentSnapshotSchema } from "@/schemas/settings-resolution"

export const tagCatalogResolutionCaptureSchema = z.strictObject({
  userId: userIdSchema,
  incident: settingsIncidentSnapshotSchema,
  entries: z.array(outboxEntrySchema).max(10000),
  localTags: z.array(tagSchema).max(10000),
  observedTags: z.array(remoteTagSchema).max(10000),
})
export const tagCatalogResolutionSnapshotSchema = z
  .strictObject({
    incident: settingsIncidentSnapshotSchema,
    localTags: z.array(tagSchema).max(10000),
    observedTags: z.array(remoteTagSchema).max(10000),
    acknowledgedDependencies: z.array(outboxEntrySchema).max(10000),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Category catalog comparison exceeds its byte limit"
  )
