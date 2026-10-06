import { z } from "zod"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"

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
