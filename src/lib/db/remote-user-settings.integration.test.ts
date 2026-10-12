import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import {
  readRemoteRecurringChangesV2,
  readRemoteSettingsChangesV2,
} from "@/lib/db/remote-changes-v2"
import { executeRemoteSettingsOperation } from "@/lib/db/remote-recurring-operation-commands"
import { readRemoteRecurringOperationReceipt } from "@/lib/db/remote-recurring-operation-receipts"
import { RemoteUserSettingsRepository } from "@/lib/db/remote-user-settings"
import {
  executeRemoteUserSettingsOperation,
  stageRemoteUserSettingsOperation,
} from "@/lib/db/remote-user-settings-commands"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import type { UserSettings } from "@/types/preferences"
import type { SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const owners = new Set<string>()
const timestamp = "2026-10-12T08:00:00.000Z"
function owner(label: string) {
  const actor = `settings-${config?.runId}-${label}`
  owners.add(actor)
  return actor
}
function operation(
  timeZone = "Europe/Madrid",
  baseRevision = 0
): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command: {
      type: "settings.update",
      input: { timeZone, weekStartsOn: 1, locale: "es-ES" },
    },
  }
}
function record(userId: string): UserSettings {
  return {
    userId,
    timeZone: "Europe/Madrid",
    weekStartsOn: 1,
    locale: "es-ES",
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}
async function ownedDatabase() {
  if (!config) throw new Error("Owned settings test descriptor is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Settings test database does not match its run")
  return database
}
async function history(actor: string) {
  return {
    receipts: await (
      await getCollection(COLLECTION_NAMES.syncOperations)
    ).countDocuments({ actorUserId: actor }),
    changes: await (
      await getCollection(COLLECTION_NAMES.syncChanges)
    ).countDocuments({ recipientUserId: actor }),
    counter:
      (
        await (
          await getCollection<{ _id: string; sequence: number }>(
            COLLECTION_NAMES.syncCounters
          )
        ).findOne({ _id: actor })
      )?.sequence ?? 0,
  }
}

describe.skipIf(!config)("owned atomic personal settings", () => {
  beforeAll(async () => {
    const database = await ownedDatabase()
    await ensureIndexes(
      database,
      INDEX_SPECS.filter(
        (spec) => spec.collection === COLLECTION_NAMES.userSettings
      )
    )
  })
  afterAll(async () => {
    try {
      if (config) {
        const own = [...owners]
        await (
          await getCollection<UserSettings & { _id: string }>(
            COLLECTION_NAMES.userSettings
          )
        ).deleteMany({
          userId: { $in: own },
        })
        await (await getCollection(COLLECTION_NAMES.syncOperations)).deleteMany(
          { actorUserId: { $in: own } }
        )
        await (await getCollection(COLLECTION_NAMES.syncChanges)).deleteMany({
          recipientUserId: { $in: own },
        })
        await (
          await getCollection<{ _id: string }>(COLLECTION_NAMES.syncCounters)
        ).deleteMany({
          _id: { $in: own },
        })
      }
    } finally {
      await closeDatabaseConnection()
    }
  })
  test("repository enforces one canonical record, actor ownership and exact CAS", async () => {
    const actor = owner("repository"),
      other = owner("peer")
    const repository = await RemoteUserSettingsRepository.open(actor)
    expect(await repository.read()).toBeNull()
    expect(await repository.insert(record(actor))).toBe(true)
    expect(await repository.insert(record(actor))).toBe(false)
    expect(
      await (await RemoteUserSettingsRepository.open(other)).read()
    ).toBeNull()
    await expect(repository.insert(record(other))).rejects.toThrow()
    await expect(
      repository.replace(1, { ...record(actor), revision: 3 })
    ).rejects.toThrow()
    await expect(
      repository.replace(1, { ...record(other), revision: 2 })
    ).rejects.toThrow()
    const next = {
      ...record(actor),
      revision: 2,
      timeZone: "Pacific/Kiritimati",
    }
    expect(await repository.replace(1, next)).toBe(true)
    expect(await repository.replace(1, next)).toBe(false)
    expect(await repository.read()).toEqual(next)
    const collection = await getCollection<UserSettings & { _id: string }>(
      COLLECTION_NAMES.userSettings
    )
    await expect(
      collection.insertOne({
        ...record(actor),
        _id: "alternate-owned-identity",
      })
    ).rejects.toMatchObject({ code: 11000 })
    expect(await collection.countDocuments({ userId: actor })).toBe(1)
  })
  test("a lost response replays one durable receipt, then older replay cannot replace later settings", async () => {
    const actor = owner("replay"),
      initial = operation()
    const first = await executeRemoteUserSettingsOperation(actor, initial)
    expect(first.kind).toBe("preference")
    expect(first.outcome.status).toBe("applied")
    expect(await executeRemoteUserSettingsOperation(actor, initial)).toEqual(
      first
    )
    expect(await history(actor)).toEqual({
      receipts: 1,
      changes: 1,
      counter: 1,
    })
    const repository = await RemoteUserSettingsRepository.open(actor)
    const created = await repository.read()
    const updated = await executeRemoteUserSettingsOperation(
      actor,
      operation("America/Los_Angeles", 1)
    )
    expect(updated.outcome.status).toBe("applied")
    expect(await executeRemoteUserSettingsOperation(actor, initial)).toEqual(
      first
    )
    const current = await repository.read()
    expect(current?.revision).toBe(2)
    expect(current?.timeZone).toBe("America/Los_Angeles")
    expect(current?.createdAt).toBe(created?.createdAt)
    expect(await history(actor)).toEqual({
      receipts: 2,
      changes: 2,
      counter: 2,
    })
    await expect(
      executeRemoteUserSettingsOperation(actor, {
        ...initial,
        command: {
          type: "settings.update",
          input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
        },
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await history(actor)).toEqual({
      receipts: 2,
      changes: 2,
      counter: 2,
    })
    expect(
      (await readRemoteRecurringOperationReceipt(actor, initial.operationId))
        ?.result
    ).toEqual(first)
    const other = owner("same-uuid-peer")
    expect(
      (await executeRemoteUserSettingsOperation(other, initial)).outcome.status
    ).toBe("applied")
    expect(await history(other)).toEqual({
      receipts: 1,
      changes: 1,
      counter: 1,
    })
    expect(await repository.read()).toEqual(current)
  })
  test("distinct concurrent creations commit one projection and preserve the losing conflict", async () => {
    const actor = owner("race"),
      left = operation("UTC"),
      right = operation("Europe/Madrid")
    const results = await Promise.all([
      executeRemoteUserSettingsOperation(actor, left),
      executeRemoteUserSettingsOperation(actor, right),
    ])
    expect(results.map((result) => result.outcome.status).sort()).toEqual([
      "applied",
      "conflict",
    ])
    expect(await history(actor)).toEqual({
      receipts: 2,
      changes: 1,
      counter: 1,
    })
    const saved = await (await RemoteUserSettingsRepository.open(actor)).read()
    if (!saved) throw new Error("Committed settings are missing")
    expect(saved.revision).toBe(1)
    const conflict = results.find(
      (result) =>
        result.kind === "preference" && result.outcome.status === "conflict"
    )
    if (
      conflict?.kind !== "preference" ||
      conflict.outcome.status !== "conflict"
    )
      throw new Error("Settings conflict is missing")
    expect(conflict.outcome.current).toEqual({
      store: "settings",
      record: saved,
    })
    expect(await executeRemoteUserSettingsOperation(actor, left)).toEqual(
      results[0]
    )
    expect(await executeRemoteUserSettingsOperation(actor, right)).toEqual(
      results[1]
    )
    expect(await history(actor)).toEqual({
      receipts: 2,
      changes: 1,
      counter: 1,
    })
  }, 30000)
  test("a late transaction failure rolls back settings, receipt, counter and journal together", async () => {
    const actor = owner("rollback"),
      request = operation()
    const database = await ownedDatabase()
    await expect(
      database.client.withSession((session) =>
        session.withTransaction(async () => {
          const staged = await stageRemoteUserSettingsOperation(
            actor,
            request,
            timestamp,
            session
          )
          expect(staged.outcome.status).toBe("applied")
          throw new Error("Injected owned settings rollback")
        })
      )
    ).rejects.toThrow("Injected owned settings rollback")
    expect(
      await (await RemoteUserSettingsRepository.open(actor)).read()
    ).toBeNull()
    expect(await history(actor)).toEqual({
      receipts: 0,
      changes: 0,
      counter: 0,
    })
    expect(
      (await executeRemoteUserSettingsOperation(actor, request)).outcome.status
    ).toBe("applied")
    expect(await history(actor)).toEqual({
      receipts: 1,
      changes: 1,
      counter: 1,
    })
    await database.client.withSession(async (session) => {
      await expect(
        stageRemoteUserSettingsOperation(
          actor,
          operation("UTC", 1),
          timestamp,
          session
        )
      ).rejects.toThrow("active transaction")
    })
    expect(await history(actor)).toEqual({
      receipts: 1,
      changes: 1,
      counter: 1,
    })
  })
  test("stale, absent and tombstoned state never produces a replacement or new journal entry", async () => {
    const actor = owner("tombstone"),
      collection = await getCollection<UserSettings & { _id: string }>(
        COLLECTION_NAMES.userSettings
      )
    await executeRemoteUserSettingsOperation(actor, operation())
    expect(
      (await executeRemoteUserSettingsOperation(actor, operation("UTC", 0)))
        .outcome.status
    ).toBe("conflict")
    await collection.updateOne(
      { userId: actor },
      { $set: { deletedAt: timestamp } }
    )
    const deleted = await (
      await RemoteUserSettingsRepository.open(actor)
    ).read()
    const result = await executeRemoteUserSettingsOperation(
      actor,
      operation("UTC", 1)
    )
    expect(result.outcome.status).toBe("conflict")
    expect(
      await (await RemoteUserSettingsRepository.open(actor)).read()
    ).toEqual(deleted)
    expect(await history(actor)).toEqual({
      receipts: 3,
      changes: 1,
      counter: 1,
    })
    expect(
      await (await RemoteUserSettingsRepository.open(actor)).replace(1, {
        ...record(actor),
        revision: 2,
      })
    ).toBe(false)
    const absent = owner("absent")
    expect(
      (await executeRemoteUserSettingsOperation(absent, operation("UTC", 7)))
        .outcome.status
    ).toBe("unavailable")
    expect(await history(absent)).toEqual({
      receipts: 1,
      changes: 0,
      counter: 0,
    })
  })
  test("corrupt identity and invalid inputs stop before committing or repairing records", async () => {
    const actor = owner("corrupt"),
      collection = await getCollection<UserSettings & { _id: string }>(
        COLLECTION_NAMES.userSettings
      )
    await collection.insertOne({
      ...record(actor),
      _id: "owned-corrupt-identity",
    })
    await expect(
      (await RemoteUserSettingsRepository.open(actor)).read()
    ).rejects.toThrow("identity")
    await expect(
      executeRemoteUserSettingsOperation(actor, operation("UTC", 1))
    ).rejects.toThrow("identity")
    expect(await history(actor)).toEqual({
      receipts: 0,
      changes: 0,
      counter: 0,
    })
    expect(await collection.countDocuments({ userId: actor })).toBe(1)
    const valid = owner("invalid-request")
    const request = operation()
    await expect(
      executeRemoteUserSettingsOperation(valid, {
        ...request,
        command: {
          ...request.command,
          input: { timeZone: "Invalid/Zone", weekStartsOn: 1, locale: "es-ES" },
        },
      })
    ).rejects.toThrow()
    expect(await history(valid)).toEqual({
      receipts: 0,
      changes: 0,
      counter: 0,
    })
  })
  test("private settings reader paginates exact history, replay and account isolation", async () => {
    const actor = owner("reader"),
      other = owner("reader-other"),
      first = operation()
    await executeRemoteUserSettingsOperation(actor, first)
    await executeRemoteUserSettingsOperation(actor, operation("Asia/Tokyo", 1))
    const query = { after: 0, through: null, limit: 1 }
    const page = await readRemoteSettingsChangesV2(actor, query)
    expect(page.changes).toHaveLength(1)
    expect(page.through).toBe(2)
    expect(page.nextAfter).toBe(1)
    expect(page.hasMore).toBe(true)
    expect(page.changes[0].operationId).toBe(first.operationId)
    expect(
      page.changes[0].kind === "preference" &&
        page.changes[0].effects.effects[0].record.revision
    ).toBe(1)
    await executeRemoteUserSettingsOperation(actor, first)
    expect(await readRemoteSettingsChangesV2(actor, query)).toEqual(page)
    const next = await readRemoteSettingsChangesV2(actor, {
      after: 1,
      through: 2,
      limit: 1,
    })
    expect(next.nextAfter).toBe(2)
    expect(next.hasMore).toBe(false)
    expect(
      next.changes[0].kind === "preference" &&
        next.changes[0].effects.effects[0].record.revision
    ).toBe(2)
    expect(
      (
        await readRemoteSettingsChangesV2(other, {
          after: 0,
          through: null,
          limit: 100,
        })
      ).changes
    ).toEqual([])
    await expect(readRemoteRecurringChangesV2(actor, query)).rejects.toThrow(
      "not supported"
    )
    expect(await history(actor)).toEqual({
      receipts: 2,
      changes: 2,
      counter: 2,
    })
  })
  test("private reader preserves tombstoned history but rejects unavailable or foreign ownership", async () => {
    const actor = owner("reader-ownership"),
      other = owner("reader-foreign")
    await executeRemoteUserSettingsOperation(actor, operation())
    const collection = await getCollection<UserSettings & { _id: string }>(
      COLLECTION_NAMES.userSettings
    )
    const own = await collection.findOne({ userId: actor })
    if (!own) throw new Error("Owned reader record is missing")
    await collection.updateOne(
      { _id: own._id },
      { $set: { deletedAt: timestamp, updatedAt: timestamp, revision: 2 } }
    )
    const query = { after: 0, through: null, limit: 100 }
    expect(
      (await readRemoteSettingsChangesV2(actor, query)).changes
    ).toHaveLength(1)
    await collection.updateOne({ _id: own._id }, { $set: { userId: other } })
    await expect(readRemoteSettingsChangesV2(actor, query)).rejects.toThrow(
      "unavailable"
    )
    await collection.deleteOne({ _id: own._id })
    await expect(readRemoteSettingsChangesV2(actor, query)).rejects.toThrow(
      "unavailable"
    )
    expect(await history(actor)).toEqual({
      receipts: 1,
      changes: 1,
      counter: 1,
    })
  })
  test("private reader rejects current revision below history and corrupt canonical identity", async () => {
    const actor = owner("reader-evidence")
    await executeRemoteUserSettingsOperation(actor, operation())
    await executeRemoteUserSettingsOperation(actor, operation("UTC", 1))
    const collection = await getCollection<UserSettings & { _id: string }>(
      COLLECTION_NAMES.userSettings
    )
    const own = await collection.findOne({ userId: actor })
    if (!own) throw new Error("Owned reader evidence is missing")
    const query = { after: 0, through: null, limit: 100 }
    await collection.updateOne({ _id: own._id }, { $set: { revision: 1 } })
    await expect(readRemoteSettingsChangesV2(actor, query)).rejects.toThrow(
      "exceeds"
    )
    await collection.deleteOne({ _id: own._id })
    await collection.insertOne({ ...own, _id: `owned-corrupt-${actor}` })
    await expect(readRemoteSettingsChangesV2(actor, query)).rejects.toThrow(
      "identity"
    )
    expect(await history(actor)).toEqual({
      receipts: 2,
      changes: 2,
      counter: 2,
    })
  })
  test("future dispatcher selects settings executor and preserves exact replay without duplicate history", async () => {
    const actor = owner("dispatcher"),
      submitted = operation(),
      before = structuredClone(submitted)
    const result = await executeRemoteSettingsOperation(actor, submitted)
    expect(result.kind === "preference" && result.outcome.status).toBe(
      "applied"
    )
    expect(await executeRemoteSettingsOperation(actor, submitted)).toEqual(
      result
    )
    expect(submitted).toEqual(before)
    expect(await history(actor)).toEqual({
      receipts: 1,
      changes: 1,
      counter: 1,
    })
    await expect(
      executeRemoteSettingsOperation(actor, {
        ...submitted,
        command: {
          type: "settings.update",
          input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
        },
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
  })
})
