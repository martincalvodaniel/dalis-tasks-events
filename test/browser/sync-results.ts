import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { OutboxEntry } from "@/types/local-sync"
import type { RemoteOperationResult } from "@/types/remote-sync"
import {
  readStoredItemEvidence,
  versionStoredItemEvidence,
} from "./item-evidence-fixture"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-sync-results`
const senderId = crypto.randomUUID()
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
  if (!value) throw new Error("Sync result browser assertion failed")
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
function applied(
  entry: OutboxEntry,
  revision: number,
  sequence: number
): RemoteOperationResult {
  assert("itemId" in entry.operation.command)
  return {
    operationId: entry.operation.operationId,
    status: "applied",
    sequence,
    item: {
      ...draft,
      id: entry.operation.command.itemId,
      ownerId: userId,
      revision,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      completedAt: null,
    },
  }
}

async function runChecks() {
  const outbox = await LocalOutbox.open(userId)
  const repository = await LocalRepository.open(userId)
  const sync = await LocalSyncStore.open(userId)
  try {
    if (query.get("phase") === "reload") {
      await check(
        "ACK, conflictos y borradores sobreviven la recarga",
        async () => {
          const entries = await outbox.listEntries()
          assert(entries.length === 5)
          assert(
            entries.filter((entry) => entry.state === "acknowledged").length ===
              3
          )
          assert(
            entries.filter((entry) => entry.state === "conflict").length === 1
          )
          assert(
            entries.filter((entry) => entry.state === "rejected").length === 1
          )
          const items = await repository.list("items")
          assert(items.length === 3)
          assert(items.some((item) => item.title === "Local edit"))
        }
      )
    } else {
      const firstId = crypto.randomUUID()
      const first = await outbox.commitItemCommand({
        type: "item.create",
        itemId: firstId,
        input: draft,
      })
      const progress = await outbox.commitItemCommand({
        type: "task.set-status",
        itemId: firstId,
        occurrenceId: null,
        status: "completed",
      })
      const claimed = await outbox.claim(first.operation.operationId, senderId)
      assert(claimed)
      const response = applied(claimed, 1, 1)
      await check(
        "Lease, cuenta y operación se verifican antes de confirmar",
        async () => {
          assert(
            (await outbox.claim(progress.operation.operationId, senderId)) ===
              null
          )
          await rejects(() =>
            sync.applyOperationResult({
              operation: claimed.operation,
              senderId: crypto.randomUUID(),
              result: response,
            })
          )
          await rejects(() =>
            sync.applyOperationResult({
              operation: {
                ...claimed.operation,
                operationId: crypto.randomUUID(),
              },
              senderId,
              result: response,
            })
          )
          assert(response.status === "applied")
          await rejects(() =>
            sync.applyOperationResult({
              operation: claimed.operation,
              senderId,
              result: {
                ...response,
                item: { ...response.item, ownerId: "other" },
              },
            })
          )
          assert(response.status === "applied")
          await rejects(() =>
            sync.applyOperationResult({
              operation: claimed.operation,
              senderId,
              result: { ...response, item: { ...response.item, revision: 2 } },
            })
          )
          assert((await outbox.listEntries())[0].state === "sending")
        }
      )
      await check(
        "ACK conserva edición; getter y replay item2 no reescriben evidencia",
        async () => {
          assert(
            (await sync.applyOperationResult({
              operation: claimed.operation,
              senderId,
              result: response,
            })) === "applied"
          )
          const item = await repository.get("items", firstId)
          assert(
            item?.kind === "task" &&
              item.status === "completed" &&
              item.revision === 1
          )
          const entries = await outbox.listEntries()
          assert(entries[0].state === "acknowledged")
          assert(
            entries[1].state === "pending" &&
              entries[1].operation.baseRevision === 1 &&
              entries[1].attempts === 0
          )
          await versionStoredItemEvidence(
            userId,
            firstId,
            claimed.operation.operationId
          )
          const storedEvidence = JSON.stringify(
            await readStoredItemEvidence(
              userId,
              firstId,
              claimed.operation.operationId
            )
          )
          assert((await outbox.getShadow(firstId))?.record.revision === 1)
          assert(
            (await sync.applyOperationResult({
              operation: claimed.operation,
              senderId,
              result: response,
            })) === "replayed"
          )
          assert(
            JSON.stringify(
              await readStoredItemEvidence(
                userId,
                firstId,
                claimed.operation.operationId
              )
            ) === storedEvidence
          )
          assert(response.status === "applied")
          await rejects(() =>
            sync.applyOperationResult({
              operation: claimed.operation,
              senderId,
              result: { ...response, sequence: 9 },
            })
          )
        }
      )
      await check(
        "La última confirmación adopta remoto sin perder historial",
        async () => {
          const sent = await outbox.claim(
            progress.operation.operationId,
            senderId
          )
          assert(sent && sent.operation.baseRevision === 1)
          const result = applied(sent, 2, 2)
          assert(result.status === "applied" && result.item.kind === "task")
          result.item.status = "completed"
          result.item.completedAt = now
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId,
            result,
          })
          assert(
            JSON.stringify(await repository.get("items", firstId)) ===
              JSON.stringify(result.item)
          )
        }
      )
      await check(
        "El conflicto conserva borrador, base e intención para resolver",
        async () => {
          const edit = await outbox.commitItemCommand({
            type: "item.update",
            itemId: firstId,
            input: { ...draft, title: "Local edit" },
          })
          const sent = await outbox.claim(edit.operation.operationId, senderId)
          assert(sent)
          const result = applied(sent, 3, 3)
          assert(result.status === "applied")
          result.item.title = "Other device edit"
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId,
            result: {
              operationId: edit.operation.operationId,
              status: "conflict",
              current: result.item,
            },
          })
          assert(
            (await repository.get("items", firstId))?.title === "Local edit"
          )
          assert(
            (await outbox.getShadow(firstId))?.record.title ===
              "Other device edit"
          )
          assert((await outbox.listEntries())[2].state === "conflict")
        }
      )
      const second = await outbox.commitItemCommand({
        type: "item.create",
        itemId: crypto.randomUUID(),
        input: draft,
      })
      let secondSend = await outbox.claim(
        second.operation.operationId,
        senderId
      )
      assert(secondSend)
      await check(
        "Sin soporte queda pendiente y mantiene el payload al reintentar",
        async () => {
          assert(secondSend)
          await sync.applyOperationResult({
            operation: secondSend.operation,
            senderId,
            result: {
              operationId: second.operation.operationId,
              status: "unsupported",
            },
          })
          const retry = await outbox.claim(
            second.operation.operationId,
            senderId
          )
          assert(retry && retry.attempts === 2)
          assert(
            JSON.stringify(retry.operation) ===
              JSON.stringify(secondSend.operation)
          )
          assert(
            (await outbox.release(
              retry.operation.operationId,
              crypto.randomUUID()
            )) === false
          )
          assert(
            (await outbox.release(retry.operation.operationId, senderId)) ===
              true
          )
          secondSend = await outbox.claim(retry.operation.operationId, senderId)
          assert(
            secondSend &&
              secondSend.attempts === 3 &&
              JSON.stringify(secondSend.operation) ===
                JSON.stringify(retry.operation)
          )
        }
      )
      await check(
        "Fallo tardío revierte ACK, shadow, vista y metadata juntos",
        async () => {
          assert(secondSend)
          const submission = {
            operation: secondSend.operation,
            senderId,
            result: applied(secondSend, 1, 4),
          }
          const originalPut = IDBObjectStore.prototype.put
          IDBObjectStore.prototype.put = function (
            value: unknown,
            key?: IDBValidKey
          ) {
            if (
              this.transaction.db.name === localDatabaseName(userId) &&
              this.name === "syncMetadata"
            )
              throw new Error("Forced outcome write failure")
            return originalPut.call(this, value, key)
          }
          try {
            await rejects(() => sync.applyOperationResult(submission))
          } finally {
            IDBObjectStore.prototype.put = originalPut
          }
          assert("itemId" in secondSend.operation.command)
          const id = secondSend.operation.command.itemId
          assert((await repository.get("items", id))?.revision === 0)
          assert((await outbox.getShadow(id)) === null)
          assert((await outbox.listEntries())[3].state === "sending")
          await sync.applyOperationResult(submission)
          assert((await repository.get("items", id))?.revision === 1)
        }
      )
      await check(
        "Rechazo no borra datos y ACK no avanza cursor de descarga",
        async () => {
          const third = await outbox.commitItemCommand({
            type: "item.create",
            itemId: crypto.randomUUID(),
            input: draft,
          })
          const sent = await outbox.claim(third.operation.operationId, senderId)
          assert(sent)
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId,
            result: {
              operationId: third.operation.operationId,
              status: "invalid_command",
            },
          })
          assert((await outbox.listEntries())[4].state === "rejected")
          assert("itemId" in third.operation.command)
          assert(
            (await repository.get("items", third.operation.command.itemId))
              ?.revision === 0
          )
          const db = await openLocalDatabase(userId)
          try {
            const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
              const request = db
                .transaction("syncMetadata")
                .objectStore("syncMetadata")
                .getAllKeys()
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            assert(!keys.some((key) => String(key).includes("cursor")))
          } finally {
            db.close()
          }
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
    outbox.close()
    repository.close()
    sync.close()
  }
}
runChecks().catch((error) => {
  statusElement.textContent = `Error: ${error.message}`
  throw error
})
