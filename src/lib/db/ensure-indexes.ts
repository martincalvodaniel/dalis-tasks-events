import "server-only"

import type {
  Collection,
  CreateIndexesOptions,
  IndexSpecification,
} from "mongodb"
import { AUTH_MODEL_NAMES } from "@/lib/db/auth-models"

export interface IndexDatabase {
  collection(name: string): Pick<Collection, "createIndex">
}

export interface IndexSpec {
  collection: string
  keys: IndexSpecification
  options: CreateIndexesOptions & { name: string }
  provisioning?: "explicit"
}

// Add index specifications here alongside the feature that introduces the
// collection or query pattern. Do not add speculative indexes.
export const INDEX_SPECS: readonly IndexSpec[] = [
  {
    collection: "item_views",
    keys: { userId: 1, itemId: 1 },
    options: { name: "item_views_user_item_uidx", unique: true },
    provisioning: "explicit",
  },
  {
    collection: "tags",
    keys: { userId: 1, id: 1 },
    options: { name: "tags_user_id_uidx", unique: true },
    provisioning: "explicit",
  },
  {
    collection: "tags",
    keys: { userId: 1, normalizedName: 1 },
    options: {
      name: "tags_user_active_name_uidx",
      unique: true,
      partialFilterExpression: { deletedAt: null },
    },
    provisioning: "explicit",
  },
  {
    collection: "sync_operations",
    keys: { actorUserId: 1, operationId: 1 },
    options: { name: "sync_operations_actor_operation_uidx", unique: true },
  },
  {
    collection: "sync_changes",
    keys: { recipientUserId: 1, sequence: 1 },
    options: { name: "sync_changes_recipient_sequence_uidx", unique: true },
  },
  {
    collection: "items",
    keys: { ownerId: 1, _id: 1 },
    options: { name: "items_owner_id_idx" },
  },
  {
    collection: AUTH_MODEL_NAMES.user,
    keys: { email: 1 },
    options: { name: "users_email_uidx", unique: true },
  },
  {
    collection: AUTH_MODEL_NAMES.session,
    keys: { token: 1 },
    options: { name: "sessions_token_uidx", unique: true },
  },
  {
    collection: AUTH_MODEL_NAMES.session,
    keys: { userId: 1 },
    options: { name: "sessions_userId_idx" },
  },
  {
    collection: AUTH_MODEL_NAMES.account,
    keys: { userId: 1 },
    options: { name: "accounts_userId_idx" },
  },
  {
    collection: AUTH_MODEL_NAMES.account,
    keys: { providerId: 1, accountId: 1 },
    options: { name: "accounts_providerId_accountId_uidx", unique: true },
  },
  {
    collection: AUTH_MODEL_NAMES.verification,
    keys: { identifier: 1 },
    options: { name: "verifications_identifier_idx" },
  },
]

export function validateIndexSpecs(specs: readonly IndexSpec[]): void {
  const namesByCollection = new Map<string, Set<string>>()

  for (const spec of specs) {
    const collection = spec.collection.trim()
    const name = spec.options.name.trim()

    if (!collection || !name) {
      throw new Error("MongoDB indexes require a collection and a stable name")
    }
    if (spec.provisioning !== undefined && spec.provisioning !== "explicit") {
      throw new Error("Invalid MongoDB index provisioning policy")
    }

    const collectionNames = namesByCollection.get(collection) ?? new Set()
    if (collectionNames.has(name)) {
      throw new Error(`Duplicate MongoDB index name: ${collection}.${name}`)
    }

    collectionNames.add(name)
    namesByCollection.set(collection, collectionNames)
  }
}

export function automaticIndexSpecs(
  catalog: readonly IndexSpec[] = INDEX_SPECS
): readonly IndexSpec[] {
  // Validate staged entries too, before excluding them from automatic writes.
  validateIndexSpecs(catalog)
  return catalog.filter((spec) => spec.provisioning !== "explicit")
}

export async function ensureIndexes(
  database: IndexDatabase,
  specs: readonly IndexSpec[] = automaticIndexSpecs()
): Promise<void> {
  validateIndexSpecs(specs)

  for (const spec of specs) {
    await database
      .collection(spec.collection)
      .createIndex(spec.keys, spec.options)
  }
}
