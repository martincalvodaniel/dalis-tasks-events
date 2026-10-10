import type { z } from "zod"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { commitLocalPlanOccurrenceCommand } from "@/lib/local-db/plan-occurrence-outbox"
import { readLocalPlanSnapshot } from "@/lib/local-db/plan-snapshot"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import type { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import { entityIdSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error(
    "Plan occurrence fixtures require an isolated loopback origin"
  )
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const actor = `browser-test-${runId}-plan-occurrence`
const otherActor = `browser-test-${runId}-foreign-plan-occurrence`
const allowedNames = new Set([
  localDatabaseName(actor),
  localDatabaseName(otherActor),
])
const marker = `dalis:plan-occurrence-proof:${runId}`
const replayMarker = `${marker}:replay`
const variants = ["task", "event", "appointment", "note"] as const
const startDate = "2026-10-10"
const entryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const newEntryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const replayOperationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
function itemId(index: number) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
}
function occurrenceId(index: number, date = startDate) {
  return `${itemId(index)}:${date}`
}
const resultList = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!resultList || !status || !actions)
  throw new Error("Plan occurrence fixture markup is missing")
const resultsNode = resultList
const statusNode = status
const actionsNode = actions
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function rejects(work: () => Promise<unknown>) {
  let rejected = false
  try {
    await work()
  } catch {
    rejected = true
  }
  assert(rejected, "Plan occurrence operation did not reject")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  resultsNode.append(row)
  await work()
  row.textContent = `Correcto: ${label}`
}
async function removeOwnedDatabase(name: string) {
  assert(
    allowedNames.has(name) && sessionStorage.getItem(marker) === "owned",
    "Plan fixture cleanup ownership is missing"
  )
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error("Plan fixture cleanup is blocked"))
  })
}
type Options = {
  expectedItem: Plan
  expectedOccurrence: PlanOccurrence
  operationId?: string
  now?: Date
}
const cancel = {
  type: "plan.cancel-occurrence" as const,
  itemId: itemId(0),
  occurrenceId: occurrenceId(0),
}

