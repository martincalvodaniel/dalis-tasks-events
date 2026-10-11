import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { executeRemoteRecurringPlanOperation } from "@/lib/db/remote-item-commands"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemotePlanOccurrenceOperation } from "@/lib/db/remote-plan-occurrence-commands"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { readRemoteRecurringOperationReceipt } from "@/lib/db/remote-recurring-operation-receipts"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { remotePlanOccurrenceChangeSchema } from "@/schemas/remote-plan-occurrence-result"
import type { PlanDraft } from "@/types/plan-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const date = "2026-10-11"
function operation(command: SyncCommand, baseRevision = 1): SyncOperation {
  return {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function draft(variant: PlanDraft["variant"], entryId: string): PlanDraft {
  return {
    kind: "plan",
    variant,
    title: "Recurring plan",
    description: "Series content",
    status: "not_started",
    checklist: [{ id: entryId, text: "Step", completed: false }],
    schedule: {
      mode: "all_day",
      startDate: date,
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: date,
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
}
async function seed(variant: PlanDraft["variant"] = "task") {
  const actor = randomUUID(),
    itemId = randomUUID(),
    entryId = randomUUID()
  const input = draft(variant, entryId)
  await executeRemoteRecurringPlanOperation(
    actor,
    operation({ type: "item.create", itemId, input }, 0)
  )
  const occurrenceId = `${itemId}:${date}`
  return { actor, itemId, entryId, input, occurrenceId }
}
async function counts(actor: string) {
  return {
    receipts: await (
      await getCollection(COLLECTION_NAMES.syncOperations)
    ).countDocuments({ actorUserId: actor }),
    changes: await (
      await getCollection(COLLECTION_NAMES.syncChanges)
    ).countDocuments({ recipientUserId: actor }),
    counter: await (
      await getCollection<{ _id: string; sequence: number }>(
        COLLECTION_NAMES.syncCounters
      )
    ).findOne({ _id: actor }),
  }
}
async function guard(actor: string, itemId: string) {
  return (
    await getCollection<{ _id: string; token: string }>(
      COLLECTION_NAMES.planSeriesGuards
    )
  ).findOne({
    _id: JSON.stringify([actor, itemId]),
  })
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Appearance executor database does not match its owned run")
  return database
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe.skipIf(!config)(
  "prepared atomic recurring appearance executor",
  () => {
    beforeAll(ownedDatabase, 30000)
    afterAll(closeDatabaseConnection)

    test("missing exceptions, invalid slots and parent tombstones preserve terminal evidence and old replay", async () => {
      const { actor, itemId, occurrenceId } = await seed()
      const command = {
        type: "plan.set-occurrence-status" as const,
        itemId,
        occurrenceId,
        expectedOccurrenceRevision: 0,
        status: "in_progress" as const,
      }
      const missing = operation({ ...command, expectedOccurrenceRevision: 2 })
      const unavailable = await executeRemotePlanOccurrenceOperation(
        actor,
        missing
      )
      expect(unavailable.outcome.status).toBe("unavailable")
      const invalid = operation({
        ...command,
        occurrenceId: `${randomUUID()}:${date}`,
      })
      expect(
        (await executeRemotePlanOccurrenceOperation(actor, invalid)).outcome
          .status
      ).toBe("invalid_command")
      const future = operation(command, 9)
      expect(
        await executeRemotePlanOccurrenceOperation(actor, future)
      ).toMatchObject({
        outcome: { status: "conflict", series: { revision: 1 }, current: null },
      })
      const applied = operation(command)
      const result = await executeRemotePlanOccurrenceOperation(actor, applied)
      expect(result.outcome.status).toBe("applied")
      // A prior absent-state outcome cannot be replaced by a newer materialization.
      expect(
        await executeRemotePlanOccurrenceOperation(actor, missing)
      ).toEqual(unavailable)
      await executeRemoteRecurringPlanOperation(
        actor,
        operation({ type: "item.delete", itemId })
      )
      const before = await guard(actor, itemId)
      expect(
        await executeRemotePlanOccurrenceOperation(actor, applied)
      ).toEqual(result)
      expect(await guard(actor, itemId)).toEqual(before)
      const later = await executeRemotePlanOccurrenceOperation(
        actor,
        operation({ ...command, expectedOccurrenceRevision: 1 }, 2)
      )
      expect(later).toMatchObject({ outcome: { status: "unavailable" } })
      expect(await counts(actor)).toMatchObject({
        receipts: 7,
        changes: 3,
        counter: { sequence: 3 },
      })
      expect(
        await (await RemotePlanOccurrenceRepository.open(actor)).read({
          seriesId: itemId,
          id: occurrenceId,
        })
      ).toMatchObject({ revision: 1, status: "in_progress" })
    }, 30000)

    test("all variants preserve parent revision, slot, content and independent progress with exact replay", async () => {
      for (const variant of ["task", "event", "appointment", "note"] as const) {
        const { actor, itemId, entryId, input, occurrenceId } =
          await seed(variant)
        const repo = await RemotePlanOccurrenceRepository.open(actor)
        const commands: SyncCommand[] = [
          {
            type: "plan.set-occurrence-status",
            itemId,
            occurrenceId,
            expectedOccurrenceRevision: 0,
            status: "completed",
          },
          {
            type: "plan.set-occurrence-checklist-entry",
            itemId,
            occurrenceId,
            expectedOccurrenceRevision: 1,
            entryId,
            completed: true,
          },
          {
            type: "plan.update-occurrence",
            itemId,
            occurrenceId,
            expectedOccurrenceRevision: 2,
            input: {
              title: "Independent appearance",
              description: "Moved content",
              schedule: {
                mode: "all_day",
                startDate: "2026-10-15",
                endDateExclusive: "2026-10-16",
              },
              checklist: [{ id: entryId, text: "Renamed step" }],
            },
          },
          {
            type: "plan.cancel-occurrence",
            itemId,
            occurrenceId,
            expectedOccurrenceRevision: 3,
          },
        ]
        for (const [index, command] of commands.entries()) {
          const op = operation(command)
          const result = await executeRemotePlanOccurrenceOperation(actor, op)
          expect(result).toMatchObject({
            kind: "plan-occurrence",
            userId: actor,
            outcome: {
              status: "applied",
              seriesRevision: 1,
              sequence: index + 2,
              occurrence: {
                id: occurrenceId,
                seriesId: itemId,
                slotKey: date,
                revision: index + 1,
              },
            },
          })
          const before = await guard(actor, itemId)
          expect(await executeRemotePlanOccurrenceOperation(actor, op)).toEqual(
            result
          )
          expect(await guard(actor, itemId)).toEqual(before)
          const receipt = await readRemoteRecurringOperationReceipt(
            actor,
            op.operationId
          )
          expect(receipt?.result).toEqual(result)
          const changes = await getCollection(COLLECTION_NAMES.syncChanges)
          const change = await changes.findOne({
            recipientUserId: actor,
            operationId: op.operationId,
          })
          if (!change)
            throw new Error("Committed appearance journal is missing")
          const { _id, ...value } = change
          expect(remotePlanOccurrenceChangeSchema.parse(value)).toMatchObject({
            sequence: index + 2,
            occurrence: { revision: index + 1 },
          })
          await expect(
            executeRemotePlanOccurrenceOperation(actor, {
              ...op,
              baseRevision: 9,
            })
          ).rejects.toBeInstanceOf(OperationIdentityReuseError)
          await expect(
            executeRemoteRecurringPlanOperation(actor, {
              ...op,
              command: { type: "item.update", itemId, input },
            })
          ).rejects.toBeInstanceOf(OperationIdentityReuseError)
        }
        expect(
          await repo.read({ seriesId: itemId, id: occurrenceId })
        ).toMatchObject({
          revision: 4,
          cancelled: true,
          status: "completed",
          content: { title: "Independent appearance" },
          schedule: { startDate: "2026-10-15" },
          checklist: [{ id: entryId, completed: true }],
        })
        expect(
          await (await RemoteItemRepository.open(actor)).read(itemId)
        ).toMatchObject({
          revision: 1,
          status: "not_started",
          checklist: [{ completed: false }],
          title: input.title,
        })
        expect(await counts(actor)).toMatchObject({
          receipts: 5,
          changes: 5,
          counter: { sequence: 5 },
        })
      }
    }, 30000)

    test("unsupported history has no receipt, foreign parents reveal nothing and CAS has one winner", async () => {
      const { actor, itemId, occurrenceId } = await seed()
      const historic = operation({
        type: "plan.set-occurrence-status",
        itemId,
        occurrenceId,
        status: "in_progress",
      })
      expect(
        await executeRemotePlanOccurrenceOperation(actor, historic)
      ).toMatchObject({ outcome: { status: "unsupported" } })
      expect(
        await readRemoteRecurringOperationReceipt(actor, historic.operationId)
      ).toBeNull()
      const foreign = randomUUID()
      const op = operation({
        ...historic.command,
        expectedOccurrenceRevision: 0,
      } as SyncCommand)
      expect(await executeRemotePlanOccurrenceOperation(foreign, op)).toEqual({
        kind: "plan-occurrence",
        userId: foreign,
        outcome: { operationId: op.operationId, status: "unavailable" },
      })
      expect(await guard(foreign, itemId)).toBeNull()
      expect(await counts(foreign)).toEqual({
        receipts: 1,
        changes: 0,
        counter: null,
      })
      const results = await Promise.all(
        ["in_progress", "completed"].map((status) =>
          executeRemotePlanOccurrenceOperation(
            actor,
            operation({
              type: "plan.set-occurrence-status",
              itemId,
              occurrenceId,
              status: status as "in_progress" | "completed",
              expectedOccurrenceRevision: 0,
            })
          )
        )
      )
      expect(results.map((r) => r.outcome.status).sort()).toEqual([
        "applied",
        "conflict",
      ])
      expect(
        results.find((r) => r.outcome.status === "conflict")
      ).toMatchObject({
        outcome: { series: { revision: 1 }, current: { revision: 1 } },
      })
      expect(await counts(actor)).toMatchObject({
        receipts: 3,
        changes: 2,
        counter: { sequence: 2 },
      })
    }, 30000)

    test("late journal failure rolls back appearance, guard and counter; retry can commit", async () => {
      const db = await ownedDatabase()
      const { actor, itemId, occurrenceId } = await seed()
      const before = await guard(actor, itemId)
      const repo = await RemotePlanOccurrenceRepository.open(actor)
      const op = operation({
        type: "plan.set-occurrence-status",
        itemId,
        occurrenceId,
        expectedOccurrenceRevision: 0,
        status: "completed",
      })
      await db.command({
        collMod: COLLECTION_NAMES.syncChanges,
        validator: { sequence: { $lt: 0 } },
        validationLevel: "strict",
        validationAction: "error",
      })
      try {
        await expect(
          executeRemotePlanOccurrenceOperation(actor, op)
        ).rejects.toThrow()
        expect(
          await repo.read({ seriesId: itemId, id: occurrenceId })
        ).toBeNull()
        expect(await guard(actor, itemId)).toEqual(before)
        expect(await counts(actor)).toMatchObject({
          receipts: 1,
          changes: 1,
          counter: { sequence: 1 },
        })
      } finally {
        await db.command({
          collMod: COLLECTION_NAMES.syncChanges,
          validator: {},
        })
      }
      const result = await executeRemotePlanOccurrenceOperation(actor, op)
      expect(result).toMatchObject({
        outcome: { status: "applied", sequence: 2 },
      })
      expect(await executeRemotePlanOccurrenceOperation(actor, op)).toEqual(
        result
      )
    }, 30000)

    test("a parent edit or deletion after the appearance snapshot forces full authorization reread", async () => {
      for (const deletion of [false, true]) {
        const { actor, itemId, occurrenceId, input } = await seed()
        const paused = deferred(),
          resume = deferred()
        const read = RemoteItemRepository.prototype.read
        let first = true,
          reads = 0
        RemoteItemRepository.prototype.read = async function (id) {
          const item = await read.call(this, id)
          if (item?.id === itemId && item.ownerId === actor) {
            reads++
            if (first) {
              first = false
              paused.resolve()
              await resume.promise
            }
          }
          return item
        }
        let running:
          | ReturnType<typeof executeRemotePlanOccurrenceOperation>
          | undefined
        try {
          running = executeRemotePlanOccurrenceOperation(
            actor,
            operation({
              type: "plan.set-occurrence-status",
              itemId,
              occurrenceId,
              expectedOccurrenceRevision: 0,
              status: "completed",
            })
          )
          await paused.promise
          const changed = await executeRemoteRecurringPlanOperation(
            actor,
            operation(
              deletion
                ? { type: "item.delete", itemId }
                : {
                    type: "item.update",
                    itemId,
                    input: { ...input, title: "Concurrent change" },
                  }
            )
          )
          expect(changed.status).toBe("applied")
          const guarded = await guard(actor, itemId)
          resume.resolve()
          expect(await running).toMatchObject({
            outcome: { status: deletion ? "unavailable" : "conflict" },
          })
          expect(reads).toBeGreaterThanOrEqual(3)
          expect(await guard(actor, itemId)).toEqual(guarded)
          expect(
            await (await RemotePlanOccurrenceRepository.open(actor)).read({
              seriesId: itemId,
              id: occurrenceId,
            })
          ).toBeNull()
          expect(await counts(actor)).toMatchObject({
            receipts: 3,
            changes: 2,
            counter: { sequence: 2 },
          })
        } finally {
          resume.resolve()
          await running?.catch(() => undefined)
          RemoteItemRepository.prototype.read = read
        }
      }
    }, 30000)
  }
)
