import { readSyncIncidents } from "@/features/sync/local-incidents"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-sync-incidents`
const now = "2026-10-08T00:00:00.000Z"
const resultsElement = document.getElementById("results")
const statusElement = document.getElementById("status")
const actionsElement = document.getElementById("actions")
if (!resultsElement || !statusElement || !actionsElement)
  throw new Error("Fixture markup is missing")
const results = resultsElement
const status = statusElement
const actions = actionsElement
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Incident browser assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  results.append(row)
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
async function run() {
  assert(location.hostname === "127.0.0.1")
  let control = await readAccountControl()
  assert(control.userId === null || control.userId === userId)
  if (control.userId === null && control.logoutPending)
    control = await completeRemoteLogout(control.epoch)
  const prepared = await activatePreparedAccount(userId, now, control.epoch)
  const account = { userId, epoch: prepared.epoch }
  const outbox = await LocalOutbox.open(userId)
  const sync = await LocalSyncStore.open(userId)
  const database = await openLocalDatabase(userId)
  try {
    if (query.get("phase") !== "reload") {
      const itemId = crypto.randomUUID()
      const draft = taskDraftSchema.parse({
        kind: "task",
        title: "Original draft",
        description: "",
        scheduledDate: "2026-10-08",
        status: "not_started",
        checklist: [],
        recurrence: null,
      })
      const created = await outbox.commitItemCommand({
        type: "item.create",
        itemId,
        input: draft,
      })
      const senderId = crypto.randomUUID()
      const sent = await outbox.claim(created.operation.operationId, senderId)
      assert(sent)
      const deleted = await outbox.commitItemCommand({
        type: "item.delete",
        itemId,
      })
      const remote = {
        ...draft,
        id: itemId,
        ownerId: userId,
        revision: 1,
        title: "Remote version",
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        completedAt: null,
      }
      await sync.applyOperationResult({
        operation: sent.operation,
        senderId,
        result: {
          status: "conflict",
          operationId: sent.operation.operationId,
          current: remote,
        },
      })
      await check(
        "Snapshot conserva borrador borrado, remoto e intención dependiente",
        async () => {
          const before = JSON.stringify(await outbox.listEntries())
          const [incident] = await readSyncIncidents(account)
          assert(incident.local?.deletedAt && incident.remote?.deletedAt)
          assert(
            incident.intentions.length === 2 &&
              incident.intentions[1].operation.operationId ===
                deleted.operation.operationId
          )
          assert(JSON.stringify(await outbox.listEntries()) === before)
        }
      )
      const second = await outbox.commitItemCommand({
        type: "item.create",
        itemId: crypto.randomUUID(),
        input: draft,
      })
      const rejected = await outbox.claim(
        second.operation.operationId,
        senderId
      )
      assert(rejected)
      await sync.applyOperationResult({
        operation: rejected.operation,
        senderId,
        result: {
          status: "unavailable",
          operationId: rejected.operation.operationId,
        },
      })
      await check(
        "Rechazo sin remoto sigue visible junto al conflicto",
        async () => {
          const incidents = await sync.readIncidents()
          assert(
            incidents.length === 2 &&
              incidents[1].reason === "unavailable" &&
              incidents[1].remote === null
          )
        }
      )
      await check(
        "Outcome ausente falla sin devolver un snapshot parcial ni cambiar cola",
        async () => {
          const key = `operation-outcome:${sent.operation.operationId}`
          const saved = await runLocalTransaction<unknown>(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              const store = context.transaction.objectStore("syncMetadata")
              const request = store.get(key)
              request.onsuccess = () => {
                context.setResult(request.result)
                store.delete(key)
              }
            }
          )
          const before = JSON.stringify(await outbox.listEntries())
          try {
            await rejects(() => sync.readIncidents())
          } finally {
            await runLocalTransaction(
              database,
              ["syncMetadata"],
              "readwrite",
              (context) => {
                context.transaction.objectStore("syncMetadata").put(saved)
                context.setResult(undefined)
              }
            )
          }
          assert(JSON.stringify(await outbox.listEntries()) === before)
          assert((await sync.readIncidents()).length === 2)
        }
      )
    } else
      await check(
        "Recarga conserva conflictos, rechazos, tombstones y dependientes",
        async () => {
          const incidents = await readSyncIncidents(account)
          assert(
            incidents.length === 2 &&
              incidents[0].intentions.length === 2 &&
              incidents[0].local?.deletedAt
          )
        }
      )
    await check(
      "Cambio de época durante la lectura impide exponer datos",
      async () => {
        const original = LocalSyncStore.prototype.readIncidents
        LocalSyncStore.prototype.readIncidents = async function () {
          const data = await original.call(this)
          await hideLocalAccount()
          return data
        }
        try {
          await rejects(() => readSyncIncidents(account))
        } finally {
          LocalSyncStore.prototype.readIncidents = original
        }
        await rejects(() => readSyncIncidents(account))
      }
    )
    if (query.get("phase") !== "reload") {
      const link = document.createElement("a")
      link.textContent = "Verificar tras recarga"
      link.href = `/?run=${runId}&phase=reload`
      actions.append(link)
    }
    status.textContent = "Todas las pruebas han pasado."
    const button = document.createElement("button")
    button.textContent = "Limpiar bases de prueba"
    button.onclick = async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(userId))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
      })
      status.textContent = "Base de prueba eliminada."
      button.disabled = true
    }
    actions.append(button)
  } finally {
    database.close()
    outbox.close()
    sync.close()
    const current = await readAccountControl()
    if (current.userId === userId) {
      const hidden = await hideLocalAccount()
      await completeRemoteLogout(hidden.epoch)
    }
  }
}
run().catch((error) => {
  status.textContent = `Error: ${error.message}`
  throw error
})
