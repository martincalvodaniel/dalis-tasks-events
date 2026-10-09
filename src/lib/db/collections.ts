import "server-only"

import type { Collection, Document } from "mongodb"
import { AUTH_MODEL_NAMES } from "@/lib/db/auth-models"
import { getDatabase } from "@/lib/db/client"

// Register collection names here alongside the feature that introduces them.
export const COLLECTION_NAMES = {
  items: "items",
  tags: "tags",
  itemViews: "item_views",
  taskPlacements: "task_placements",
  syncOperations: "sync_operations",
  syncChanges: "sync_changes",
  syncCounters: "sync_counters",
  authUser: AUTH_MODEL_NAMES.user,
  authAccount: AUTH_MODEL_NAMES.account,
  authSession: AUTH_MODEL_NAMES.session,
  authVerification: AUTH_MODEL_NAMES.verification,
} as const satisfies Record<string, string>

export type CollectionName =
  (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES]

export async function getCollection<Schema extends Document>(
  name: CollectionName
): Promise<Collection<Schema>> {
  const database = await getDatabase()
  return database.collection<Schema>(name)
}
