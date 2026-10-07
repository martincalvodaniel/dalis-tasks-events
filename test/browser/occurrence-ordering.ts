import { occurrencesPage } from "@/lib/calendar/occurrences"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { entityIdSchema } from "@/schemas/primitives"
import type { Task } from "@/types/calendar-item"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Ordering fixtures require an isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-occurrence-ordering`
const otherUserId = `browser-test-${runId}-other-occurrence-ordering`
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
]
const tagId = "40000000-0000-4000-8000-000000000004"
const operationId = "50000000-0000-4000-8000-000000000005"
const occurrenceId = `${ids[2]}:2026-10-07`
const tomorrowId = `${ids[2]}:2026-10-08`
const draft = taskDraftSchema.parse({
  kind: "task",
  title: "Test day ordering",
  description: "",
  scheduledDate: "2026-10-07",
  status: "not_started",
  checklist: [],
  recurrence: null,
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
  if (!value) throw new Error("Occurrence ordering browser assertion failed")
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
  const repository = await LocalRepository.open(userId)
  const outbox = await LocalOutbox.open(userId)
  const database = await openLocalDatabase(userId)
  const move = {
    type: "task.move" as const,
    itemId: ids[2],
    occurrenceId,
    scope: "day" as const,
    date: "2026-10-07",
    tagId: null,
    beforeId: ids[1],
    afterId: ids[0],
  }
  const tomorrow = {
    ...move,
    occurrenceId: tomorrowId,
    date: "2026-10-08",
    beforeId: null,
    afterId: null,
  }
  async function snapshot() {
    return JSON.stringify(
      await Promise.all([
        repository.list("items", { includeDeleted: true }),
        repository.list("occurrences", { includeDeleted: true }),
        repository.list("taskPlacements", { includeDeleted: true }),
        repository.list("itemViews", { includeDeleted: true }),
        outbox.listEntries(),
        runLocalTransaction(
          database,
          ["syncMetadata"],
          "readonly",
          (context) => {
            const request = context.transaction
              .objectStore("syncMetadata")
              .getAll()
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
    if (query.get("phase") !== "reload") {
      for (const id of ids)
        await outbox.commitItemCommand({
          type: "item.create",
          itemId: id,
          input:
            id === ids[2]
              ? {
                  ...draft,
                  recurrence: {
                    frequency: "daily",
                    anchorDate: draft.scheduledDate,
                    interval: 1,
                    timeZone: "Europe/Madrid",
                    end: { type: "count", count: 3 },
                  },
                }
              : draft,
        })
      await check(
        "Aparición virtual se ordena entre simples sin materializar progreso",
        async () => {
          const beforeItems = JSON.stringify(await repository.list("items"))
          const receipt = await outbox.commitPreferenceCommand(move, {
            operationId,
          })
          assert(
            receipt.sequence === 4 &&
              receipt.entityKey ===
                taskPlacementEntityKey(occurrenceId, "day", move.date) &&
              receipt.dependencies[0] ===
                (await outbox.listEntries())[2].operation.operationId
          )
          const parent = await repository.get("items", ids[2])
          assert(parent?.kind === "task")
          const occurrence = occurrencesPage(parent, {
            startDate: move.date,
            endDate: move.date,
          }).occurrences[0]
          assert(occurrence?.kind === "task")
          const items = await repository.list("items")
          const simples = items.filter(
            (item): item is Task => item.kind === "task" && !item.recurrence
          )
          const placements = await repository.list("taskPlacements")
          assert(
            JSON.stringify(
              orderPlacedTasks([...simples, occurrence], placements, null).map(
                (record) => record.id
              )
            ) === JSON.stringify([ids[0], occurrenceId, ids[1]])
          )
          assert(
            (await repository.list("occurrences")).length === 0 &&
              JSON.stringify(await repository.list("items")) === beforeItems
          )
          const before = await snapshot()
          assert(
            (await outbox.commitPreferenceCommand(move, { operationId }))
              .sequence === 4
          )
          await rejects(() =>
            outbox.commitPreferenceCommand(
              { ...move, beforeId: ids[0], afterId: null },
              { operationId }
            )
          )
          assert((await snapshot()) === before)
        }
      )
      await check(
        "Simple se mueve junto a aparición y rollback no deja colocación parcial",
        async () => {
          const receipt = await outbox.commitPreferenceCommand({
            ...move,
            itemId: ids[1],
            occurrenceId: null,
            beforeId: occurrenceId,
            afterId: ids[0],
          })
          assert(
            receipt.sequence === 5 && receipt.dependencies.includes(operationId)
          )
          await sequence(0)
          const before = await snapshot()
          await rejects(() => outbox.commitPreferenceCommand(tomorrow))
          assert((await snapshot()) === before)
          assert(
            (await repository.list("taskPlacements")).every(
              (record) => record.date === move.date
            )
          )
          await sequence(5)
          assert(
            (await outbox.commitPreferenceCommand(tomorrow)).sequence === 6
          )
          assert((await repository.list("occurrences")).length === 0)
        }
      )
      await check(
        "Cancelación invalida día y conserva replay; categoría pertenece a la serie",
        async () => {
          const parent = await repository.get("items", ids[2])
          assert(parent?.kind === "task")
          const occurrence = occurrencesPage(parent, {
            startDate: move.date,
            endDate: move.date,
          }).occurrences[0]
          assert(occurrence)
          await outbox.commitOccurrenceCommand(
            { type: "task.cancel-occurrence", itemId: parent.id, occurrenceId },
            { expectedItem: parent, expectedOccurrence: occurrence }
          )
          const before = await snapshot()
          await rejects(() => outbox.commitPreferenceCommand(move))
          assert(
            (await outbox.commitPreferenceCommand(move, { operationId }))
              .sequence === 4
          )
          assert((await snapshot()) === before)
          await outbox.commitPreferenceCommand({
            type: "tag.save",
            tagId,
            input: { name: "Work", color: "#059669", position: 0 },
          })
          const changed = await outbox.commitPreferenceCommand({
            ...tomorrow,
            tagId,
          })
          assert(
            changed.sequence === 9 &&
              (await repository.get("itemViews", parent.id))?.primaryTagId ===
                tagId
          )
          assert(
            (await repository.list("occurrences")).length === 1 &&
              JSON.stringify(await repository.get("items", parent.id)) ===
                JSON.stringify(parent)
          )
        }
      )
      await check(
        "Otra cuenta, vecino fuera del día y backlog no habilitado rechazan",
        async () => {
          const before = await snapshot()
          await rejects(() =>
            outbox.commitPreferenceCommand({
              ...tomorrow,
              beforeId: ids[0],
              tagId,
            })
          )
          await rejects(() =>
            outbox.commitPreferenceCommand({
              ...tomorrow,
              scope: "overdue",
              tagId,
            })
          )
          const other = await LocalRepository.open(otherUserId)
          const otherOutbox = await LocalOutbox.open(otherUserId)
          try {
            const parent = await repository.get("items", ids[2])
            assert(parent)
            await other.put("items", parent)
            await rejects(() => otherOutbox.commitPreferenceCommand(tomorrow))
            assert(
              (await otherOutbox.listEntries()).length === 0 &&
                (await other.list("taskPlacements")).length === 0
            )
          } finally {
            other.close()
            otherOutbox.close()
          }
          assert((await snapshot()) === before)
        }
      )
      const link = document.createElement("a")
      link.href = `/?run=${runId}&phase=reload`
      link.textContent = "Comprobar recarga"
      actionContainer.append(link)
    } else {
      await check(
        "Orden mixto y categoría sobreviven recarga con nueve intenciones",
        async () => {
          const placements = await repository.list("taskPlacements")
          const entries = await outbox.listEntries()
          const occurrences = await repository.list("occurrences")
          assert(
            entries.length === 9 &&
              entries.every((entry, index) => entry.sequence === index + 1)
          )
          assert(
            placements.length === 4 &&
              placements.find((record) => record.occurrenceId === tomorrowId)
                ?.tagId === tagId
          )
          assert(
            (await repository.get("itemViews", ids[2]))?.primaryTagId === tagId
          )
          assert(occurrences.length === 1 && occurrences[0].cancelled)
          const day = placements.filter((record) => record.date === move.date)
          const simple = day.find((record) => record.occurrenceId === ids[1])
          const repeated = day.find(
            (record) => record.occurrenceId === occurrenceId
          )
          assert(simple && repeated && simple.position < repeated.position)
        }
      )
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
    repository.close()
    outbox.close()
    database.close()
  }
}
void run().catch((error: unknown) => {
  status.textContent = "Pruebas fallidas."
  console.error(error)
})
