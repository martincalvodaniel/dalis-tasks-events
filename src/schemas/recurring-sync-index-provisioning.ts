import { z } from "zod"
import { placementSyncIndexNames } from "@/schemas/placement-sync-index-provisioning"

export const recurringSyncIndexNames = [
  ...placementSyncIndexNames,
  "plan_occurrences_user_series_slot_uidx",
] as const
export const recurringSyncIndexNameSchema = z.enum(recurringSyncIndexNames)

export const recurringSyncIndexReadinessSchema = z
  .strictObject({
    ready: z.boolean(),
    missing: z.array(recurringSyncIndexNameSchema).max(5),
    incompatible: z.array(recurringSyncIndexNameSchema).max(5),
  })
  .refine((value) => {
    const names = [...value.missing, ...value.incompatible]
    return (
      new Set(names).size === names.length &&
      value.ready === (names.length === 0)
    )
  }, "Index readiness must have distinct, coherent registered names")
