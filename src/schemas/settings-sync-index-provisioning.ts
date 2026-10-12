import { z } from "zod"
import { recurringSyncIndexNames } from "@/schemas/recurring-sync-index-provisioning"
export const settingsSyncIndexNames = [
  ...recurringSyncIndexNames,
  "user_settings_user_uidx",
] as const
export const settingsSyncIndexNameSchema = z.enum(settingsSyncIndexNames)
export const settingsSyncIndexReadinessSchema = z
  .strictObject({
    ready: z.boolean(),
    missing: z.array(settingsSyncIndexNameSchema).max(6),
    incompatible: z.array(settingsSyncIndexNameSchema).max(6),
  })
  .refine((value) => {
    const names = [...value.missing, ...value.incompatible]
    return (
      new Set(names).size === names.length &&
      value.ready === (names.length === 0)
    )
  }, "Settings index readiness must contain distinct coherent registered names")
