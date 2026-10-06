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
}

// Add index specifications here alongside the feature that introduces the
// collection or query pattern. Do not add speculative indexes.
export const INDEX_SPECS: readonly IndexSpec[] = [
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

    const collectionNames = namesByCollection.get(collection) ?? new Set()
    if (collectionNames.has(name)) {
      throw new Error(`Duplicate MongoDB index name: ${collection}.${name}`)
    }

    collectionNames.add(name)
    namesByCollection.set(collection, collectionNames)
  }
}

export async function ensureIndexes(
  database: IndexDatabase,
  specs: readonly IndexSpec[] = INDEX_SPECS
): Promise<void> {
  validateIndexSpecs(specs)

  for (const spec of specs) {
    await database
      .collection(spec.collection)
      .createIndex(spec.keys, spec.options)
  }
}
