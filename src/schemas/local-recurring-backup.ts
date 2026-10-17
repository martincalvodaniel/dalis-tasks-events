import { z } from "zod"
import {
  localBackupMetadataV2Schema,
  localBackupStoresV2Schema,
  localBackupV1Schema,
  localBackupV2Schema,
} from "@/schemas/local-backup"
import {
  localPlanOccurrenceOutcomeSchema,
  remoteRecurringShadowSchema,
} from "@/schemas/local-plan-occurrence-sync"
import { remoteShadowSchema } from "@/schemas/local-sync"
import { settingsResolutionRecordSchema } from "@/schemas/settings-resolution"

// Portable format three does not change intention one or durable evidence two.
export const localRecurringBackupV3Schema = localBackupV2Schema.extend({
  version: z.literal(3),
  stores: localBackupStoresV2Schema.extend({
    remoteShadows: z
      .array(z.union([remoteShadowSchema, remoteRecurringShadowSchema]))
      .max(10000),
    syncMetadata: z
      .array(
        z.union([
          localBackupMetadataV2Schema,
          localPlanOccurrenceOutcomeSchema,
          settingsResolutionRecordSchema,
        ])
      )
      .max(10000),
  }),
})
export const localRecurringBackupSchema = z.discriminatedUnion("version", [
  localBackupV1Schema,
  localBackupV2Schema,
  localRecurringBackupV3Schema,
])
