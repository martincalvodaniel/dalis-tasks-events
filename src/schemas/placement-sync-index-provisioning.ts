import { z } from "zod"
import { mixedSyncIndexNames } from "@/schemas/mixed-sync-index-provisioning"

export const placementSyncIndexNames = [
  ...mixedSyncIndexNames,
  "task_placements_user_scope_date_occurrence_uidx",
] as const
export const placementSyncIndexNameSchema = z.enum(placementSyncIndexNames)

export const placementSyncIndexReadinessSchema = z
  .strictObject({
    ready: z.boolean(),
    missing: z.array(placementSyncIndexNameSchema).max(4),
    incompatible: z.array(placementSyncIndexNameSchema).max(4),
  })
  .refine((value) => {
    const names = [...value.missing, ...value.incompatible]
    return (
      new Set(names).size === names.length &&
      value.ready === (names.length === 0)
    )
  }, "Index readiness must have distinct, coherent registered names")
