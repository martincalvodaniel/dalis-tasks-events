import { z } from "zod"
import {
  localPreferenceOutcomeV2Schema,
  maximumLocalOperationOutcomeBytes,
} from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { userSettingsSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const settingsIncidentSnapshotSchema = z
  .strictObject({
    entry: outboxEntrySchema,
    reason: z.enum([
      "conflict",
      "unavailable",
      "invalid_command",
      "identity_reuse",
    ]),
    outcome: localPreferenceOutcomeV2Schema,
    local: personalSnapshotSchema,
    localAtOutcome: personalSnapshotSchema,
    shadowAtOutcome: personalSnapshotSchema,
    remote: personalSnapshotSchema,
    intentions: z.array(outboxEntrySchema).min(1).max(10000),
    tagNames: z
      .record(z.string(), z.string())
      .refine(
        (value) => Object.keys(value).length <= 10000,
        "Incident tag catalog exceeds its limit"
      ),
    blockedByRelatedIntentions: z.boolean(),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Settings comparison exceeds its byte limit"
  )
export const settingsResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_local"]),
    createdAt: timestampSchema,
    expected: settingsIncidentSnapshotSchema,
  })
  .refine(
    (value) =>
      (value.choice === "retry_local") === (value.operationId !== null),
    "Settings choice requires its matching operation identity"
  )
export const settingsResolutionRecordSchema = settingsResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    local: userSettingsSchema,
    replacement: syncOperationSchema.nullable(),
    supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
  })
  .refine(
    (value) =>
      value.key === `settings-resolution:${value.resolutionId}` &&
      value.local.userId === value.userId &&
      value.operationId === (value.replacement?.operationId ?? null) &&
      (!value.replacement ||
        value.replacement.command.type === "settings.update"),
    "Settings decision does not match its durable identities"
  )
