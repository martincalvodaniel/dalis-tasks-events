import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { CalendarItem, Task } from "@/types/calendar-item"
import {
  readStoredItemEvidence,
  versionStoredItemEvidence,
} from "./item-evidence-fixture"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-sync-pull`
const draft = taskDraftSchema.parse({
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-08",
  status: "not_started",
  checklist: [],
  recurrence: null,
})
const now = "2026-10-08T00:00:00.000Z"
const resultList = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!resultList || !status || !actions)
  throw new Error("Fixture markup is missing")
const resultsElement = resultList
const statusElement = status
const actionsElement = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Pull browser assertion failed")
}
async function rejects(work: () => Promise<unknown>) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed)
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  resultsElement.append(row)
  await work()
  row.textContent = `Correcto: ${label}`
}
function remote(id: string): Task {
  return {
    ...draft,
    id,
    ownerId: userId,
    revision: 1,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
function change(sequence: number, item: CalendarItem) {
  return {
    sequence,
    item,
    operationId: crypto.randomUUID(),
    recipientUserId: userId,
  }
}

async function runChecks() {
  const sync = await LocalSyncStore.open(userId)
  const repository = await LocalRepository.open(userId)
  const outbox = await LocalOutbox.open(userId)
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Cursor, tombstones y resultados sobreviven la recarga",
        async () => {
          assert((await sync.readPullCursor()).after === 7)
          assert((await sync.readPullCursor()).through === null)
          const items = await repository.list("items", { includeDeleted: true })
          assert(
            items.length === 3 &&
              items.filter((item) => item.deletedAt).length === 1
          )
          assert(
            items.some(
              (item) =>
                item.kind === "task" &&
                item.status === "in_progress" &&
                item.revision === 3
            )
          )
          const entries = await outbox.listEntries()
          assert(
            entries.length === 3 &&
              entries.every((entry) => entry.state === "acknowledged")
          )
        }
      )
    } else {
      const firstId = crypto.randomUUID()
      const secondId = crypto.randomUUID()
      const first = remote(firstId)
      const second = remote(secondId)
      const creation = await outbox.commitItemCommand({
        type: "item.create",
        itemId: firstId,
        input: draft,
      })
      const edit = await outbox.commitItemCommand({
        type: "item.update",
        itemId: firstId,
        input: { ...draft, title: "Local edit" },
      })
      const firstPage = {
        after: 0,
        page: {
          changes: [change(1, first), change(2, second)],
          nextAfter: 2,
          through: 4,
          hasMore: true,
        },
      }
      await check(
        "Bootstrap conserva intenciones y fija checkpoint sin confirmar por UUID",
        async () => {
          firstPage.page.changes[0].operationId = creation.operation.operationId
          await sync.applyChangesPage(firstPage)
          assert(
            (await repository.get("items", firstId))?.title === "Local edit"
          )
          assert(
            (await outbox.getShadow(firstId))?.record.title === first.title
          )
          assert(
            (await outbox.listEntries()).every(
              (entry) =>
                entry.state === "pending" && entry.operation.baseRevision === 0
            )
          )
          assert(
            (await sync.readPullCursor()).after === 2 &&
              (await sync.readPullCursor()).through === 4
          )
          await rejects(() =>
            sync.applyChangesPage({
              after: 2,
              page: {
                changes: [change(3, { ...second, revision: 2 })],
                nextAfter: 3,
                through: 5,
                hasMore: true,
              },
            })
          )
          assert((await sync.readPullCursor()).after === 2)
        }
      )
      await versionStoredItemEvidence(userId, firstId)
      await versionStoredItemEvidence(userId, secondId)
      const storedEvidence = JSON.stringify(
        await readStoredItemEvidence(userId, firstId)
      )
      assert(
        (await outbox.getShadow(firstId))?.record.revision === first.revision
      )
      assert(
        JSON.stringify(await readStoredItemEvidence(userId, firstId)) ===
          storedEvidence
      )
      const tombstone = { ...second, revision: 3, deletedAt: now }
      await check(
        "Pull admite shadow item2, pliega borrados y nunca regresa por páginas viejas",
        async () => {
          await sync.applyChangesPage({
            after: 2,
            page: {
              changes: [
                change(3, {
                  ...second,
                  revision: 2,
                  status: "completed",
                  completedAt: now,
                }),
                change(4, tombstone),
              ],
              nextAfter: 4,
              through: 4,
              hasMore: false,
            },
          })
          assert((await repository.get("items", secondId))?.deletedAt === now)
          assert(
            (await sync.readPullCursor()).after === 4 &&
              (await sync.readPullCursor()).through === null
          )
          assert((await sync.applyChangesPage(firstPage)) === "ignored")
          assert((await outbox.getShadow(secondId))?.record.revision === 3)
        }
      )
      const senderId = crypto.randomUUID()
      const edited = { ...first, revision: 2, title: "Local edit" }
      const progressed = {
        ...edited,
        revision: 3,
        status: "in_progress" as const,
      }
      await check(
        "ACK adelantado no regresa al descargar historia anterior",
        async () => {
          let sent = await outbox.claim(
            creation.operation.operationId,
            senderId
          )
          assert(sent)
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId,
            result: {
              operationId: creation.operation.operationId,
              status: "applied",
              item: first,
              sequence: 1,
            },
          })
          sent = await outbox.claim(edit.operation.operationId, senderId)
          assert(sent && sent.operation.baseRevision === 1)
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId,
            result: {
              operationId: edit.operation.operationId,
              status: "applied",
              item: edited,
              sequence: 5,
            },
          })
          const progress = await outbox.commitItemCommand({
            type: "task.set-status",
            itemId: firstId,
            occurrenceId: null,
            status: "in_progress",
          })
          sent = await outbox.claim(progress.operation.operationId, senderId)
          assert(sent && sent.operation.baseRevision === 2)
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId,
            result: {
              operationId: progress.operation.operationId,
              status: "applied",
              item: progressed,
              sequence: 6,
            },
          })
          assert((await sync.readPullCursor()).after === 4)
          await sync.applyChangesPage({
            after: 4,
            page: {
              changes: [change(5, edited)],
              nextAfter: 5,
              through: 6,
              hasMore: true,
            },
          })
          assert((await repository.get("items", firstId))?.revision === 3)
          await sync.applyChangesPage({
            after: 5,
            page: {
              changes: [change(6, progressed)],
              nextAfter: 6,
              through: 6,
              hasMore: false,
            },
          })
          assert((await sync.readPullCursor()).after === 6)
        }
      )
      const third = remote(crypto.randomUUID())
      const lastPage = {
        after: 6,
        page: {
          changes: [change(7, third)],
          nextAfter: 7,
          through: 7,
          hasMore: false,
        },
      }
      await check(
        "Fallo tardío de cursor revierte toda la página",
        async () => {
          const originalPut = IDBObjectStore.prototype.put
          IDBObjectStore.prototype.put = function (
            value: unknown,
            key?: IDBValidKey
          ) {
            if (
              this.transaction.db.name === localDatabaseName(userId) &&
              this.name === "syncMetadata"
            )
              throw new Error("Forced cursor write failure")
            return originalPut.call(this, value, key)
          }
          try {
            await rejects(() => sync.applyChangesPage(lastPage))
          } finally {
            IDBObjectStore.prototype.put = originalPut
          }
          assert((await sync.readPullCursor()).after === 6)
          assert((await repository.get("items", third.id)) === null)
          assert((await outbox.getShadow(third.id)) === null)
        }
      )
      await check(
        "Dos respuestas del mismo cursor no duplican ni saltan datos",
        async () => {
          const results = await Promise.all([
            sync.applyChangesPage(lastPage),
            sync.applyChangesPage(lastPage),
          ])
          assert(results.includes("applied") && results.includes("ignored"))
          assert((await sync.readPullCursor()).after === 7)
          assert(
            (await repository.list("items", { includeDeleted: true }))
              .length === 3
          )
        }
      )
      await check(
        "Datos ajenos, huecos, futuro y revisiones incoherentes no avanzan cursor",
        async () => {
          const fourth = remote(crypto.randomUUID())
          for (const input of [
            {
              after: 7,
              page: {
                changes: [{ ...change(8, fourth), recipientUserId: "other" }],
                nextAfter: 8,
                through: 8,
                hasMore: false,
              },
            },
            {
              after: 7,
              page: {
                changes: [change(9, fourth)],
                nextAfter: 9,
                through: 9,
                hasMore: false,
              },
            },
            {
              after: 8,
              page: {
                changes: [change(9, fourth)],
                nextAfter: 9,
                through: 9,
                hasMore: false,
              },
            },
            {
              after: 7,
              page: { changes: [], nextAfter: 7, through: 8, hasMore: true },
            },
            {
              after: 7,
              page: {
                changes: [
                  change(8, { ...fourth, revision: 2 }),
                  change(9, fourth),
                ],
                nextAfter: 9,
                through: 9,
                hasMore: false,
              },
            },
          ])
            await rejects(() => sync.applyChangesPage(input))
          assert((await sync.readPullCursor()).after === 7)
          assert((await repository.get("items", fourth.id)) === null)
        }
      )
      const link = document.createElement("a")
      link.textContent = "Verificar tras recarga"
      link.href = `/?run=${runId}&phase=reload`
      actionsElement.append(link)
    }
    statusElement.textContent = "Todas las pruebas han pasado."
    const button = document.createElement("button")
    button.textContent = "Limpiar bases de prueba"
    button.onclick = async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(userId))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
      })
      statusElement.textContent = "Base de prueba eliminada."
      button.disabled = true
    }
    actionsElement.append(button)
  } finally {
    sync.close()
    repository.close()
    outbox.close()
  }
}
runChecks().catch((error) => {
  statusElement.textContent = `Error: ${error.message}`
  throw error
})
