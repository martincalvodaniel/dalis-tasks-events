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
import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"

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
          const [overview] = await readSyncIncidents(account)
          assert(overview.kind === "item")
          const incident = overview.incident
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
      await check(
        "Evidencia mixta conserva conflicto personal y adapta item 2 sin ocultar dependencias",
        async () => {
          const entries = await outbox.listEntries()
          const tagId = crypto.randomUUID()
          const sequence =
            Math.max(...entries.map((entry) => entry.sequence)) + 1
          const personal: OutboxEntry = {
            userId,
            entityKey: `tag:${tagId}`,
            sequence,
            operation: {
              protocolVersion: 1,
              operationId: crypto.randomUUID(),
              baseRevision: 1,
              command: {
                type: "tag.save",
                tagId,
                input: {
                  name: "Local category",
                  color: "#123456",
                  position: 4096,
                },
              },
            },
            dependencies: [sent.operation.operationId],
            state: "conflict",
            attempts: 1,
            createdAt: now,
            lease: null,
          }
          const tag = {
            id: tagId,
            userId,
            name: "Local category",
            normalizedName: "local category",
            color: "#123456",
            position: 4096,
            revision: 0,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          }
          const current = {
            ...tag,
            name: "Remote category",
            normalizedName: "remote category",
            position: 1024,
            revision: 2,
          }
          const known = { ...current, revision: 3, deletedAt: now }
          const outcome: LocalPreferenceOutcomeV2 = {
            version: 2,
            kind: "preference",
            key: `operation-outcome:${personal.operation.operationId}`,
            operation: personal.operation,
            result: {
              kind: "preference",
              outcome: {
                status: "conflict",
                operationId: personal.operation.operationId,
                current: { store: "tags", record: current },
              },
            },
            local: [
              {
                entityKey: personal.entityKey,
                record: { store: "tags", record: tag },
              },
            ],
            base: [
              {
                entityKey: personal.entityKey,
                record: { store: "tags", record: known },
              },
            ],
          }
          await runLocalTransaction(
            database,
            ["tags", "outbox", "remoteShadows", "syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction.objectStore("tags").put(tag)
              context.transaction.objectStore("outbox").put(personal)
              const shadows = context.transaction.objectStore("remoteShadows")
              shadows.put({
                version: 2,
                kind: "preference",
                entityKey: personal.entityKey,
                record: { store: "tags", record: known },
              })
              const shadowRequest = shadows.get(created.entityKey)
              shadowRequest.onsuccess = () => {
                try {
                  shadows.put(decodeRemoteShadow(shadowRequest.result, userId))
                } catch (error) {
                  context.fail(error)
                }
              }
              const metadata = context.transaction.objectStore("syncMetadata")
              metadata.put(outcome)
              metadata.put({ key: "outbox-sequence", value: sequence })
              metadata.put({
                key: "preference-tail",
                operationId: personal.operation.operationId,
              })
              const oldOutcome = metadata.get(
                `operation-outcome:${sent.operation.operationId}`
              )
              oldOutcome.onsuccess = () => {
                try {
                  metadata.put(
                    decodeLocalOperationOutcome(oldOutcome.result, userId)
                  )
                } catch (error) {
                  context.fail(error)
                }
              }
              context.setResult(undefined)
            }
          )
          const before = JSON.stringify(await outbox.listEntries())
          const overview = await readSyncIncidents(account)
          assert(overview.length === 3)
          assert(
            overview[0].kind === "item" &&
              overview[0].incident.blockedByRelatedIntentions
          )
          assert(overview[2].kind === "preference")
          assert(
            overview[2].incident.local[0].record?.record.revision === 0 &&
              overview[2].incident.remote[0].record?.record.revision === 3 &&
              overview[2].incident.remote[0].record?.record.deletedAt === now
          )
          assert((await sync.readIncidents()).length === 2)
          assert(JSON.stringify(await outbox.listEntries()) === before)
          const corrupted = { ...outcome, version: 3 }
          await runLocalTransaction(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction.objectStore("syncMetadata").put(corrupted)
              context.setResult(undefined)
            }
          )
          try {
            await rejects(() => sync.readIncidentOverview())
            await rejects(() => sync.readIncidents())
          } finally {
            await runLocalTransaction(
              database,
              ["syncMetadata"],
              "readwrite",
              (context) => {
                context.transaction.objectStore("syncMetadata").put(outcome)
                context.setResult(undefined)
              }
            )
          }
          assert(JSON.stringify(await outbox.listEntries()) === before)
        }
      )
    } else
      await check(
        "Recarga conserva conflictos, rechazos, tombstones y dependientes",
        async () => {
          const incidents = await readSyncIncidents(account)
          assert(
            incidents.length === 3 &&
              incidents[0].kind === "item" &&
              incidents[0].incident.intentions.length === 2 &&
              incidents[0].incident.local?.deletedAt &&
              incidents[2].kind === "preference" &&
              incidents[2].incident.remote[0].record?.record.deletedAt === now
          )
        }
      )
    await check(
      "Cambio de época durante la lectura impide exponer datos",
      async () => {
        const original = LocalSyncStore.prototype.readIncidentOverview
        LocalSyncStore.prototype.readIncidentOverview = async function () {
          const data = await original.call(this)
          await hideLocalAccount()
          return data
        }
        try {
          await rejects(() => readSyncIncidents(account))
        } finally {
          LocalSyncStore.prototype.readIncidentOverview = original
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
