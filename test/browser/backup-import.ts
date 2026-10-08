import { applyItemCommand } from "@/lib/calendar/item-command"
import { readLocalBackup } from "@/lib/local-db/backup"
import { importLocalBackupCopies } from "@/lib/local-db/backup-import"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { entityIdSchema } from "@/schemas/primitives"
import type { BackupImportRequest } from "@/types/backup-import"
import type { LocalBackup } from "@/types/local-backup"

const query = new URLSearchParams(location.search)
if (location.hostname !== "127.0.0.1" || location.port !== "4188")
  throw new Error("Import fixture requires its isolated loopback origin")
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-backup-import`
const otherUserId = `${userId}-other`
const now = "2026-10-08T00:00:00.000Z"
const originalDate = "2026-10-07T00:00:00.000Z"
const storageKey = `browser-test:${runId}:backup-import`
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions) throw new Error("Fixture markup missing")
const resultList = results
const statusElement = status
const buttons = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Import fixture assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  resultList.append(row)
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
function request(
  source: LocalBackup,
  expected: LocalBackup
): BackupImportRequest {
  return {
    importId: crypto.randomUUID(),
    userId,
    createdAt: now,
    expected,
    copies: source.stores.items.map((item) => ({
      sourceItemId: item.id,
      itemId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
    })),
  }
}
async function cleanup() {
  localStorage.removeItem(storageKey)
  for (const actor of [userId, otherUserId])
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(localDatabaseName(actor))
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Import fixture cleanup blocked"))
    })
  statusElement.textContent = "Recursos propios limpiados."
}
async function run() {
  if (query.get("phase") === "cleanup") {
    await cleanup()
    return
  }
  const database = await openLocalDatabase(userId)
  const outbox = await LocalOutbox.open(userId)
  const read = () => readLocalBackup(database, userId, now)
  try {
    if (query.get("phase") === "reload") {
      const persisted = JSON.parse(localStorage.getItem(storageKey) ?? "null")
      assert(persisted?.request?.userId === userId)
      await check(
        "Recarga conserva copias, cola y recibo; replay no escribe",
        async () => {
          const before = JSON.stringify((await read()).stores)
          assert(before === persisted.stores)
          assert(
            (
              await importLocalBackupCopies(
                database,
                userId,
                persisted.request,
                persisted.sourceJson
              )
            ).status === "replayed"
          )
          assert(JSON.stringify((await read()).stores) === before)
        }
      )
    } else {
      const originalId = crypto.randomUUID()
      await outbox.commitItemCommand(
        {
          type: "item.create",
          itemId: originalId,
          input: {
            kind: "task",
            title: "Original pendiente",
            description: "",
            status: "in_progress",
            scheduledDate: "2026-10-07",
            recurrence: null,
            checklist: [
              {
                id: crypto.randomUUID(),
                text: "Paso pendiente",
                completed: false,
              },
            ],
          },
        },
        { now: new Date(originalDate) }
      )
      const expected = await read()
      const source = structuredClone(expected)
      source.stores.items.push({
        ...applyItemCommand(
          null,
          {
            type: "item.create",
            itemId: crypto.randomUUID(),
            input: {
              kind: "event",
              title: "Evento archivado",
              description: "",
              recurrence: null,
              schedule: {
                mode: "all_day",
                startDate: "2026-10-08",
                endDateExclusive: "2026-10-09",
              },
            },
          },
          userId,
          originalDate
        ),
        revision: 7,
      })
      source.stores.tags.push({
        id: crypto.randomUUID(),
        userId,
        name: "Personal",
        normalizedName: "personal",
        color: "#00aa99",
        position: 0,
        revision: 4,
        createdAt: originalDate,
        updatedAt: originalDate,
        deletedAt: null,
      })
      const sourceJson = JSON.stringify(source)
      const input = request(source, expected)
      let notifications = 0
      const notified = () => {
        notifications++
      }
      window.addEventListener("dalis:outbox-changed", notified)
      try {
        await check(
          "Multicopia atómica conserva original, pendientes y preferencias",
          async () => {
            assert(
              (
                await importLocalBackupCopies(
                  database,
                  userId,
                  input,
                  sourceJson
                )
              ).status === "applied"
            )
            const actual = await read()
            assert(
              actual.stores.items.length === 3 &&
                actual.stores.outbox.length === 3
            )
            assert(
              actual.stores.tags.length === 0 &&
                actual.stores.itemViews.length === 0
            )
            assert(
              JSON.stringify(
                actual.stores.items.find((item) => item.id === originalId)
              ) === JSON.stringify(expected.stores.items[0])
            )
            assert(
              JSON.stringify(
                actual.stores.outbox.find(
                  (entry) =>
                    entry.operation.operationId ===
                    expected.stores.outbox[0].operation.operationId
                )
              ) === JSON.stringify(expected.stores.outbox[0])
            )
            assert(
              actual.stores.outbox.every(
                (entry) => entry.state === "pending" && entry.lease === null
              )
            )
            assert(
              actual.stores.outbox
                .map((entry) => entry.sequence)
                .sort((a, b) => a - b)
                .join(",") === "1,2,3"
            )
            const receipt = actual.stores.syncMetadata.find(
              (record) => "importId" in record
            )
            assert(
              receipt &&
                "importId" in receipt &&
                receipt.sourceJson === sourceJson
            )
            assert(notifications === 1)
          }
        )
        await outbox.commitItemCommand(
          {
            type: "task.set-status",
            itemId: input.copies[0].itemId,
            occurrenceId: null,
            status: "completed",
          },
          { now: new Date(now) }
        )
        await check(
          "Replay no duplica ni sobrescribe progreso posterior",
          async () => {
            const before = JSON.stringify((await read()).stores)
            const priorNotifications = notifications
            assert(
              (
                await importLocalBackupCopies(
                  database,
                  userId,
                  input,
                  sourceJson
                )
              ).status === "replayed"
            )
            assert(
              JSON.stringify((await read()).stores) === before &&
                notifications === priorNotifications
            )
          }
        )
        await check(
          "ID reutilizado, snapshot obsoleto y colisión rechazan sin escribir",
          async () => {
            const before = JSON.stringify((await read()).stores)
            await refused(async () =>
              importLocalBackupCopies(database, userId, input, `${sourceJson} `)
            )
            await refused(async () =>
              importLocalBackupCopies(
                database,
                userId,
                request(source, expected),
                sourceJson
              )
            )
            const collision = request(source, await read())
            collision.copies[0].itemId = input.copies[0].itemId
            await refused(async () =>
              importLocalBackupCopies(database, userId, collision, sourceJson)
            )
            assert(JSON.stringify((await read()).stores) === before)
          }
        )
        await check("Cuenta y partición ajenas quedan intactas", async () => {
          const other = await openLocalDatabase(otherUserId)
          try {
            const before = JSON.stringify(
              (await readLocalBackup(other, otherUserId, now)).stores
            )
            await refused(async () =>
              importLocalBackupCopies(other, userId, input, sourceJson)
            )
            await refused(async () =>
              importLocalBackupCopies(database, otherUserId, input, sourceJson)
            )
            assert(
              JSON.stringify(
                (await readLocalBackup(other, otherUserId, now)).stores
              ) === before
            )
          } finally {
            other.close()
          }
        })
        await check(
          "Fallo tardío revierte items, cola, contador y recibo",
          async () => {
            const baseline = await read()
            const failedInput = request(source, baseline)
            const priorNotifications = notifications
            const nativeAdd = IDBObjectStore.prototype.add
            IDBObjectStore.prototype.add = function (value, key) {
              if (
                this.name === "syncMetadata" &&
                value?.key === `backup-import:${failedInput.importId}`
              )
                return nativeAdd.call(this, {
                  key: "outbox-sequence",
                  value: 0,
                })
              return nativeAdd.call(this, value, key)
            }
            try {
              await refused(async () =>
                importLocalBackupCopies(
                  database,
                  userId,
                  failedInput,
                  sourceJson
                )
              )
            } finally {
              IDBObjectStore.prototype.add = nativeAdd
            }
            assert(
              JSON.stringify((await read()).stores) ===
                JSON.stringify(baseline.stores)
            )
            assert(notifications === priorNotifications)
          }
        )
        await check(
          "Dos ejecuciones concurrentes crean una sola copia",
          async () => {
            const concurrent = request(source, await read())
            concurrent.copies.length = 1
            const before = await read()
            const result = await Promise.all([
              importLocalBackupCopies(database, userId, concurrent, sourceJson),
              importLocalBackupCopies(database, userId, concurrent, sourceJson),
            ])
            assert(
              result
                .map((row) => row.status)
                .sort()
                .join(",") === "applied,replayed"
            )
            const after = await read()
            assert(after.stores.items.length === before.stores.items.length + 1)
            assert(
              after.stores.outbox.length === before.stores.outbox.length + 1
            )
          }
        )
      } finally {
        window.removeEventListener("dalis:outbox-changed", notified)
      }
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          request: input,
          sourceJson,
          stores: JSON.stringify((await read()).stores),
        })
      )
    }
  } finally {
    database.close()
    outbox.close()
  }
  const next = document.createElement("a")
  next.href = `/?run=${runId}&phase=${query.get("phase") === "reload" ? "cleanup" : "reload"}`
  next.textContent =
    query.get("phase") === "reload"
      ? "Limpiar recursos propios"
      : "Comprobar tras recarga"
  buttons.append(next)
  statusElement.textContent = "Pruebas de importación aprobadas."
}
run().catch((error) => {
  statusElement.textContent = "Una prueba de importación ha fallado."
  console.error(error)
})
