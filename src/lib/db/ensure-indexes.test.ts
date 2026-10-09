import "server-only"

import { describe, expect, test } from "bun:test"
import { getAuthTables } from "better-auth/db"
import { AUTH_MODEL_NAMES } from "@/lib/db/auth-models"
import { COLLECTION_NAMES } from "@/lib/db/collections"
import type { IndexSpec } from "./ensure-indexes"
import {
  automaticIndexSpecs,
  ensureIndexes,
  INDEX_SPECS,
  type IndexDatabase,
  validateIndexSpecs,
} from "./ensure-indexes"

describe("MongoDB index specifications", () => {
  test("keeps the current bootstrap automatic selection unchanged", async () => {
    const calls: string[] = []
    const database: IndexDatabase = {
      collection: (collection) => ({
        createIndex: async (_keys, options) => {
          calls.push(`${collection}.${options?.name}`)
          return options?.name ?? ""
        },
      }),
    }
    expect(
      automaticIndexSpecs().some(
        (spec) => spec.collection === COLLECTION_NAMES.tags
      )
    ).toBe(false)
    await ensureIndexes(database)
    expect(calls).toEqual([
      "sync_operations.sync_operations_actor_operation_uidx",
      "sync_changes.sync_changes_recipient_sequence_uidx",
      "items.items_owner_id_idx",
      "users.users_email_uidx",
      "sessions.sessions_token_uidx",
      "sessions.sessions_userId_idx",
      "accounts.accounts_userId_idx",
      "accounts.accounts_providerId_accountId_uidx",
      "verifications.verifications_identifier_idx",
    ])
  })

  test("stages actor-scoped category identity and active name uniqueness", () => {
    expect(
      INDEX_SPECS.filter((spec) => spec.collection === COLLECTION_NAMES.tags)
    ).toEqual([
      {
        collection: COLLECTION_NAMES.tags,
        keys: { userId: 1, id: 1 },
        options: { name: "tags_user_id_uidx", unique: true },
        provisioning: "explicit",
      },
      {
        collection: COLLECTION_NAMES.tags,
        keys: { userId: 1, normalizedName: 1 },
        options: {
          name: "tags_user_active_name_uidx",
          unique: true,
          partialFilterExpression: { deletedAt: null },
        },
        provisioning: "explicit",
      },
    ])
  })

  test("stages private item view identity without activating its collection", () => {
    expect(
      INDEX_SPECS.filter(
        (spec) => spec.collection === COLLECTION_NAMES.itemViews
      )
    ).toEqual([
      {
        collection: COLLECTION_NAMES.itemViews,
        keys: { userId: 1, itemId: 1 },
        options: { name: "item_views_user_item_uidx", unique: true },
        provisioning: "explicit",
      },
    ])
    expect(
      automaticIndexSpecs().some(
        (spec) => spec.collection === COLLECTION_NAMES.itemViews
      )
    ).toBe(false)
  })

  test("stages one private placement index for canonical identity and complete actor catalog", () => {
    expect(
      INDEX_SPECS.filter(
        (spec) => spec.collection === COLLECTION_NAMES.taskPlacements
      )
    ).toEqual([
      {
        collection: COLLECTION_NAMES.taskPlacements,
        keys: { userId: 1, scope: 1, date: 1, occurrenceId: 1 },
        options: {
          name: "task_placements_user_scope_date_occurrence_uidx",
          unique: true,
        },
        provisioning: "explicit",
      },
    ])
    expect(
      automaticIndexSpecs().some(
        (spec) => spec.collection === COLLECTION_NAMES.taskPlacements
      )
    ).toBe(false)
  })

  test("omits staged indexes automatically but provisions an explicit selection", async () => {
    const calls: Array<{
      collection: string
      keys: unknown
      options: unknown
    }> = []
    const database: IndexDatabase = {
      collection: (collection) => ({
        createIndex: async (keys, options) => {
          calls.push({ collection, keys, options })
          return options?.name ?? ""
        },
      }),
    }
    const automatic: IndexSpec = {
      collection: "fixture_active",
      keys: { actor: 1 },
      options: { name: "actor_idx" },
    }
    const staged: IndexSpec = {
      collection: "fixture_staged",
      keys: { actor: 1, identity: 1 },
      options: { name: "actor_identity_uidx", unique: true },
      provisioning: "explicit",
    }
    const catalog = [automatic, staged]
    const before = structuredClone(catalog)
    const selection = automaticIndexSpecs(catalog)
    expect(selection).toEqual([automatic])
    await ensureIndexes(database, selection)
    expect(calls).toEqual([
      {
        collection: automatic.collection,
        keys: automatic.keys,
        options: automatic.options,
      },
    ])
    await ensureIndexes(database, [staged])
    expect(calls[1]).toEqual({
      collection: staged.collection,
      keys: staged.keys,
      options: staged.options,
    })
    expect(catalog).toEqual(before)
  })

  test("validates staged entries before filtering and writes nothing for an invalid list", async () => {
    let writes = 0
    const database: IndexDatabase = {
      collection: () => ({
        createIndex: async () => {
          writes += 1
          return "unexpected"
        },
      }),
    }
    const automatic: IndexSpec = {
      collection: "fixture",
      keys: { actor: 1 },
      options: { name: "same_name" },
    }
    const staged: IndexSpec = {
      ...automatic,
      keys: { identity: 1 },
      provisioning: "explicit",
    }
    expect(() => automaticIndexSpecs([automatic, staged])).toThrow(
      "Duplicate MongoDB index name"
    )
    await expect(ensureIndexes(database, [automatic, staged])).rejects.toThrow(
      "Duplicate MongoDB index name"
    )
    expect(() => automaticIndexSpecs([{ ...staged, collection: "" }])).toThrow()
    expect(() =>
      automaticIndexSpecs([
        {
          ...staged,
          provisioning: "unsupported" as IndexSpec["provisioning"],
        },
      ])
    ).toThrow("Invalid MongoDB index provisioning policy")
    expect(writes).toBe(0)
  })

  test("supports bounded owner item pagination without changing global identity uniqueness", () => {
    expect(INDEX_SPECS).toContainEqual({
      collection: COLLECTION_NAMES.items,
      keys: { ownerId: 1, _id: 1 },
      options: { name: "items_owner_id_idx" },
    })
    expect(
      INDEX_SPECS.filter(
        (spec) =>
          spec.collection === COLLECTION_NAMES.items && spec.options.unique
      )
    ).toHaveLength(0)
  })
  test("registers durable receipt and journal uniqueness without TTL or a redundant counter index", () => {
    expect(INDEX_SPECS).toContainEqual({
      collection: COLLECTION_NAMES.syncOperations,
      keys: { actorUserId: 1, operationId: 1 },
      options: { name: "sync_operations_actor_operation_uidx", unique: true },
    })
    expect(INDEX_SPECS).toContainEqual({
      collection: COLLECTION_NAMES.syncChanges,
      keys: { recipientUserId: 1, sequence: 1 },
      options: { name: "sync_changes_recipient_sequence_uidx", unique: true },
    })
    expect(
      INDEX_SPECS.some(
        (spec) => spec.collection === COLLECTION_NAMES.syncCounters
      )
    ).toBe(false)
    expect(
      INDEX_SPECS.some((spec) => spec.options.expireAfterSeconds !== undefined)
    ).toBe(false)
  })
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
