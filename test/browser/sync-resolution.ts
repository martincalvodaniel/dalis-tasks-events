import { resolveSyncIncident } from "@/features/sync/local-incidents"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import { syncResolutionRecordSchema } from "@/schemas/sync-resolution"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-sync-resolution`
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
  if (!value) throw new Error("Resolution browser assertion failed")
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
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  results.append(row)
}
function request(
  expected: SyncIncidentSnapshot,
  choice: "adopt_remote" | "retry_local" = "adopt_remote"
) {
  return {
    userId,
    expected,
    choice,
    resolutionId: crypto.randomUUID(),
    operationId: choice === "retry_local" ? crypto.randomUUID() : null,
    createdAt: now,
  }
}

async function run() {
  assert(location.hostname === "127.0.0.1")
  let control = await readAccountControl()
  assert(control.userId === null || control.userId === userId)
  if (control.logoutPending) control = await completeRemoteLogout(control.epoch)
  const prepared = await activatePreparedAccount(userId, now, control.epoch)
  const account = { userId, epoch: prepared.epoch }
  const outbox = await LocalOutbox.open(userId)
  const sync = await LocalSyncStore.open(userId)
  const repository = await LocalRepository.open(userId)
  const database = await openLocalDatabase(userId)
  let notifications = 0
  const unsubscribe = subscribeLocalOutboxChanges(userId, () => {
    notifications++
  })
  const raw = () =>
    runLocalTransaction<string>(
      database,
      ["items", "outbox", "remoteShadows", "syncMetadata"],
      "readonly",
      (context) => {
        const rows = ["items", "outbox", "remoteShadows", "syncMetadata"].map(
          (name) => context.transaction.objectStore(name).getAll()
        )
        let remaining = rows.length
        for (const row of rows)
          row.onsuccess = () => {
            if (--remaining === 0)
              context.setResult(JSON.stringify(rows.map((row) => row.result)))
          }
      }
    )
  async function seed(deletedRemote = false) {
    const itemId = crypto.randomUUID()
    const draft = {
      kind: "task" as const,
      title: "Draft",
      description: "Preserved local text",
      scheduledDate: "2026-10-08",
      status: "not_started" as const,
      checklist: [],
      recurrence: null,
    }
    const entry = await outbox.commitItemCommand({
      type: "item.create",
      itemId,
      input: draft,
    })
    const senderId = crypto.randomUUID()
    const sent = await outbox.claim(entry.operation.operationId, senderId)
    assert(sent)
    await outbox.commitItemCommand({
      type: "task.set-status",
      itemId,
      occurrenceId: null,
      status: "in_progress",
    })
    await sync.applyOperationResult({
      operation: sent.operation,
      senderId,
      result: {
        operationId: sent.operation.operationId,
        status: "conflict",
        current: {
          ...draft,
          title: "Remote",
          id: itemId,
          ownerId: userId,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: deletedRemote ? now : null,
          completedAt: null,
        },
      },
    })
    const incident = (await sync.readIncidents()).find(
      (candidate) =>
        candidate.entry.operation.operationId === entry.operation.operationId
    )
    assert(incident)
    return { incident, itemId }
  }
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Recarga conserva decisiones y entradas supersedidas con sus outcomes",
        async () => {
          const data = JSON.parse(await raw()) as unknown[][]
          const records = data[3].filter(
            (value) =>
              typeof value === "object" &&
              value !== null &&
              "key" in value &&
              String(value.key).startsWith("incident-resolution:")
          )
          assert(records.length >= 3)
          for (const value of records)
            assert(syncResolutionRecordSchema.safeParse(value).success)
          assert(
            (await outbox.listEntries()).some(
              (entry) => entry.state === "superseded"
            )
          )
        }
      )
    } else {
      const first = await seed()
      await check(
        "Elección obsoleta rechaza una edición posterior sin modificar nada",
        async () => {
          const old = request(first.incident)
          await outbox.commitItemCommand({
            type: "task.set-status",
            itemId: first.itemId,
            occurrenceId: null,
            status: "completed",
          })
          const before = await raw()
          await rejects(() => sync.resolveIncident(old))
          assert((await raw()) === before)
        }
      )
      const updated = (await sync.readIncidents())[0]
      const adopt = request(updated)
      await check(
        "Fallo tardío revierte elección, proyección y cola sin notificación",
        async () => {
          const before = await raw()
          const count = notifications
          const original = IDBObjectStore.prototype.add
          IDBObjectStore.prototype.add = function (
            value: unknown,
            key?: IDBValidKey
          ) {
            if (
              this.transaction.db.name === localDatabaseName(userId) &&
              this.name === "syncMetadata"
            )
              throw new Error("Forced resolution evidence failure")
            return original.call(this, value, key)
          }
          try {
            await rejects(() => sync.resolveIncident(adopt))
            await rejects(() =>
              sync.resolveIncident(request(updated, "retry_local"))
            )
          } finally {
            IDBObjectStore.prototype.add = original
          }
          assert((await raw()) === before && notifications === count)
        }
      )
      await check(
        "Adopción preserva payload y outcome, sin ACK y sin bloquear futuras descargas",
        async () => {
          const outcomesBefore = (
            JSON.parse(await raw()) as { key?: string }[][]
          )[3].filter((row) => row.key?.startsWith("operation-outcome:"))
          const result = await resolveSyncIncident(account, adopt)
          const outcomesAfter = (
            JSON.parse(await raw()) as { key?: string }[][]
          )[3].filter((row) => row.key?.startsWith("operation-outcome:"))
          assert(
            JSON.stringify(outcomesBefore) === JSON.stringify(outcomesAfter)
          )
          assert(
            result.status === "applied" && result.record.replacement === null
          )
          const entries = await outbox.listEntries()
          assert(
            entries.length === 3 &&
              entries.every((entry) => entry.state === "superseded")
          )
          for (const original of updated.intentions)
            assert(
              JSON.stringify(
                entries.find(
                  (entry) =>
                    entry.operation.operationId ===
                    original.operation.operationId
                )?.operation
              ) === JSON.stringify(original.operation)
            )
          assert(
            (await outbox.claim(
              updated.entry.operation.operationId,
              crypto.randomUUID()
            )) === null
          )
          assert(
            (await sync.readQueueSummary()).conflicts === 0 &&
              (await sync.readIncidents()).length === 0
          )
          assert(updated.remote)
          await sync.applyChangesPage({
            after: 0,
            page: {
              changes: [
                {
                  sequence: 1,
                  recipientUserId: userId,
                  operationId: crypto.randomUUID(),
                  item: {
                    ...updated.remote,
                    revision: 2,
                    title: "New remote after adoption",
                  },
                },
              ],
              nextAfter: 1,
              through: 1,
              hasMore: false,
            },
          })
          assert(
            (await repository.get("items", first.itemId))?.title ===
              "New remote after adoption"
          )
        }
      )
      await check(
        "Replay no sobrescribe ediciones nuevas y nuevos cambios no dependen de superseded",
        async () => {
          const changed = await outbox.commitItemCommand({
            type: "task.set-status",
            itemId: first.itemId,
            occurrenceId: null,
            status: "in_progress",
          })
          assert(changed.dependencies.length === 0)
          const before = await raw()
          assert((await sync.resolveIncident(adopt)).status === "replayed")
          assert((await raw()) === before)
          await rejects(() =>
            sync.resolveIncident({
              ...adopt,
              createdAt: "2026-10-08T01:00:00.000Z",
            })
          )
          assert((await raw()) === before)
        }
      )
      await check(
        "Reintento usa UUID nuevo y revisión conocida, pudiendo entrar en nuevo conflicto",
        async () => {
          const second = await seed()
          const retry = request(second.incident, "retry_local")
          const result = await sync.resolveIncident(retry)
          assert(result.record.replacement?.baseRevision === 1)
          const sent = await outbox.claim(
            retry.operationId ?? "",
            crypto.randomUUID()
          )
          assert(sent?.lease && sent.dependencies.length === 0)
          assert(second.incident.remote)
          await sync.applyOperationResult({
            operation: sent.operation,
            senderId: sent.lease.ownerId,
            result: {
              operationId: sent.operation.operationId,
              status: "conflict",
              current: {
                ...second.incident.remote,
                revision: 2,
                title: "Concurrent remote edit",
              },
            },
          })
          const next = (await sync.readIncidents()).find(
            (incident) =>
              incident.entry.operation.operationId === retry.operationId
          )
          assert(
            next &&
              next.intentions.length === 1 &&
              next.local?.kind === "task" &&
              next.local.status === "in_progress"
          )
          await sync.resolveIncident(request(next))
        }
      )
      await check(
        "Dependientes externos conservan cola y no se descartan ni confirman",
        async () => {
          const third = await seed()
          await outbox.commitPreferenceCommand({
            type: "item-view.set",
            itemId: third.itemId,
            primaryTagId: null,
          })
          const before = await raw()
          await rejects(() => sync.resolveIncident(request(third.incident)))
          assert((await raw()) === before)
        }
      )
      await check(
        "Tombstone remoto no se resucita y puede adoptarse explícitamente",
        async () => {
          const fourth = await seed(true)
          const before = await raw()
          await rejects(() =>
            sync.resolveIncident(request(fourth.incident, "retry_local"))
          )
          assert((await raw()) === before)
          await sync.resolveIncident(request(fourth.incident))
          assert(
            (await repository.get("items", fourth.itemId))?.deletedAt === now
          )
        }
      )
      await check(
        "Copia nueva conserva tombstone, rechaza colisiones y revierte ambos elementos al fallar",
        async () => {
          const source = await seed(true)
          const copy = {
            ...request(source.incident, "retry_local"),
            choice: "copy_local",
            copyItemId: crypto.randomUUID(),
          }
          const before = await raw()
          await rejects(() =>
            sync.resolveIncident({ ...copy, copyItemId: first.itemId })
          )
          assert((await raw()) === before)
          const originalAdd = IDBObjectStore.prototype.add
          IDBObjectStore.prototype.add = function (
            value: unknown,
            key?: IDBValidKey
          ) {
            if (
              this.transaction.db.name === localDatabaseName(userId) &&
              this.name === "syncMetadata"
            )
              throw new Error("Forced copy evidence failure")
            return originalAdd.call(this, value, key)
          }
          try {
            await rejects(() => sync.resolveIncident(copy))
          } finally {
            IDBObjectStore.prototype.add = originalAdd
          }
          assert(
            (await raw()) === before &&
              (await repository.get("items", copy.copyItemId)) === null
          )
          const result = await sync.resolveIncident(copy)
          assert(
            result.record.copy?.id === copy.copyItemId &&
              result.record.local.deletedAt === now
          )
          assert(
            (await repository.get("items", source.itemId))?.deletedAt === now
          )
          const fresh = await repository.get("items", copy.copyItemId)
          assert(
            fresh?.kind === "task" &&
              fresh.status === "in_progress" &&
              fresh.revision === 0 &&
              fresh.deletedAt === null
          )
          const entry = (await outbox.listEntries()).find(
            (entry) => entry.operation.operationId === copy.operationId
          )
          assert(
            entry?.entityKey === `item:${copy.copyItemId}` &&
              entry.state === "pending" &&
              entry.dependencies.length === 0
          )
          await outbox.commitItemCommand({
            type: "task.set-status",
            itemId: copy.copyItemId,
            occurrenceId: null,
            status: "completed",
          })
          const edited = await raw()
          assert((await sync.resolveIncident(copy)).status === "replayed")
          assert((await raw()) === edited)
        }
      )
      await check(
        "Cuenta cambiada impide una nueva elección sin escrituras",
        async () => {
          const incident = (await sync.readIncidents())[0]
          assert(incident)
          const hidden = await hideLocalAccount()
          await completeRemoteLogout(hidden.epoch)
          const before = await raw()
          await rejects(() => resolveSyncIncident(account, request(incident)))
          assert((await raw()) === before)
        }
      )
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
    unsubscribe()
    database.close()
    repository.close()
    outbox.close()
    sync.close()
    const active = await readAccountControl()
    if (active.userId === userId) {
      const hidden = await hideLocalAccount()
      await completeRemoteLogout(hidden.epoch)
    }
  }
}
run().catch((error) => {
  status.textContent = `Error: ${error.message}`
  throw error
})
