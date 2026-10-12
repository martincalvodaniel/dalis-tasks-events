import { z } from "zod"
import { userSettingsSchema } from "@/schemas/preferences"
import {
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const remoteUserSettingsSchema = userSettingsSchema.extend({
  revision: revisionSchema.min(1),
})
export const remoteUserSettingsPlanningInputSchema = z
  .strictObject({
    userId: userIdSchema,
    timestamp: timestampSchema,
    operation: syncOperationSchema,
    current: remoteUserSettingsSchema.nullable(),
  })
  .refine(
    (value) => value.current === null || value.current.userId === value.userId,
    "Personal settings belong to another account"
  )
