import { z } from "zod"
import { itemViewResolutionRecordSchema } from "@/schemas/item-view-resolution"
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
import { planCategoryResolutionRecordSchema } from "@/schemas/plan-category-resolution"
import { planOccurrenceResolutionRecordSchema } from "@/schemas/plan-occurrence-resolution"
import { settingsResolutionRecordSchema } from "@/schemas/settings-resolution"
import { tagOrderResolutionRecordSchema } from "@/schemas/tag-order-resolution"
import { tagResolutionRecordSchema } from "@/schemas/tag-resolution"

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
          tagResolutionRecordSchema,
          itemViewResolutionRecordSchema,
          tagOrderResolutionRecordSchema,
          planCategoryResolutionRecordSchema,
          planOccurrenceResolutionRecordSchema,
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
