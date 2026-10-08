import { readAccountBackup } from "@/features/workspace/local-backup"
import { decodeLocalBackup, encodeLocalBackup } from "@/lib/backup/local-backup"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { LocalBackupReader, readLocalBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-backup`
const now = "2026-10-08T00:00:00.000Z"
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions) throw new Error("Fixture markup missing")
const rows = results
const statusElement = status
const buttons = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Backup fixture assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  rows.append(row)
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
async function run() {
  assert(location.hostname === "127.0.0.1")
  let control = await readAccountControl()
  assert(control.userId === null || control.userId === userId)
  if (control.logoutPending) control = await completeRemoteLogout(control.epoch)
  const prepared = await activatePreparedAccount(userId, now, control.epoch)
  let account = { userId, epoch: prepared.epoch }
  const outbox = await LocalOutbox.open(userId)
  const database = await openLocalDatabase(userId)
  const baselineKey = `browser-test:${runId}:backup-baseline`
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Recarga conserva snapshot completo, pendientes y tombstones",
        async () => {
          const backup = await readAccountBackup(account)
          assert(
            JSON.stringify(backup.stores) === localStorage.getItem(baselineKey)
          )
          assert(
            decodeLocalBackup(encodeLocalBackup(backup, userId), userId).stores
              .outbox.length === backup.stores.outbox.length
          )
        }
      )
    } else {
      const id = crypto.randomUUID()
      const removedId = crypto.randomUUID()
      const draft = {
        kind: "task" as const,
        title: "Backup sin red",
        description: "",
        scheduledDate: "2026-10-08",
        status: "in_progress" as const,
        checklist: [],
        recurrence: null,
      }
      await outbox.commitItemCommand({
        type: "item.create",
        itemId: id,
        input: draft,
      })
      await outbox.commitItemCommand({
        type: "item.create",
        itemId: removedId,
        input: draft,
      })
      await outbox.commitItemCommand({ type: "item.delete", itemId: removedId })
      await outbox.commitPreferenceCommand({
        type: "tag.save",
        tagId: crypto.randomUUID(),
        input: { name: "Personal", color: "#00aa99", position: 0 },
      })
      await check(
        "Los once stores, tombstones y preferencias se exportan sin cambiar la cola",
        async () => {
          const before = JSON.stringify(await outbox.listEntries())
          const backup = await readAccountBackup(account)
          assert(Object.keys(backup.stores).length === 11)
          assert(
            backup.stores.items.length === 2 &&
              backup.stores.items.some((item) => item.deletedAt)
          )
          assert(
            backup.stores.tags.length === 1 && backup.stores.outbox.length === 4
          )
          assert(JSON.stringify(await outbox.listEntries()) === before)
          assert(
            JSON.stringify(
              decodeLocalBackup(encodeLocalBackup(backup, userId), userId)
            ) === JSON.stringify(backup)
          )
        }
      )
      await check(
        "Lectura coherente anterior a una escritura posterior",
        async () => {
          const reading = readLocalBackup(database, userId, now)
          const writing = outbox.commitItemCommand({
            type: "task.set-status",
            itemId: id,
            occurrenceId: null,
            status: "completed",
          })
          const snapshot = await reading
          await writing
          const old = snapshot.stores.items.find((item) => item.id === id)
          assert(
            old?.kind === "task" &&
              old.status === "in_progress" &&
              snapshot.stores.outbox.length === 4
          )
          const after = await readAccountBackup(account)
          const current = after.stores.items.find((item) => item.id === id)
          assert(
            current?.kind === "task" &&
              current.status === "completed" &&
              after.stores.outbox.length === 5
          )
        }
      )
      await check(
        "Metadata desconocida produce error íntegro sin modificar datos",
        async () => {
          const before = JSON.stringify(await outbox.listEntries())
          await runLocalTransaction(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("syncMetadata")
                .add({ key: "fixture-unsupported", value: true })
              context.setResult(true)
            }
          )
          await refused(() => readAccountBackup(account))
          assert(JSON.stringify(await outbox.listEntries()) === before)
          await runLocalTransaction(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("syncMetadata")
                .delete("fixture-unsupported")
              context.setResult(true)
            }
          )
        }
      )
      await check(
        "Historia mixta se exporta íntegra sin reescribir snapshots ni fabricar ACK",
        async () => {
          const before = await readAccountBackup(account)
          assert(before.version === 2)
          const tag = before.stores.tags[0]
          const entry = before.stores.outbox.find(
            (record) => record.operation.command.type === "tag.save"
          )
          const item = before.stores.items.find((record) => record.id === id)
          assert(tag && entry && item)
          const local = { store: "tags" as const, record: tag }
          const base = {
            store: "tags" as const,
            record: { ...tag, revision: 5 },
          }
          const outcome = {
            version: 2,
            kind: "preference",
            key: `operation-outcome:${entry.operation.operationId}`,
            operation: entry.operation,
            result: {
              kind: "preference",
              outcome: {
                operationId: entry.operation.operationId,
                status: "conflict",
                current: { store: "tags", record: { ...tag, revision: 2 } },
              },
            },
            local: [{ entityKey: entry.entityKey, record: local }],
            base: [{ entityKey: entry.entityKey, record: base }],
          }
          const shadows = [
            {
              version: 2,
              kind: "preference",
              entityKey: entry.entityKey,
              record: base,
            },
            {
              version: 2,
              kind: "item",
              entityKey: `item:${id}`,
              record: { ...item, revision: 4 },
            },
          ]
          await runLocalTransaction(
            database,
            ["outbox", "remoteShadows", "syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("outbox")
                .put({ ...entry, state: "conflict", attempts: 1, lease: null })
              for (const shadow of shadows)
                context.transaction.objectStore("remoteShadows").put(shadow)
              context.transaction.objectStore("syncMetadata").put(outcome)
              context.setResult(true)
            }
          )
          const mixed = await readAccountBackup(account)
          assert(
            mixed.version === 2 &&
              mixed.protocolVersion === 1 &&
              mixed.databaseVersion === 2
          )
          assert(
            JSON.stringify(mixed.stores.tags) ===
              JSON.stringify(before.stores.tags)
          )
          assert(
            JSON.stringify(mixed.stores.items) ===
              JSON.stringify(before.stores.items)
          )
          assert(mixed.stores.remoteShadows.length === 2)
          assert(
            mixed.stores.outbox.find(
              (record) =>
                record.operation.operationId === entry.operation.operationId
            )?.state === "conflict"
          )
          assert(
            JSON.stringify(
              mixed.stores.syncMetadata.find(
                (record) => record.key === outcome.key
              )
            ) === JSON.stringify(outcome)
          )
          assert(
            JSON.stringify(
              decodeLocalBackup(encodeLocalBackup(mixed, userId), userId)
            ) === JSON.stringify(mixed)
          )
          assert(
            JSON.stringify((await readAccountBackup(account)).stores) ===
              JSON.stringify(mixed.stores)
          )
          // Only this disposable fixture partition contains synthetic server evidence.
        }
      )
      await check(
        "Partición y época incorrectas rechazan sin entregar datos",
        async () => {
          await refused(() => readLocalBackup(database, "other", now))
          await refused(() =>
            readAccountBackup({ ...account, epoch: crypto.randomUUID() })
          )
          const read = LocalBackupReader.prototype.read
          const close = LocalBackupReader.prototype.close
          let closes = 0
          LocalBackupReader.prototype.read = async function () {
            const snapshot = await read.call(this)
            const current = await readAccountControl()
            const next = await activatePreparedAccount(
              userId,
              now,
              current.epoch
            )
            account = { userId, epoch: next.epoch }
            return snapshot
          }
          LocalBackupReader.prototype.close = function () {
            closes++
            close.call(this)
          }
          try {
            await refused(() => readAccountBackup({ ...account }))
            assert(closes === 1)
          } finally {
            LocalBackupReader.prototype.read = read
            LocalBackupReader.prototype.close = close
          }
        }
      )
      const last = await readAccountBackup(account)
      localStorage.setItem(baselineKey, JSON.stringify(last.stores))
      const link = document.createElement("a")
      link.textContent = "Verificar tras recarga"
      link.href = `/?run=${runId}&phase=reload`
      buttons.append(link)
    }
    statusElement.textContent = "Snapshot de backup verificado."
    const cleanup = document.createElement("button")
    cleanup.textContent = "Limpiar bases de prueba"
    cleanup.onclick = async () => {
      localStorage.removeItem(baselineKey)
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(userId))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
      })
      statusElement.textContent = "Base de prueba eliminada."
      cleanup.disabled = true
    }
    buttons.append(cleanup)
  } finally {
    database.close()
    outbox.close()
    const current = await readAccountControl()
    if (current.userId === userId)
      await completeRemoteLogout((await hideLocalAccount()).epoch)
  }
}
run().catch((error) => {
  statusElement.textContent = `Error: ${error.message}`
  throw error
})
