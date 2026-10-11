"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  decodeRemoteRecurringShadow,
  validateLocalPlanOccurrenceResultInput,
} from "@/lib/sync/local-plan-occurrence-sync"
import { planLocalPlanOccurrenceResult } from "@/lib/sync/plan-occurrence-result-plan"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { userIdSchema } from "@/schemas/primitives"

// Prepared generation-five port. Caller owns epoch checks; this protects one partition.
export function applyLocalPlanOccurrenceResult(
  database: IDBDatabase,
  userIdInput: unknown,
  input: unknown
): Promise<"applied" | "replayed"> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Appearance result database belongs to another partition")
    )
  const submission = validateLocalPlanOccurrenceResultInput(input, userId)
  const command = submission.operation.command
  return runLocalTransaction(
    database,
    ["items", "occurrences", "outbox", "remoteShadows", "syncMetadata"],
    "readwrite",
    (context) => {
      const transaction = context.transaction
      const occurrences = transaction.objectStore("occurrences"),
        outbox = transaction.objectStore("outbox"),
        shadows = transaction.objectStore("remoteShadows"),
        metadata = transaction.objectStore("syncMetadata")
      const requests = {
        parent: transaction.objectStore("items").get(command.itemId),
        local: occurrences.get(command.occurrenceId),
        entries: outbox.getAll(undefined, 10001),
        shadows: shadows.getAll(undefined, 10001),
        outcome: metadata.get(
          `operation-outcome:${submission.operation.operationId}`
        ),
      }
      let remaining = 5
      const finish = () => {
        if (--remaining) return
        try {
          if (
            requests.entries.result.length > 10000 ||
            requests.shadows.result.length > 10000
          )
            throw new Error(
              "Appearance result snapshot exceeds its record limit"
            )
          const parent =
            requests.parent.result === undefined
              ? null
              : calendarItemSchema.parse(requests.parent.result)
          if (parent && parent.kind !== "plan")
            throw new Error("Appearance result parent is not a common plan")
          const plan = planLocalPlanOccurrenceResult({
            userId,
            submission,
            series: parent,
            local:
              requests.local.result === undefined
                ? null
                : planOccurrenceSchema.parse(requests.local.result),
            entries: requests.entries.result,
            shadows: requests.shadows.result.map((value: unknown) =>
              decodeRemoteRecurringShadow(value, userId)
            ),
            existingOutcome: requests.outcome.result ?? null,
          })
          if (plan.status === "replayed") {
            context.setResult("replayed")
            return
          }
          if (plan.local) occurrences.put(plan.local)
          const oldShadows = new Map(
            requests.shadows.result.map((value) => [
              value.entityKey,
              JSON.stringify(value),
            ])
          )
          for (const shadow of plan.shadows)
            if (oldShadows.get(shadow.entityKey) !== JSON.stringify(shadow))
              shadows.put(shadow)
          const oldEntries = new Map(
            requests.entries.result.map((value) => [
              value.operation.operationId,
              JSON.stringify(value),
            ])
          )
          for (const entry of plan.entries)
            if (
              oldEntries.get(entry.operation.operationId) !==
              JSON.stringify(entry)
            )
              outbox.put(entry)
          metadata.put(plan.outcome)
          context.setResult("applied")
        } catch (error) {
          context.fail(error)
        }
      }
      for (const request of Object.values(requests)) request.onsuccess = finish
    }
  )
}
