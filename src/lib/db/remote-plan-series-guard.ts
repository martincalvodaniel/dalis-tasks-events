import "server-only"

import { randomUUID } from "node:crypto"
import type { ClientSession } from "mongodb"
import { z } from "zod"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { PreferenceCompareAndSwapError } from "@/lib/db/remote-preference-transactions"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"

const guardSchema = z.strictObject({
  _id: z.string(),
  userId: userIdSchema,
  seriesId: entityIdSchema,
  token: entityIdSchema,
})
type GuardDocument = z.infer<typeof guardSchema>

// Both future series and appearance executors must write this guard after
// authorization, within their shared snapshot transaction. It is not a lease,
// a semantic revision, or proof of authorization on its own.
export async function writeRemotePlanSeriesGuard(
  actorInput: unknown,
  seriesIdInput: unknown,
  session: ClientSession
): Promise<void> {
  const userId = userIdSchema.parse(actorInput)
  const seriesId = entityIdSchema.parse(seriesIdInput)
  if (!session.inTransaction())
    throw new Error("Plan series guards require an active transaction")
  const _id = JSON.stringify([userId, seriesId])
  const collection = await getCollection<GuardDocument>(
    COLLECTION_NAMES.planSeriesGuards
  )
  const stored = await collection.findOne({ _id }, { session })
  const next = guardSchema.parse({ _id, userId, seriesId, token: randomUUID() })
  if (!stored) {
    // An insert race must abort and retry the entire transaction, including
    // authorization. Never swallow the duplicate inside an active session.
    await collection.insertOne(next, { session })
    return
  }
  const previous = guardSchema.parse(stored)
  if (previous.userId !== userId || previous.seriesId !== seriesId)
    throw new Error("Stored plan series guard identity is inconsistent")
  const result = await collection.replaceOne(previous, next, { session })
  if (result.matchedCount !== 1)
    throw new PreferenceCompareAndSwapError(
      "Plan series guard changed concurrently"
    )
}
