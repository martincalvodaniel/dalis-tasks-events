import "server-only"

import { randomUUID } from "node:crypto"
import { type ClientSession, MongoServerError } from "mongodb"
import type { z } from "zod"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { eventInputSchema } from "@/schemas/event-input"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import {
  remoteItemChangeSchema,
  remoteOperationReceiptSchema,
  remoteOperationResultSchema,
} from "@/schemas/remote-sync"
import { syncOperationSchema } from "@/schemas/sync"
import type { CalendarItem, CalendarItemDraft } from "@/types/calendar-item"
import type { RemoteOperationResult } from "@/types/remote-sync"
import type { ItemCommand } from "@/types/sync"

type ReceiptDocument = z.infer<typeof remoteOperationReceiptSchema> & {
  _id: string
}
type ChangeDocument = z.infer<typeof remoteItemChangeSchema> & { _id: string }
type CounterDocument = { _id: string; sequence: number }

function isItemCommand(command: { type: string }): command is ItemCommand {
  return [
    "item.create",
    "item.update",
    "item.delete",
    "task.set-status",
    "task.set-checklist-entry",
  ].includes(command.type)
}

function isSimpleItem(item: CalendarItem | CalendarItemDraft): boolean {
  return item.kind !== "birthday" && !item.recurrence
}

class ItemCompareAndSwapError extends Error {}
export class OperationIdentityReuseError extends Error {
  constructor() {
    super("Operation identity was reused with a different payload")
  }
}

// Only an authenticated server service may supply actorInput; payloads contain no actor.
export async function executeRemoteItemOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResult> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const fingerprint = syncOperationFingerprint(operation)
  const now = new Date().toISOString()
  const database = await getDatabase()
  const receipts = await getCollection<ReceiptDocument>(
    COLLECTION_NAMES.syncOperations
  )
  const changes = await getCollection<ChangeDocument>(
    COLLECTION_NAMES.syncChanges
  )
  const counters = await getCollection<CounterDocument>(
    COLLECTION_NAMES.syncCounters
  )

  async function transact(
    session: ClientSession
  ): Promise<RemoteOperationResult> {
    const stored = await receipts.findOne(
      { actorUserId: actor, operationId: operation.operationId },
      { session }
    )
    if (stored) {
      const { _id, ...value } = stored
      const receipt = remoteOperationReceiptSchema.parse(value)
      if (receipt.fingerprint !== fingerprint)
        throw new OperationIdentityReuseError()
      return receipt.result
    }
    const command = operation.command
    const result = (
      status: "unsupported" | "unavailable" | "invalid_command"
    ): RemoteOperationResult => ({ operationId: operation.operationId, status })
    if (
      !isItemCommand(command) ||
      ((command.type === "item.create" || command.type === "item.update") &&
        !isSimpleItem(command.input)) ||
      ((command.type === "task.set-status" ||
        command.type === "task.set-checklist-entry") &&
        command.occurrenceId !== null)
    )
      return result("unsupported")

    const repository = await RemoteItemRepository.open(actor, session)
    const current = await repository.read(command.itemId)
    let outcome: RemoteOperationResult
    if (current && !isSimpleItem(current)) return result("unsupported")
    if (
      command.type === "item.create"
        ? Boolean(current)
        : Boolean(
            current &&
              (current.deletedAt || current.revision !== operation.baseRevision)
          )
    ) {
      if (!current) throw new Error("Conflicting item is missing")
      outcome = {
        operationId: operation.operationId,
        status: "conflict",
        current,
      }
    } else if (
      (command.type !== "item.create" && !current) ||
      (command.type === "item.create" &&
        (await repository.identityExists(command.itemId)))
    ) {
      outcome = result("unavailable")
    } else if (
      (command.type === "item.update" &&
        current?.kind !== command.input.kind) ||
      ((command.type === "item.create" || command.type === "item.update") &&
        command.input.kind === "event" &&
        !eventInputSchema.safeParse(command.input).success) ||
      ((command.type === "task.set-status" ||
        command.type === "task.set-checklist-entry") &&
        current?.kind !== "task") ||
      (command.type === "task.set-checklist-entry" &&
        current?.kind === "task" &&
        !current.checklist.some((entry) => entry.id === command.entryId))
    ) {
      outcome = result("invalid_command")
    } else {
      const next = applyItemCommand(current, command, actor, now)
      next.revision = revisionSchema.parse(operation.baseRevision + 1)
      const written =
        command.type === "item.create"
          ? await repository.insert(next)
          : await repository.replace(operation.baseRevision, next)
      if (!written)
        throw new ItemCompareAndSwapError(
          "Remote item changed during the transaction"
        )
      const counter = await counters.findOneAndUpdate(
        { _id: actor },
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: "after", session }
      )
      const sequence = revisionSchema.min(1).parse(counter?.sequence)
      const change = remoteItemChangeSchema.parse({
        recipientUserId: actor,
        operationId: operation.operationId,
        sequence,
        item: next,
      })
      await changes.insertOne({ ...change, _id: randomUUID() }, { session })
      outcome = {
        operationId: operation.operationId,
        status: "applied",
        item: next,
        sequence,
      }
    }
    const receipt = remoteOperationReceiptSchema.parse({
      actorUserId: actor,
      operationId: operation.operationId,
      fingerprint,
      result: outcome,
      createdAt: now,
    })
    await receipts.insertOne({ ...receipt, _id: randomUUID() }, { session })
    return remoteOperationResultSchema.parse(outcome)
  }

  // Duplicate insert races abort their transaction; restart with a fresh snapshot.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await database.client.withSession((session) =>
        session.withTransaction(() => transact(session), {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary",
          timeoutMS: 15000,
        })
      )
    } catch (error) {
      const insertRace =
        error instanceof MongoServerError &&
        error.code === 11000 &&
        (error.keyPattern?._id === 1 || error.keyPattern?.actorUserId === 1)
      if (
        attempt === 2 ||
        (!insertRace && !(error instanceof ItemCompareAndSwapError))
      )
        throw error
    }
  }
  throw new Error("Remote operation retry limit reached")
}
