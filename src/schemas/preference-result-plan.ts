import { z } from "zod"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { localSyncResultInputV2Schema } from "@/schemas/local-sync-result-v2"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { userIdSchema } from "@/schemas/primitives"
import { remoteShadowV2Schema } from "@/schemas/remote-shadow-v2"

export const preferenceResultPlanInputSchema = z.strictObject({
  userId: userIdSchema,
  submission: localSyncResultInputV2Schema,
  local: personalSnapshotSchema,
  shadows: z.array(remoteShadowV2Schema).max(10000),
  entries: z.array(outboxEntrySchema).max(10000),
  existingOutcome: z.unknown().nullable(),
})
