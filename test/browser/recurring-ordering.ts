import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { applyLocalRecurringPreferenceResult } from "@/lib/local-db/preference-sync-results"
import type { TaskMoveCommand } from "@/lib/local-db/task-move-mutation"
import {
  commitLocalRecurringPlanMoveCommand,
  commitLocalTaskMoveCommand,
} from "@/lib/local-db/task-move-outbox"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { OutboxEntry } from "@/types/local-sync"

if (location.hostname !== "127.0.0.1" || location.port !== "4256")
  throw new Error("Recurring order fixture requires its isolated origin")
const params = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(params.get("run"))
const userId = `browser-test-${runId}-recurring-order`,
  otherId = `${userId}-other`
const proofKey = `dalis:recurring-order:${runId}`
const now = "2026-10-11T10:00:00.000Z"
const stores = [
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "settings",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
const list = document.getElementById("results"),
  status = document.getElementById("status"),
  actions = document.getElementById("actions")
if (!list || !status || !actions)
  throw new Error("Recurring order fixture markup missing")
const rows = list,
  statusElement = status,
  actionElement = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Recurring order browser assertion failed")
}
async function refused(work: () => Promise<unknown>) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed)
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  rows.append(row)
}
async function snapshot(db: IDBDatabase) {
  return runLocalTransaction<Record<string, unknown[]>>(
    db,
    stores,
    "readonly",
    (context) => {
      const value: Record<string, unknown[]> = {}
      let remaining = stores.length
      for (const name of stores) {
        const request = context.transaction.objectStore(name).getAll()
        request.onsuccess = () => {
          value[name] = request.result
          if (--remaining === 0) context.setResult(value)
        }
      }
    }
  )
}
async function seed(db: IDBDatabase) {
  const metadata = {
    revision: 8,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const series = planSchema.parse({
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: userId,
    kind: "plan",
    variant: "note",
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "timed",
      localStart: "2026-10-11T09:00",
      localEnd: "2026-10-11T09:30",
      timeZone: "Europe/Madrid",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  })
  const peer = planSchema.parse({
    ...series,
    id: crypto.randomUUID(),
    variant: "appointment",
    recurrence: null,
  })
  const occurrenceId = `${series.id}:2026-10-11T09:00`
  const occurrence = {
    ...applyPlanOccurrenceCommand(
      series,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: series.id,
        occurrenceId,
        status: "in_progress",
      },
      userId,
      now
    ),
    revision: 5,
  }
  const placements = [
    {
      ...metadata,
      userId,
      occurrenceId,
      scope: "day" as const,
      date: "2026-10-11",
      tagId: null,
      position: 1024,
      revision: 3,
    },
    {
      ...metadata,
      userId,
      occurrenceId: peer.id,
      scope: "day" as const,
      date: "2026-10-11",
      tagId: null,
      position: 0,
      revision: 6,
    },
  ]
  const views = [
    { ...metadata, userId, itemId: series.id, primaryTagId: null, revision: 2 },
  ]
  await runLocalTransaction(db, stores, "readwrite", (context) => {
    for (const name of stores) context.transaction.objectStore(name).clear()
    for (const item of [series, peer])
      context.transaction.objectStore("items").put(item)
    context.transaction.objectStore("occurrences").put(occurrence)
    for (const record of placements)
      context.transaction.objectStore("taskPlacements").put(record)
    for (const record of views)
      context.transaction.objectStore("itemViews").put(record)
    context.setResult(undefined)
  })
  const command: TaskMoveCommand = {
    type: "task.move",
    itemId: series.id,
    occurrenceId,
    scope: "day",
    date: "2026-10-11",
    tagId: null,
    beforeId: peer.id,
    afterId: null,
  }
  return { series, peer, occurrence, placements, views, command }
}
async function cleanup() {
  for (const id of [userId, otherId])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(localDatabaseName(id))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("Owned cleanup is blocked"))
    })
  sessionStorage.removeItem(proofKey)
}
async function run() {
  const db = await openLocalDatabase(userId),
    other = await openLocalDatabase(otherId)
  let keep = false
  try {
    if (params.get("phase") === "reload") {
      await check("recarga conserva datos e intención exactos", async () =>
        assert(
          JSON.stringify(await snapshot(db)) ===
            sessionStorage.getItem(proofKey)
        )
      )
      statusElement.textContent =
        "Siete comprobaciones aprobadas; particiones propias eliminadas."
      return
    }
    const value = await seed(db),
      options = { now: new Date(now) }
    await check(
      "caller actual y partición ajena rechazan sin escrituras",
      async () => {
        const before = JSON.stringify(await snapshot(db))
        await refused(() =>
          commitLocalTaskMoveCommand(db, userId, value.command, options, true)
        )
        await refused(() =>
          commitLocalRecurringPlanMoveCommand(
            other,
            userId,
            value.command,
            options
          )
        )
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    let first!: OutboxEntry, second!: OutboxEntry
    await check(
      "movimiento atómico conserva slot y revisiones de padre/aparición",
      async () => {
        first = await commitLocalRecurringPlanMoveCommand(
          db,
          userId,
          value.command,
          { ...options, operationId: crypto.randomUUID() }
        )
        assert(
          first.operation.baseRevision === 3 &&
            first.sequence === 1 &&
            first.entityKey ===
              taskPlacementEntityKey(
                value.command.occurrenceId ?? "",
                "day",
                value.command.date
              )
        )
        const state = await snapshot(db)
        assert(
          JSON.stringify(state.items) ===
            JSON.stringify(
              [value.series, value.peer].toSorted((a, b) =>
                a.id < b.id ? -1 : 1
              )
            )
        )
        assert(
          JSON.stringify(state.occurrences) ===
            JSON.stringify([value.occurrence])
        )
        assert(
          (
            state.taskPlacements as { occurrenceId: string; revision: number }[]
          ).find((record) => record.occurrenceId === value.occurrence.id)
            ?.revision === 3
        )
      }
    )
    await check(
      "replay UUID es readonly y dependiente conserva payload",
      async () => {
        const before = JSON.stringify(await snapshot(db))
        assert(
          JSON.stringify(
            await commitLocalRecurringPlanMoveCommand(
              db,
              userId,
              value.command,
              { ...options, operationId: first.operation.operationId }
            )
          ) === JSON.stringify(first)
        )
        assert(JSON.stringify(await snapshot(db)) === before)
        second = await commitLocalRecurringPlanMoveCommand(
          db,
          userId,
          { ...value.command, beforeId: null, afterId: value.peer.id },
          options
        )
        assert(
          second.sequence === 2 &&
            second.operation.baseRevision === 3 &&
            second.dependencies.includes(first.operation.operationId)
        )
      }
    )
    await check(
      "fallo tardío revierte posición, vista, secuencia, tail y outbox",
      async () => {
        const before = JSON.stringify(await snapshot(db)),
          put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (record, key) {
          if (this.name === "syncMetadata" && record?.key === "preference-tail")
            throw new Error("Injected late tail failure")
          return key === undefined
            ? put.call(this, record)
            : put.call(this, record, key)
        }
        try {
          await refused(() =>
            commitLocalRecurringPlanMoveCommand(
              db,
              userId,
              value.command,
              options
            )
          )
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    await check(
      "ACK futuro atómico rebasa sólo dependencia no intentada y conserva optimismo",
      async () => {
        const outbox = await LocalOutbox.open(userId),
          senderId = crypto.randomUUID()
        try {
          assert(
            (await outbox.claim(
              second.operation.operationId,
              senderId,
              new Date(now)
            )) === null
          )
          assert(
            (
              await outbox.claim(
                first.operation.operationId,
                senderId,
                new Date(now)
              )
            )?.attempts === 1
          )
          const planned = planRemoteRecurringTaskPlacementOperation({
            userId,
            timestamp: now,
            operation: first.operation,
            items: [value.series, value.peer],
            occurrences: [value.occurrence],
            tags: [],
            views: value.views,
            placements: value.placements,
          })
          assert(planned.status === "changes")
          const submission = {
            operation: first.operation,
            senderId,
            result: {
              kind: "preference",
              outcome: {
                operationId: first.operation.operationId,
                status: "applied",
                effects: {
                  version: 1,
                  userId,
                  operationId: first.operation.operationId,
                  sequence: 1,
                  effects: planned.effects,
                },
              },
            },
          }
          const frozen = JSON.stringify(await snapshot(db)),
            put = IDBObjectStore.prototype.put
          IDBObjectStore.prototype.put = function (record, key) {
            if (
              this.name === "syncMetadata" &&
              record?.key?.startsWith("operation-outcome:")
            )
              throw new Error("Injected late outcome failure")
            return key === undefined
              ? put.call(this, record)
              : put.call(this, record, key)
          }
          try {
            await refused(() =>
              applyLocalRecurringPreferenceResult(db, userId, submission)
            )
          } finally {
            IDBObjectStore.prototype.put = put
          }
          assert(JSON.stringify(await snapshot(db)) === frozen)
          assert(
            (await applyLocalRecurringPreferenceResult(
              db,
              userId,
              submission
            )) === "applied"
          )
          const state = await snapshot(db),
            entries = state.outbox as OutboxEntry[]
          assert(
            entries.find(
              (entry) =>
                entry.operation.operationId === first.operation.operationId
            )?.state === "acknowledged"
          )
          const pending = entries.find(
            (entry) =>
              entry.operation.operationId === second.operation.operationId
          )
          assert(
            pending?.operation.baseRevision === 4 &&
              JSON.stringify(pending.operation.command) ===
                JSON.stringify(second.operation.command) &&
              pending.dependencies.includes(first.operation.operationId)
          )
          assert(
            JSON.stringify(state.occurrences) ===
              JSON.stringify([value.occurrence])
          )
          const exact = JSON.stringify(state)
          assert(
            (await applyLocalRecurringPreferenceResult(
              db,
              userId,
              submission
            )) === "replayed"
          )
          assert(JSON.stringify(await snapshot(db)) === exact)
        } finally {
          outbox.close()
        }
      }
    )
    await check(
      "dependencia de serie pendiente se captura sin cambiar el UUID",
      async () => {
        const before = await snapshot(db),
          rootId = crypto.randomUUID()
        await runLocalTransaction(
          db,
          ["outbox", "syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("outbox").put({
              ...first,
              sequence: 3,
              entityKey: `item:${value.series.id}`,
              state: "pending",
              attempts: 0,
              lease: null,
              dependencies: [],
              operation: {
                operationId: rootId,
                protocolVersion: 1,
                baseRevision: 8,
                command: {
                  type: "item.update",
                  itemId: value.series.id,
                  input: {
                    kind: "plan",
                    variant: value.series.variant,
                    title: value.series.title,
                    description: value.series.description,
                    status: value.series.status,
                    checklist: value.series.checklist,
                    schedule: value.series.schedule,
                    recurrence: value.series.recurrence,
                  },
                },
              },
            })
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 3 })
            context.setResult(undefined)
          }
        )
        const id = crypto.randomUUID(),
          moved = await commitLocalRecurringPlanMoveCommand(
            db,
            userId,
            value.command,
            { ...options, operationId: id }
          )
        assert(
          moved.operation.operationId === id &&
            moved.dependencies.includes(rootId) &&
            moved.dependencies.includes(second.operation.operationId)
        )
        assert(
          JSON.stringify((await snapshot(db)).occurrences) ===
            JSON.stringify(before.occurrences)
        )
      }
    )
    sessionStorage.setItem(proofKey, JSON.stringify(await snapshot(db)))
    keep = true
    statusElement.textContent = "Seis comprobaciones aprobadas. Falta recarga."
    const button = document.createElement("button")
    button.textContent = "Verificar recarga y limpiar"
    button.onclick = () => {
      location.search = `?run=${runId}&phase=reload`
    }
    actionElement.append(button)
  } finally {
    db.close()
    other.close()
    if (!keep) await cleanup()
  }
}
run().catch((error: unknown) => {
  statusElement.textContent = "La comprobación ha fallado."
  console.error(error)
})
