import { z } from "zod"

export const mixedSyncIndexNames = [
  "item_views_user_item_uidx",
  "tags_user_id_uidx",
  "tags_user_active_name_uidx",
] as const
export const mixedSyncIndexNameSchema = z.enum(mixedSyncIndexNames)

export const mixedSyncIndexReadinessSchema = z
  .strictObject({
    ready: z.boolean(),
    missing: z.array(mixedSyncIndexNameSchema).max(3),
    incompatible: z.array(mixedSyncIndexNameSchema).max(3),
  })
  .refine((value) => {
    const names = [...value.missing, ...value.incompatible]
    return (
      new Set(names).size === names.length &&
      value.ready === (names.length === 0)
    )
  }, "Index readiness must have distinct, coherent registered names")
