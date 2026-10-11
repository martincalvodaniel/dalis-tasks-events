import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import {
  readRemotePlanChangesV2,
  readRemoteRecurringChangesV2,
} from "@/lib/db/remote-changes-v2"
import { executeRemoteRecurringPlanOperation } from "@/lib/db/remote-item-commands"
import { executeRemotePlanOccurrenceOperation } from "@/lib/db/remote-plan-occurrence-commands"
import { executeRemoteTagOperation } from "@/lib/db/remote-tag-commands"
import type { PlanDraft } from "@/types/plan-item"
import type { SyncCommand } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
function operation(command: SyncCommand, baseRevision = 0) {
  return {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const db = await getDatabase()
  if (db.databaseName !== config.mongodbDatabase)
    throw new Error("Recurring reader database does not match its owned run")
  return db
}
async function seed() {
  const actor = randomUUID(),
    itemId = randomUUID()
  const input: PlanDraft = {
    kind: "plan",
    variant: "note",
    title: "Recurring notes",
    description: "",
    status: "not_started",
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
  await executeRemoteRecurringPlanOperation(
    actor,
    operation({ type: "item.create", itemId, input })
  )
  await executeRemoteTagOperation(
    actor,
    operation({
      type: "tag.save",
      tagId: randomUUID(),
      input: { name: "Recurring", color: "#123456", position: 1024 },
    })
  )
  const occurrenceId = `${itemId}:2026-10-11`
  await executeRemotePlanOccurrenceOperation(
    actor,
    operation(
      {
        type: "plan.set-occurrence-status",
        itemId,
        occurrenceId,
        status: "completed",
        expectedOccurrenceRevision: 0,
      },
      1
    )
  )
  return { actor, itemId, occurrenceId, input }
}
const query = { after: 0, through: null, limit: 100 }

describe.skipIf(!config)(
  "prepared authorized recurring change download",
  () => {
    beforeAll(ownedDatabase, 30000)
    afterAll(closeDatabaseConnection)

    test("mixed bootstrap freezes its checkpoint and retains old appearance history after parent edits and deletion", async () => {
      const { actor, itemId, occurrenceId, input } = await seed()
      const first = await readRemoteRecurringChangesV2(actor, {
        ...query,
        limit: 2,
      })
      expect(first).toMatchObject({
        version: 2,
        nextAfter: 2,
        through: 3,
        hasMore: true,
      })
      expect(first.changes.map((c) => c.kind)).toEqual(["item", "preference"])
      await executeRemoteRecurringPlanOperation(
        actor,
        operation(
          {
            type: "item.update",
            itemId,
            input: { ...input, recurrence: null },
          },
          1
        )
      )
      const tail = await readRemoteRecurringChangesV2(actor, {
        ...query,
        after: 2,
        through: 3,
      })
      expect(tail).toMatchObject({
        nextAfter: 3,
        through: 3,
        hasMore: false,
        changes: [
          {
            kind: "plan-occurrence",
            occurrence: { id: occurrenceId, revision: 1 },
          },
        ],
      })
      await executeRemoteRecurringPlanOperation(
        actor,
        operation({ type: "item.delete", itemId }, 2)
      )
      const all = await readRemoteRecurringChangesV2(actor, query)
      expect(all.changes.map((c) => c.sequence)).toEqual([1, 2, 3, 4, 5])
      expect(all.changes[2]).toEqual(tail.changes[0])
      expect(await readRemoteRecurringChangesV2(randomUUID(), query)).toEqual({
        version: 2,
        changes: [],
        nextAfter: 0,
        through: 0,
        hasMore: false,
      })
      await expect(readRemotePlanChangesV2(actor, query)).rejects.toThrow()
      await expect(
        readRemoteRecurringChangesV2(actor, { ...query, through: 6 })
      ).rejects.toBeInstanceOf(RemoteCursorAheadError)
    }, 30000)

    test("cancelled appearance tombstones remain downloadable; missing or corrupt current authorization rejects the entire page", async () => {
      const { actor, itemId, occurrenceId } = await seed()
      await executeRemotePlanOccurrenceOperation(
        actor,
        operation(
          {
            type: "plan.cancel-occurrence",
            itemId,
            occurrenceId,
            expectedOccurrenceRevision: 1,
          },
          1
        )
      )
      const before = await readRemoteRecurringChangesV2(actor, query)
      expect(before.changes[3]).toMatchObject({
        kind: "plan-occurrence",
        occurrence: { revision: 2, cancelled: true },
      })
      const occurrences = await getCollection(COLLECTION_NAMES.planOccurrences)
      const filter = { userId: actor, seriesId: itemId, id: occurrenceId }
      const stored = await occurrences.findOne(filter)
      if (!stored) throw new Error("Owned appearance fixture is missing")
      await occurrences.updateOne(filter, { $set: { revision: 1 } })
      try {
        await expect(
          readRemoteRecurringChangesV2(actor, query)
        ).rejects.toThrow("exceeds its current revisions")
      } finally {
        await occurrences.updateOne(filter, { $set: { revision: 2 } })
      }
      await occurrences.deleteOne(filter)
      try {
        await expect(
          readRemoteRecurringChangesV2(actor, query)
        ).rejects.toThrow("access is unavailable")
      } finally {
        await occurrences.insertOne(stored)
      }
      const items = await getCollection(COLLECTION_NAMES.items)
      await items.updateOne(
        { id: itemId, ownerId: actor },
        { $set: { ownerId: randomUUID() } }
      )
      try {
        await expect(
          readRemoteRecurringChangesV2(actor, query)
        ).rejects.toThrow("access is unavailable")
      } finally {
        await items.updateOne({ id: itemId }, { $set: { ownerId: actor } })
      }
      expect(await readRemoteRecurringChangesV2(actor, query)).toEqual(before)
    }, 30000)

    test("corrupt appearance evidence and missing sequence never yield a partial page", async () => {
      const { actor } = await seed()
      const journal = await getCollection(COLLECTION_NAMES.syncChanges)
      const filter = { recipientUserId: actor, sequence: 3 }
      const stored = await journal.findOne(filter)
      if (!stored) throw new Error("Owned journal fixture is missing")
      await journal.updateOne(filter, { $set: { seriesRevision: 99 } })
      try {
        await expect(
          readRemoteRecurringChangesV2(actor, query)
        ).rejects.toThrow()
      } finally {
        await journal.updateOne(filter, { $set: { seriesRevision: 1 } })
      }
      await journal.deleteOne(filter)
      try {
        await expect(
          readRemoteRecurringChangesV2(actor, query)
        ).rejects.toThrow("missing sequence")
      } finally {
        await journal.insertOne(stored)
      }
      expect(
        (await readRemoteRecurringChangesV2(actor, query)).changes
      ).toHaveLength(3)
    }, 30000)
  }
)
