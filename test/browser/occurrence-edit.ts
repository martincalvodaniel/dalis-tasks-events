import { occurrencesPage } from "@/lib/calendar/occurrences"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Occurrence fixtures require an isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-occurrence-edit`
const otherUserId = `browser-test-${runId}-other-occurrence-edit`
const itemId = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const newEntryId = "1bbc261b-a8ca-40b2-a655-8e7c77862396"
const cancelOperationId = "be3a8476-96b5-4b0a-84f8-cb582684578b"
const firstId = `${itemId}:2026-10-07`
const secondId = `${itemId}:2026-10-08`
const thirdId = `${itemId}:2026-10-09`
const input = taskDraftSchema.parse({
  kind: "task",
  title: "Test series",
  description: "Template description",
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
  if (!value) throw new Error("Occurrence editing browser assertion failed")
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
  const competingOutbox = await LocalOutbox.open(userId)
  const repository = await LocalRepository.open(userId)
  const database = await openLocalDatabase(userId)
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
  async function expected(occurrenceId: string) {
    const parent = await repository.get("items", itemId)
    assert(parent?.kind === "task")
    const occurrence =
      (await repository.get("occurrences", occurrenceId)) ??
      occurrencesPage(parent, {
        startDate: occurrenceId.slice(-10),
        endDate: occurrenceId.slice(-10),
        limit: 1,
      }).occurrences[0]
    assert(occurrence)
    return { expectedItem: parent, expectedOccurrence: occurrence }
  }
  const edit = {
    type: "task.update-occurrence" as const,
    itemId,
    occurrenceId: firstId,
    input: {
      title: "Edited occurrence",
      description: "Local description",
      scheduledDate: "2026-11-01",
      checklist: [{ id: entryId, text: "Renamed step" }],
    },
  }
  const cancel = {
    type: "task.cancel-occurrence" as const,
    itemId,
    occurrenceId: firstId,
  }
  let replayOptions:
    | {
        expectedItem: CalendarItem
        expectedOccurrence: ItemOccurrence
        operationId: string
      }
    | undefined
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Edición, cancelaciones y nueve intenciones sobreviven recarga",
        async () => {
          const records = await repository.list("occurrences")
          const entries = await outbox.listEntries()
          assert(records.length === 3 && entries.length === 9)
          const first = records.find((record) => record.id === firstId)
          const second = records.find((record) => record.id === secondId)
          const third = records.find((record) => record.id === thirdId)
          assert(
            first?.kind === "task" &&
              first.cancelled &&
              first.status === "completed" &&
              first.completedAt &&
              first.scheduledDate === "2026-11-02" &&
              first.content?.title === "Reprogrammed occurrence" &&
              first.checklist[0].completed &&
              !first.checklist[1].completed
          )
          assert(
            second?.kind === "task" &&
              second.cancelled &&
              second.scheduledDate === "2026-10-08" &&
              second.content?.title === input.title
          )
          assert(
            third?.kind === "task" &&
              !third.cancelled &&
              third.scheduledDate === "2026-11-01"
          )
          assert((await repository.get("items", itemId))?.deletedAt)
          assert(
            entries.every(
              (entry, index) =>
                entry.sequence === index + 1 &&
                (index === 0 ||
                  entry.dependencies[0] ===
                    entries[index - 1].operation.operationId)
            )
          )
        }
      )
    } else {
      await outbox.commitItemCommand({ type: "item.create", itemId, input })
      const parentSnapshot = JSON.stringify(
        await repository.get("items", itemId)
      )
      await check(
        "Editar primera aparición conserva slot original, padre y otras fechas",
        async () => {
          const options = await expected(firstId)
          const receipt = await outbox.commitOccurrenceCommand(edit, options)
          const record = await repository.get("occurrences", firstId)
          assert(
            receipt.sequence === 2 &&
              receipt.entityKey === `item:${itemId}` &&
              receipt.operation.baseRevision === 0
          )
          assert(
            record?.kind === "task" &&
              record.slotKey === "2026-10-07" &&
              record.scheduledDate === "2026-11-01" &&
              record.content?.description === "Local description" &&
              !record.checklist[0].completed
          )
          assert((await repository.list("occurrences")).length === 1)
          assert(
            JSON.stringify(await repository.get("items", itemId)) ===
              parentSnapshot
          )
          const before = await snapshot()
          await rejects(() =>
            competingOutbox.commitOccurrenceCommand(
              { ...edit, input: { ...edit.input, title: "Stale editor" } },
              options
            )
          )
          assert((await snapshot()) === before)
        }
      )
      await check(
        "Progreso concurrente rechaza editor obsoleto y una edición nueva lo conserva",
        async () => {
          const options = await expected(firstId)
          await competingOutbox.commitItemCommand({
            type: "task.set-checklist-entry",
            itemId,
            occurrenceId: firstId,
            entryId,
            completed: true,
          })
          const before = await snapshot()
          await rejects(() => outbox.commitOccurrenceCommand(edit, options))
          assert((await snapshot()) === before)
          await competingOutbox.commitItemCommand({
            type: "task.set-status",
            itemId,
            occurrenceId: firstId,
            status: "completed",
          })
          const current = await expected(firstId)
          const receipt = await outbox.commitOccurrenceCommand(
            {
              ...edit,
              input: {
                ...edit.input,
                title: "Reprogrammed occurrence",
                scheduledDate: "2026-11-02",
                checklist: [
                  { id: entryId, text: "Renamed twice" },
                  { id: newEntryId, text: "New step" },
                ],
              },
            },
            current
          )
          const record = await repository.get("occurrences", firstId)
          assert(
            receipt.sequence === 5 &&
              record?.kind === "task" &&
              record.completedAt ===
                (current.expectedOccurrence.kind === "task"
                  ? current.expectedOccurrence.completedAt
                  : null) &&
              record.checklist[0].completed &&
              !record.checklist[1].completed
          )
        }
      )
      await check(
        "Cancelar conserva contenido/progreso, replay y cancela un slot virtual",
        async () => {
          replayOptions = {
            ...(await expected(firstId)),
            operationId: cancelOperationId,
          }
          const receipt = await outbox.commitOccurrenceCommand(
            cancel,
            replayOptions
          )
          const before = await snapshot()
          assert(
            (await outbox.commitOccurrenceCommand(cancel, replayOptions))
              .sequence === receipt.sequence
          )
          await rejects(async () =>
            outbox.commitOccurrenceCommand(
              { ...cancel, occurrenceId: secondId },
              { ...(await expected(secondId)), operationId: cancelOperationId }
            )
          )
          await rejects(() =>
            outbox.commitItemCommand({
              type: "task.set-status",
              itemId,
              occurrenceId: firstId,
              status: "not_started",
            })
          )
          assert((await snapshot()) === before)
          const second = await outbox.commitOccurrenceCommand(
            { ...cancel, occurrenceId: secondId },
            await expected(secondId)
          )
          assert(second.sequence === 7)
        }
      )
      await check(
        "Snapshots inválidos y otra cuenta rechazan sin escritura parcial",
        async () => {
          const options = await expected(thirdId)
          const before = await snapshot()
          await rejects(() =>
            outbox.commitOccurrenceCommand(
              { ...edit, occurrenceId: thirdId },
              {
                ...options,
                expectedItem: {
                  ...options.expectedItem,
                  title: "Stale series",
                },
              }
            )
          )
          await rejects(() =>
            outbox.commitOccurrenceCommand(
              { ...edit, occurrenceId: thirdId },
              {
                ...options,
                expectedOccurrence: {
                  ...options.expectedOccurrence,
                  id: firstId,
                  slotKey: "2026-10-07",
                },
              }
            )
          )
          assert((await snapshot()) === before)
          const other = await LocalRepository.open(otherUserId)
          const otherOutbox = await LocalOutbox.open(otherUserId)
          try {
            await other.put("items", options.expectedItem)
            await rejects(() =>
              otherOutbox.commitOccurrenceCommand(
                { ...edit, occurrenceId: thirdId },
                options
              )
            )
            assert(
              (await other.list("occurrences")).length === 0 &&
                (await otherOutbox.listEntries()).length === 0
            )
          } finally {
            other.close()
            otherOutbox.close()
          }
        }
      )
      await check(
        "Fallo de cola revierte primera edición; reintento y replay tras borrar funcionan",
        async () => {
          const options = await expected(thirdId)
          const command = { ...edit, occurrenceId: thirdId }
          await sequence(0)
          const before = await snapshot()
          await rejects(() => outbox.commitOccurrenceCommand(command, options))
          assert(
            (await snapshot()) === before &&
              (await repository.get("occurrences", thirdId)) === null
          )
          await sequence(7)
          assert(
            (await outbox.commitOccurrenceCommand(command, options))
              .sequence === 8
          )
          await outbox.commitItemCommand({ type: "item.delete", itemId })
          const deleted = await snapshot()
          assert(replayOptions)
          assert(
            (await outbox.commitOccurrenceCommand(cancel, replayOptions))
              .sequence === 6
          )
          await rejects(() => outbox.commitOccurrenceCommand(command, options))
          assert((await snapshot()) === deleted)
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
    competingOutbox.close()
    repository.close()
    database.close()
  }
}
void run().catch((error: unknown) => {
  status.textContent = "Pruebas fallidas."
  console.error(error)
})
