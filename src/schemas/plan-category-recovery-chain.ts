import { z } from "zod"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import { syncIncidentSnapshotSchema } from "@/schemas/sync-incident"

export const planCategoryRecoveryChainInputSchema = z.strictObject({
  userId: userIdSchema,
  incident: syncIncidentSnapshotSchema,
  entries: z.array(outboxEntrySchema).max(10000),
})