async function run() {
  const existing = await indexedDB.databases()
  const ownExists = existing.some(
    (record) => record.name && allowedNames.has(record.name)
  )
  if (query.get("phase") === "reload")
    assert(
      sessionStorage.getItem(marker) === "owned" && ownExists,
      "Reload proof requires this run's existing partition"
    )
  else {
    assert(!ownExists, "Existing partition blocks a new plan occurrence proof")
    sessionStorage.setItem(marker, "owned")
  }
  const database = await openLocalDatabase(actor)
  const outbox = await LocalOutbox.open(actor)
  const repository = await LocalRepository.open(actor)
  let replayOptions: Options | undefined
  async function snapshot() {
    return JSON.stringify(
      await runLocalTransaction<Record<string, unknown[]>>(
        database,
        ["items", "occurrences", "outbox", "syncMetadata"],
        "readonly",
        (context) => {
          const records: Record<string, unknown[]> = {}
          let remaining = 4
          for (const name of [
            "items",
            "occurrences",
            "outbox",
            "syncMetadata",
          ]) {
            const request = context.transaction.objectStore(name).getAll()
            request.onsuccess = () => {
              records[name] = request.result
              if (--remaining === 0) context.setResult(records)
            }
          }
        }
      )
    )
  }
  async function sequence(value: number) {
    await runLocalTransaction(
      database,
      ["syncMetadata"],
      "readwrite",
      (context) => {
        context.transaction
          .objectStore("syncMetadata")
          .put({ key: "outbox-sequence", value })
        context.setResult(true)
      }
    )
  }
  async function expected(index: number, date = startDate): Promise<Options> {
    const parent = await repository.get("items", itemId(index))
    assert(parent?.kind === "plan", "Plan parent snapshot is missing")
    const stored = await repository.get(
      "occurrences",
      occurrenceId(index, date)
    )
    const occurrence =
      stored ??
      planOccurrencesPage(parent, { startDate: date, endDate: date, limit: 1 })
        .occurrences[0]
    assert(occurrence?.kind === "plan", "Plan occurrence snapshot is missing")
    return { expectedItem: parent, expectedOccurrence: occurrence }
  }
  const commit = (
    command: z.infer<typeof planOccurrenceCommandSchema>,
    options: Options
  ) => commitLocalPlanOccurrenceCommand(database, actor, command, options)
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Cuatro variantes y dieciocho intenciones sobreviven recarga sin ACK falso",
        async () => {
          const items = await repository.list("items", { includeDeleted: true })
          const occurrences = await repository.list("occurrences", {
            includeDeleted: true,
          })
          const entries = await outbox.listEntries()
          assert(
            items.length === 4 &&
              occurrences.length === 6 &&
              entries.length === 18,
            "Reload lost durable plan occurrence state"
          )
          for (let index = 0; index < variants.length; index++) {
            const parent = items.find((record) => record.id === itemId(index))
            assert(
              parent?.kind === "plan" &&
                parent.variant === variants[index] &&
                parent.status === "not_started" &&
                !parent.checklist[0].completed,
              "Occurrence progress mutated the parent"
            )
            const current = occurrences.find(
              (record) => record.id === occurrenceId(index)
            )
            assert(
              current?.kind === "plan" && current.checklist[0].completed,
              "Occurrence checklist did not persist"
            )
            if (index === 0)
              assert(
                parent.deletedAt &&
                  current.cancelled &&
                  current.status === "completed" &&
                  current.completedAt &&
                  current.slotKey === startDate &&
                  current.content?.title === "Reprogrammed common occurrence" &&
                  current.schedule.mode === "all_day" &&
                  current.schedule.startDate === "2026-11-01" &&
                  !current.checklist[1].completed,
                "Edited and cancelled common occurrence differs after reload"
              )
            else
              assert(
                !current.cancelled && current.status === "in_progress",
                "Independent variant progress did not persist"
              )
          }
          const lastByItem = new Map<string, string>()
          for (const [index, entry] of entries.entries()) {
            const previous = lastByItem.get(entry.entityKey)
            assert(
              entry.sequence === index + 1 &&
                entry.state === "pending" &&
                entry.attempts === 0 &&
                entry.lease === null &&
                (previous
                  ? entry.dependencies.includes(previous)
                  : entry.dependencies.length === 0),
              "Pending intent order/dependency/ACK state changed"
            )
            lastByItem.set(entry.entityKey, entry.operation.operationId)
          }
          const saved = JSON.parse(
            sessionStorage.getItem(replayMarker) ?? "null"
          ) as Options | null
          assert(saved, "Reload replay snapshot is missing")
          replayOptions = {
            expectedItem: planSchema.parse(saved.expectedItem),
            expectedOccurrence: planOccurrenceSchema.parse(
              saved.expectedOccurrence
            ),
            operationId: replayOperationId,
          }
          const before = await snapshot()
          const replayed = await commit(cancel, replayOptions)
          assert(
            replayed.sequence === 15 && (await snapshot()) === before,
            "Reload replay changed durable history"
          )
        }
      )
    } else {
      for (const [index, variant] of variants.entries())
        await outbox.commitItemCommand({
          type: "item.create",
          itemId: itemId(index),
          input: {
            kind: "plan",
            variant,
            title: `Recurring ${variant}`,
            description: "Parent details",
            status: "not_started",
            checklist: [
              { id: entryId, text: "Independent step", completed: false },
            ],
            schedule: {
              mode: "all_day",
              startDate,
              endDateExclusive: "2026-10-11",
            },
            recurrence: {
              frequency: "daily",
              anchorDate: startDate,
              interval: 1,
              timeZone: "Europe/Madrid",
              end: { type: "count", count: 3 },
            },
          },
        })
      const initialParents = JSON.stringify(await repository.list("items"))
      await check(
        "Cuatro variantes crean progreso independiente y la misma cadena por item",
        async () => {
          for (let index = 0; index < variants.length; index++) {
            const options = await expected(index)
            const entry = await commit(
              {
                type: "plan.set-occurrence-status",
                itemId: itemId(index),
                occurrenceId: occurrenceId(index),
                status: "in_progress",
              },
              options
            )
            assert(
              entry.sequence === index + 5 &&
                entry.entityKey === `item:${itemId(index)}` &&
                entry.operation.baseRevision ===
                  options.expectedItem.revision &&
                entry.state === "pending",
              "Common occurrence producer created invalid intention"
            )
          }
          for (let index = 0; index < variants.length; index++)
            await commit(
              {
                type: "plan.set-occurrence-checklist-entry",
                itemId: itemId(index),
                occurrenceId: occurrenceId(index),
                entryId,
                completed: true,
              },
              await expected(index)
            )
          assert(
            JSON.stringify(await repository.list("items")) === initialParents,
            "Independent progress changed a parent template"
          )
          assert(
            (await repository.list("occurrences")).length === 4,
            "Independent progress materialized extra dates"
          )
        }
      )
      await check(
        "CAS de padre y aparición rechaza snapshots obsoletos sin escrituras",
        async () => {
          const options = await expected(0)
          const command = {
            type: "plan.set-occurrence-status" as const,
            itemId: itemId(0),
            occurrenceId: occurrenceId(0),
            status: "completed" as const,
          }
          const before = await snapshot()
          await rejects(() =>
            commit(command, {
              ...options,
              expectedItem: { ...options.expectedItem, title: "Stale parent" },
            })
          )
          await rejects(() =>
            commit(command, {
              ...options,
              expectedOccurrence: {
                ...options.expectedOccurrence,
                status: "not_started",
              },
            })
          )
          assert(
            (await snapshot()) === before,
            "CAS rejection partially wrote common state"
          )
        }
      )
      await check(
        "Editar y completar conserva slot, pasos previos y otras variantes",
        async () => {
          const options = await expected(0)
          await commit(
            {
              type: "plan.update-occurrence",
              itemId: itemId(0),
              occurrenceId: occurrenceId(0),
              input: {
                title: "Reprogrammed common occurrence",
                description: "Local details",
                schedule: {
                  mode: "all_day",
                  startDate: "2026-11-01",
                  endDateExclusive: "2026-11-03",
                },
                checklist: [
                  { id: entryId, text: "Retained step" },
                  { id: newEntryId, text: "New step" },
                ],
              },
            },
            options
          )
          await commit(
            {
              type: "plan.set-occurrence-status",
              itemId: itemId(0),
              occurrenceId: occurrenceId(0),
              status: "completed",
            },
            await expected(0)
          )
          const current = (await expected(0)).expectedOccurrence
          assert(
            current.slotKey === startDate &&
              current.status === "completed" &&
              current.completedAt &&
              current.checklist[0].completed &&
              !current.checklist[1].completed,
            "Occurrence edit lost slot or progress"
          )
          assert(
            JSON.stringify(await repository.list("items")) === initialParents,
            "Occurrence edit changed a parent"
          )
        }
      )
      await check(
        "Cancelar preserva progreso, replay exacto y rechaza reutilizar UUID",
        async () => {
          replayOptions = {
            ...(await expected(0)),
            operationId: replayOperationId,
          }
          sessionStorage.setItem(replayMarker, JSON.stringify(replayOptions))
          const entry = await commit(cancel, replayOptions)
          const before = await snapshot()
          assert(
            (await commit(cancel, replayOptions)).sequence === entry.sequence &&
              entry.sequence === 15,
            "Exact occurrence replay changed sequence"
          )
          await rejects(async () =>
            commit(
              { ...cancel, occurrenceId: occurrenceId(0, "2026-10-11") },
              {
                ...(await expected(0, "2026-10-11")),
                operationId: replayOperationId,
              }
            )
          )
          assert(
            (await snapshot()) === before,
            "Operation UUID reuse changed history"
          )
          await commit(
            { ...cancel, occurrenceId: occurrenceId(0, "2026-10-11") },
            await expected(0, "2026-10-11")
          )
        }
      )
      await check(
        "Otra cuenta rechaza el padre ajeno sin aparición ni intención parcial",
        async () => {
          const foreign = await openLocalDatabase(otherActor)
          try {
            const options = await expected(1)
            await runLocalTransaction(
              foreign,
              ["items"],
              "readwrite",
              (context) => {
                context.transaction
                  .objectStore("items")
                  .put(options.expectedItem)
                context.setResult(true)
              }
            )
            await rejects(() =>
              commitLocalPlanOccurrenceCommand(
                foreign,
                otherActor,
                {
                  type: "plan.set-occurrence-status",
                  itemId: itemId(1),
                  occurrenceId: occurrenceId(1),
                  status: "completed",
                },
                options
              )
            )
            const empty = await runLocalTransaction<number[]>(
              foreign,
              ["occurrences", "outbox"],
              "readonly",
              (context) => {
                const counts: number[] = []
                let remaining = 2
                for (const name of ["occurrences", "outbox"]) {
                  const request = context.transaction.objectStore(name).count()
                  request.onsuccess = () => {
                    counts.push(request.result)
                    if (--remaining === 0) context.setResult(counts)
                  }
                }
              }
            )
            assert(
              empty.every((count) => count === 0),
              "Foreign owner rejection wrote an occurrence or ACK"
            )
          } finally {
            foreign.close()
          }
        }
      )
      await check(
        "Colisión de secuencia revierte aparición, cola y notificación",
        async () => {
          const options = await expected(0, "2026-10-12")
          const command = {
            type: "plan.update-occurrence" as const,
            itemId: itemId(0),
            occurrenceId: occurrenceId(0, "2026-10-12"),
            input: {
              title: "Retried occurrence",
              description: "",
              schedule: {
                mode: "all_day" as const,
                startDate: "2026-11-04",
                endDateExclusive: "2026-11-05",
              },
              checklist: [{ id: entryId, text: "Step" }],
            },
          }
          let notifications = 0
          const notificationCount = () => notifications
          const notified = (event: Event) => {
            if (event instanceof CustomEvent && event.detail?.userId === actor)
              notifications++
          }
          window.addEventListener("dalis:outbox-changed", notified)
          try {
            await sequence(0)
            const before = await snapshot()
            await rejects(() => commit(command, options))
            assert(
              (await snapshot()) === before &&
                notificationCount() === 0 &&
                (await repository.get("occurrences", command.occurrenceId)) ===
                  null,
              "Failed occurrence transaction leaked state or notification"
            )
            await sequence(16)
            const entry = await commit(command, options)
            assert(
              entry.sequence === 17 && notificationCount() === 1,
              "Successful occurrence commit did not publish exactly once"
            )
          } finally {
            window.removeEventListener("dalis:outbox-changed", notified)
          }
        }
      )
      await check(
        "Replay gana tras borrar padre y ninguna operación obtiene ACK local",
        async () => {
          await outbox.commitItemCommand({
            type: "item.delete",
            itemId: itemId(0),
          })
          const before = await snapshot()
          assert(replayOptions, "Replay options are missing")
          assert(
            (await commit(cancel, replayOptions)).sequence === 15,
            "Deleted parent blocked exact persisted replay"
          )
          assert(
            (await snapshot()) === before,
            "Replay after deletion rewrote history"
          )
          const entries = await outbox.listEntries()
          assert(
            entries.length === 18 &&
              entries.every(
                (entry) =>
                  entry.state === "pending" &&
                  entry.attempts === 0 &&
                  entry.lease === null
              ),
            "Local common occurrence commands fabricated an ACK"
          )
        }
      )
      await check(
        "Snapshot común lee todos los almacenes y rechaza otra partición y configuración ausente",
        async () => {
          await rejects(() => readLocalPlanSnapshot(database, actor))
          await repository.put("settings", {
            userId: actor,
            timeZone: "Europe/Madrid",
            weekStartsOn: 1,
            locale: "es-ES",
            revision: 0,
            createdAt: "2026-10-10T12:00:00.000Z",
            updatedAt: "2026-10-10T12:00:00.000Z",
            deletedAt: null,
          })
          const snapshotRecord = await readLocalPlanSnapshot(database, actor)
          assert(
            snapshotRecord.items.length === 4 &&
              snapshotRecord.occurrences.length === 6 &&
              snapshotRecord.settings.userId === actor &&
              snapshotRecord.views.length === 0 &&
              snapshotRecord.tags.length === 0,
            "Snapshot omitted persisted common records"
          )
          const before = await snapshot()
          await rejects(() => readLocalPlanSnapshot(database, otherActor))
          assert(
            (await snapshot()) === before,
            "Rejected snapshot changed durable state"
          )
        }
      )
      const reload = document.createElement("a")
      reload.href = `/?run=${runId}&phase=reload`
      reload.textContent = "Comprobar recarga"
      actionsNode.append(reload)
    }
    statusNode.textContent = "Todas las pruebas han pasado."
    const cleanup = document.createElement("button")
    cleanup.textContent = "Limpiar bases de prueba"
    cleanup.onclick = async () => {
      for (const name of allowedNames) await removeOwnedDatabase(name)
      sessionStorage.removeItem(marker)
      sessionStorage.removeItem(replayMarker)
      statusNode.textContent = "Bases de prueba eliminadas."
      cleanup.disabled = true
    }
    actionsNode.append(cleanup)
  } finally {
    repository.close()
    outbox.close()
    database.close()
  }
}
void run().catch((error: unknown) => {
  statusNode.textContent = "Pruebas fallidas."
  console.error(
    error instanceof Error ? error.message : "Plan occurrence proof failed"
  )
})
