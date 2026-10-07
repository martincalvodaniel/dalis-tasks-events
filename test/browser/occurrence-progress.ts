import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Occurrence fixtures require an isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-occurrences`
const otherUserId = `browser-test-${runId}-other-occurrences`
const itemId = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const completeOperationId = "be3a8476-96b5-4b0a-84f8-cb582684578b"
const firstId = `${itemId}:2026-10-07`
const secondId = `${itemId}:2026-10-08`
const thirdId = `${itemId}:2026-10-09`
const input = taskDraftSchema.parse({
  kind: "task",
  title: "Test series",
  description: "",
  scheduledDate: "2026-10-07",
  status: "not_started",
  checklist: [{ id: entryId, text: "Test step", completed: true }],
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-07",
    interval: 1,
    timeZone: "Europe/Madrid",
    end: { type: "count", count: 3 },
  },
})
const results = document.getElementById("results")
const statusNode = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !statusNode || !actions)
  throw new Error("Test fixture markup is missing")
const resultList = results
const status = statusNode
const actionContainer = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Occurrence browser assertion failed")
}
async function rejects(work: () => Promise<unknown>) {
  let rejected = false
  try {
    await work()
  } catch {
    rejected = true
  }
  assert(rejected)
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  resultList.append(row)
  row.textContent = label
  await work()
  row.textContent = `Correcto: ${label}`
}
async function run() {
  const outbox = await LocalOutbox.open(userId)
  const repository = await LocalRepository.open(userId)
  const database = await openLocalDatabase(userId)
  const complete = {
    type: "task.set-status" as const,
    itemId,
    occurrenceId: secondId,
    status: "completed" as const,
  }
  async function snapshot() {
    return JSON.stringify(
      await Promise.all([
        repository.list("items", { includeDeleted: true }),
        repository.list("occurrences", { includeDeleted: true }),
        outbox.listEntries(),
        runLocalTransaction(
          database,
          ["syncMetadata"],
          "readonly",
          (context) => {
            const request = context.transaction
              .objectStore("syncMetadata")
              .get("outbox-sequence")
            request.onsuccess = () => context.setResult(request.result)
          }
        ),
      ])
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
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Tres apariciones y siete intenciones persisten tras recargar",
        async () => {
          const entries = await outbox.listEntries()
          const occurrences = await repository.list("occurrences")
          assert(entries.length === 7 && occurrences.length === 3)
          assert(entries.every((entry, index) => entry.sequence === index + 1))
          const first = occurrences.find((record) => record.id === firstId)
          const second = occurrences.find((record) => record.id === secondId)
          assert(
            first?.kind === "task" &&
              first.status === "in_progress" &&
              first.checklist[0].completed
          )
          assert(
            second?.kind === "task" &&
              second.status === "not_started" &&
              !second.checklist[0].completed &&
              !second.completedAt
          )
          assert((await repository.get("items", itemId))?.deletedAt)
        }
      )
    } else {
      let parentSnapshot = ""
      await check(
        "Primer cambio materializa solo una aparición con cola atómica",
        async () => {
          const created = await outbox.commitItemCommand({
            type: "item.create",
            itemId,
            input,
          })
          parentSnapshot = JSON.stringify(await repository.get("items", itemId))
          const started = await outbox.commitItemCommand({
            type: "task.set-status",
            itemId,
            occurrenceId: firstId,
            status: "in_progress",
          })
          const records = await repository.list("occurrences")
          assert(
            records.length === 1 &&
              records[0].kind === "task" &&
              records[0].status === "in_progress" &&
              !records[0].checklist[0].completed
          )
          assert(
            started.sequence === 2 &&
              started.operation.baseRevision === 0 &&
              started.entityKey === `item:${itemId}` &&
              started.dependencies[0] === created.operation.operationId
          )
          assert(
            JSON.stringify(await repository.get("items", itemId)) ===
              parentSnapshot
          )
        }
      )
      await check(
        "Checklist y estado independientes, replay y reapertura conservan otros campos",
        async () => {
          await outbox.commitItemCommand({
            type: "task.set-checklist-entry",
            itemId,
            occurrenceId: firstId,
            entryId,
            completed: true,
          })
          const completed = await outbox.commitItemCommand(complete, {
            operationId: completeOperationId,
          })
          const before = await snapshot()
          assert(
            (
              await outbox.commitItemCommand(complete, {
                operationId: completeOperationId,
              })
            ).sequence === completed.sequence
          )
          assert((await snapshot()) === before)
          const first = await repository.get("occurrences", firstId)
          const second = await repository.get("occurrences", secondId)
          assert(
            first?.kind === "task" &&
              first.status === "in_progress" &&
              first.checklist[0].completed
          )
          assert(
            second?.kind === "task" &&
              second.status === "completed" &&
              !second.checklist[0].completed &&
              second.completedAt
          )
          await outbox.commitItemCommand({ ...complete, status: "not_started" })
          const reopened = await repository.get("occurrences", secondId)
          assert(
            reopened?.kind === "task" &&
              reopened.status === "not_started" &&
              reopened.completedAt === null
          )
          assert(
            JSON.stringify(await repository.get("items", itemId)) ===
              parentSnapshot
          )
        }
      )
      await check(
        "Slots falsos, campo ajeno, serie obsoleta y otro usuario no escriben",
        async () => {
          const before = await snapshot()
          for (const occurrenceId of [
            `${itemId}:2026-10-10`,
            `${entryId}:2026-10-07`,
            `${itemId}:2026-10-07T09:00`,
            null,
          ])
            await rejects(() =>
              outbox.commitItemCommand({ ...complete, occurrenceId })
            )
          await rejects(() =>
            outbox.commitItemCommand(
              { ...complete, status: "in_progress" },
              { operationId: completeOperationId }
            )
          )
          await rejects(() =>
            outbox.commitItemCommand({
              type: "task.set-checklist-entry",
              itemId,
              occurrenceId: firstId,
              entryId: itemId,
              completed: false,
            })
          )
          const parent = await repository.get("items", itemId)
          assert(parent)
          await rejects(() =>
            outbox.commitItemCommand(complete, {
              expectedItem: { ...parent, title: "Stale title" },
            })
          )
          const other = await LocalOutbox.open(otherUserId)
          const otherRepository = await LocalRepository.open(otherUserId)
          try {
            await otherRepository.put("items", parent)
            await rejects(() => other.commitItemCommand(complete))
            assert(
              (await other.listEntries()).length === 0 &&
                (await otherRepository.list("occurrences")).length === 0
            )
          } finally {
            other.close()
            otherRepository.close()
          }
          assert((await snapshot()) === before)
        }
      )
      await check(
        "Fallo al insertar outbox revierte aparición y secuencia",
        async () => {
          await sequence(0)
          const before = await snapshot()
          await rejects(() =>
            outbox.commitItemCommand({
              ...complete,
              occurrenceId: thirdId,
              status: "in_progress",
            })
          )
          assert((await snapshot()) === before)
          assert((await repository.get("occurrences", thirdId)) === null)
          await sequence(5)
          await outbox.commitItemCommand({
            ...complete,
            occurrenceId: thirdId,
            status: "in_progress",
          })
        }
      )
      await check(
        "Canceladas y tombstones rechazan progreso sin descartar replay previo",
        async () => {
          const third = await repository.get("occurrences", thirdId)
          assert(third)
          for (const modified of [
            { ...third, cancelled: true },
            { ...third, deletedAt: new Date().toISOString() },
          ]) {
            await repository.put("occurrences", modified)
            const before = await snapshot()
            await rejects(() =>
              outbox.commitItemCommand({ ...complete, occurrenceId: thirdId })
            )
            assert((await snapshot()) === before)
          }
          await repository.put("occurrences", third)
          await outbox.commitItemCommand({ type: "item.delete", itemId })
          const before = await snapshot()
          await rejects(() =>
            outbox.commitItemCommand({ ...complete, status: "in_progress" })
          )
          assert(
            (
              await outbox.commitItemCommand(complete, {
                operationId: completeOperationId,
              })
            ).sequence === 4
          )
          assert((await snapshot()) === before)
          const entries = await outbox.listEntries()
          assert(
            entries.length === 7 &&
              entries
                .slice(1)
                .every(
                  (entry, index) =>
                    entry.dependencies[0] ===
                    entries[index].operation.operationId
                )
          )
        }
      )
      const link = document.createElement("a")
      link.href = `/?run=${runId}&phase=reload`
      link.textContent = "Comprobar recarga"
      actionContainer.append(link)
    }
    status.textContent = "Todas las pruebas han pasado."
    const cleanup = document.createElement("button")
    cleanup.textContent = "Limpiar bases de prueba"
    cleanup.onclick = async () => {
      for (const actor of [userId, otherUserId])
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(localDatabaseName(actor))
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      status.textContent = "Bases de prueba eliminadas."
      cleanup.disabled = true
    }
    actionContainer.append(cleanup)
  } finally {
    outbox.close()
    repository.close()
    database.close()
  }
}
void run().catch((error: unknown) => {
  status.textContent = "Pruebas fallidas."
  console.error(error)
})
