import { z } from "zod"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const workspaceIdentitySchema = z.strictObject({ userId: userIdSchema })
export const preparedAccountSchema = z.strictObject({
  version: z.literal(1),
  userId: userIdSchema,
  preparedAt: timestampSchema,
})
export const offlineWorkerStatusSchema = z.strictObject({
  type: z.literal("OFFLINE_STATUS"),
  ready: z.boolean(),
  version: z.string().min(1).max(128),
})

export const accountControlSchema = z
  .strictObject({
    version: z.literal(1),
    epoch: entityIdSchema,
    userId: userIdSchema.nullable(),
    preparedAt: timestampSchema.nullable(),
    logoutPending: z.boolean(),
  })
  .refine(
    (control) => (control.userId === null) === (control.preparedAt === null),
    "Prepared account metadata is inconsistent"
  )
  .refine(
    (control) => !control.logoutPending || control.userId === null,
    "Pending logout cannot have an active account"
  )
