import "server-only"

import { describe, expect, test } from "bun:test"
import { getAuthTables } from "better-auth/db"
import { AUTH_MODEL_NAMES } from "@/lib/db/auth-models"
import { COLLECTION_NAMES } from "@/lib/db/collections"
import type { IndexSpec } from "./ensure-indexes"
import {
  ensureIndexes,
  INDEX_SPECS,
  type IndexDatabase,
  validateIndexSpecs,
} from "./ensure-indexes"

describe("MongoDB index specifications", () => {
  test("the application index registry is valid", () => {
    expect(() => validateIndexSpecs(INDEX_SPECS)).not.toThrow()
  })

  test("covers the installed auth schema's automatic index requests", () => {
    const tables = getAuthTables({
      user: { modelName: AUTH_MODEL_NAMES.user },
      session: { modelName: AUTH_MODEL_NAMES.session },
      account: { modelName: AUTH_MODEL_NAMES.account },
      verification: { modelName: AUTH_MODEL_NAMES.verification },
    })

    for (const table of Object.values(tables)) {
      expect(
        Object.values(COLLECTION_NAMES).some((name) => name === table.modelName)
      ).toBe(true)
      for (const [field, attributes] of Object.entries(table.fields)) {
        if (!attributes.unique && !attributes.index) continue
        expect(INDEX_SPECS).toContainEqual({
          collection: table.modelName,
          keys: { [attributes.fieldName ?? field]: 1 },
          options: attributes.unique
            ? { name: `${table.modelName}_${field}_uidx`, unique: true }
            : { name: `${table.modelName}_${field}_idx` },
        })
      }
    }
  })

  test("a Google account can belong to only one persisted user", () => {
    expect(INDEX_SPECS).toContainEqual({
      collection: COLLECTION_NAMES.authAccount,
      keys: { providerId: 1, accountId: 1 },
      options: { name: "accounts_providerId_accountId_uidx", unique: true },
    })
  })

  test("rejects duplicate names within a collection", () => {
    const specs: IndexSpec[] = [
      {
        collection: "items",
        keys: { createdAt: -1 },
        options: { name: "created_at_desc" },
      },
      {
        collection: "items",
        keys: { updatedAt: -1 },
        options: { name: "created_at_desc" },
      },
    ]

    expect(() => validateIndexSpecs(specs)).toThrow(
      "Duplicate MongoDB index name: items.created_at_desc"
    )
  })

  test("allows the same index name in different collections", () => {
    const specs: IndexSpec[] = [
      {
        collection: "items",
        keys: { createdAt: -1 },
        options: { name: "created_at_desc" },
      },
      {
        collection: "tasks",
        keys: { createdAt: -1 },
        options: { name: "created_at_desc" },
      },
    ]

    expect(() => validateIndexSpecs(specs)).not.toThrow()
  })

  test("creates every registered index with its options", async () => {
    const calls: Array<{ collection: string; name: string }> = []
    const database: IndexDatabase = {
      collection: (collection) => ({
        createIndex: async (_keys, options) => {
          calls.push({ collection, name: options?.name ?? "" })
          return options?.name ?? ""
        },
      }),
    }
    const specs: IndexSpec[] = [
      {
        collection: "items",
        keys: { createdAt: -1 },
        options: { name: "created_at_desc" },
      },
      {
        collection: "tasks",
        keys: { ownerId: 1, dueAt: 1 },
        options: { name: "owner_id_asc_due_at_asc" },
      },
    ]

    await ensureIndexes(database, specs)

    expect(calls).toEqual([
      { collection: "items", name: "created_at_desc" },
      { collection: "tasks", name: "owner_id_asc_due_at_asc" },
    ])
  })
})
