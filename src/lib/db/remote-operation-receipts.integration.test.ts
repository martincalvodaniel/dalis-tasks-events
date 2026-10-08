import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import {
  readRemoteOperationReceipt,
  readRemoteOperationReplay,
} from "@/lib/db/remote-operation-receipts"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"

const config = getSyncDatabaseTestConfig()
const actorPrefix = `receipt-reader-${config?.runId}-`
const timestamp = "2026-10-08T00:00:00.000Z"
function personal(actorUserId: string, operationId = crypto.randomUUID()) {
  return {
    version: 2 as const,
    actorUserId,
    operationId,
    fingerprint: "a".repeat(64),
    createdAt: timestamp,
    result: {
      kind: "preference" as const,
      outcome: {
        operationId,
        status: "conflict" as const,
        current: {
          store: "itemViews" as const,
          record: {
            userId: actorUserId,
            itemId: crypto.randomUUID(),
            primaryTagId: null,
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          },
        },
      },
    },
  }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Receipt reader database does not match its owned run")
  return database
}

describe.skipIf(!config)("owned remote receipt reader", () => {
  beforeAll(ownedDatabase, 30000)
  afterAll(async () => {
    try {
      await ownedDatabase()
      await (
        await getCollection<{ _id: string; [key: string]: unknown }>(
          COLLECTION_NAMES.syncOperations
        )
      ).deleteMany({
        actorUserId: { $regex: `^${actorPrefix}` },
      })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("reads both histories with actor-scoped identity and independent results", async () => {
    const actor = `${actorPrefix}first`
    const otherActor = `${actorPrefix}second`
    const next = personal(actor)
    const other = personal(otherActor, next.operationId)
    const old = {
      actorUserId: actor,
      operationId: crypto.randomUUID(),
      fingerprint: "b".repeat(64),
      createdAt: timestamp,
      result: { operationId: "", status: "unsupported" as const },
    }
    old.result.operationId = old.operationId
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    await receipts.insertMany(
      [next, other, old].map((record) => ({
        ...record,
        _id: crypto.randomUUID(),
      }))
    )
    expect(await readRemoteOperationReceipt(actor, next.operationId)).toEqual(
      next
    )
    expect(
      await readRemoteOperationReceipt(otherActor, next.operationId)
    ).toEqual(other)
    expect(await readRemoteOperationReceipt(actor, old.operationId)).toEqual({
      ...old,
      version: 2 as const,
      result: { kind: "item", outcome: old.result },
    })
    expect(
      await readRemoteOperationReceipt(otherActor, old.operationId)
    ).toBeNull()
    const decoded = await readRemoteOperationReceipt(actor, next.operationId)
    if (!decoded) throw new Error("Expected owned receipt")
    decoded.fingerprint = "c".repeat(64)
    expect(
      (await readRemoteOperationReceipt(actor, next.operationId))?.fingerprint
    ).toBe(next.fingerprint)
    await expect(
      readRemoteOperationReceipt("", next.operationId)
    ).rejects.toThrow()
    await expect(readRemoteOperationReceipt(actor, "invalid")).rejects.toThrow()
  }, 30000)

  test("rejects corrupted stored outcome and future records without altering history", async () => {
    const next = personal(`${actorPrefix}corrupt`)
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    const document = { ...next, _id: crypto.randomUUID() }
    await receipts.insertOne(document)
    for (const corruption of [
      { "result.outcome.operationId": crypto.randomUUID() },
      { "result.outcome.current.record.userId": "foreign-actor" },
      { version: 3 },
      { unexpected: true },
    ]) {
      await receipts.updateOne({ _id: document._id }, { $set: corruption })
      try {
        await expect(
          readRemoteOperationReceipt(next.actorUserId, next.operationId)
        ).rejects.toThrow()
      } finally {
        const { _id, ...value } = document
        await receipts.replaceOne({ _id }, value)
      }
    }
    expect(
      await readRemoteOperationReceipt(next.actorUserId, next.operationId)
    ).toEqual(next)
  }, 30000)

  test("uses the supplied snapshot session and leaves no receipt after fixture rollback", async () => {
    const database = await ownedDatabase()
    const next = personal(`${actorPrefix}session`)
    const operation = {
      protocolVersion: 1,
      operationId: next.operationId,
      baseRevision: 1,
      command: { type: "tag.delete", tagId: crypto.randomUUID() },
    }
    next.fingerprint = syncOperationFingerprint(operation)
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    await expect(
      database.client.withSession((session) =>
        session.withTransaction(async () => {
          await receipts.insertOne(
            { ...next, _id: crypto.randomUUID() },
            { session }
          )
          expect(
            await readRemoteOperationReceipt(
              next.actorUserId,
              next.operationId,
              session
            )
          ).toEqual(next)
          expect(
            await readRemoteOperationReceipt(next.actorUserId, next.operationId)
          ).toBeNull()
          expect(
            await readRemoteOperationReplay(
              next.actorUserId,
              operation,
              session
            )
          ).toEqual(next.result)
          expect(
            await readRemoteOperationReplay(next.actorUserId, operation)
          ).toBeNull()
          throw new Error("Intentional receipt fixture rollback")
        })
      )
    ).rejects.toThrow("Intentional receipt fixture rollback")
    expect(
      await readRemoteOperationReceipt(next.actorUserId, next.operationId)
    ).toBeNull()
  }, 30000)

  test("replays exact intentions across both histories and rejects UUID payload reuse", async () => {
    const actor = `${actorPrefix}replay`
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    for (const legacy of [false, true]) {
      const operation = {
        protocolVersion: 1,
        operationId: crypto.randomUUID(),
        baseRevision: 1,
        command: { type: "tag.delete", tagId: crypto.randomUUID() },
      }
      const next = personal(actor, operation.operationId)
      next.fingerprint = syncOperationFingerprint(operation)
      const oldResult = {
        operationId: operation.operationId,
        status: "unsupported" as const,
      }
      const stored = legacy
        ? {
            actorUserId: actor,
            operationId: operation.operationId,
            fingerprint: next.fingerprint,
            createdAt: timestamp,
            result: oldResult,
          }
        : next
      const document = { ...stored, _id: crypto.randomUUID() }
      await receipts.insertOne(document)
      const expected = legacy
        ? { kind: "item" as const, outcome: oldResult }
        : next.result
      expect(await readRemoteOperationReplay(actor, operation)).toEqual(
        expected
      )
      expect(
        await readRemoteOperationReplay(actor, {
          command: { tagId: operation.command.tagId, type: "tag.delete" },
          baseRevision: 1,
          operationId: operation.operationId,
          protocolVersion: 1,
        })
      ).toEqual(expected)
      for (const changed of [
        { ...operation, baseRevision: 2 },
        {
          ...operation,
          command: { ...operation.command, tagId: crypto.randomUUID() },
        },
        {
          ...operation,
          command: { type: "item.delete", itemId: crypto.randomUUID() },
        },
      ])
        await expect(
          readRemoteOperationReplay(actor, changed)
        ).rejects.toBeInstanceOf(OperationIdentityReuseError)
      expect(
        await readRemoteOperationReplay(`${actorPrefix}absent`, operation)
      ).toBeNull()
      await expect(
        readRemoteOperationReplay(actor, { ...operation, unexpected: true })
      ).rejects.toThrow()
      expect(await receipts.findOne({ _id: document._id })).toEqual(document)
    }
  }, 30000)
})
