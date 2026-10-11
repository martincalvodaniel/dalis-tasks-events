import {
  commitAccountBackupImport,
  prepareAccountBackupImport,
  readAccountBackupImportPreview,
} from "@/features/workspace/import-backup"
import { previewLocalBackupImport } from "@/lib/backup/import-preview"
import { decodeLocalBackup, encodeLocalBackup } from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalBackup } from "@/lib/local-db/backup"
import {
  importLocalBackupCopies,
  LocalBackupImporter,
  readLocalBackupImportPolicy,
} from "@/lib/local-db/backup-import"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { prepareLocalCommonPlanRelease } from "@/lib/local-db/common-plan-local-release"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import type { BackupImportRequest } from "@/types/backup-import"
import type { LocalBackup } from "@/types/local-backup"

if (location.hostname !== "127.0.0.1" || location.port !== "4243")
  throw new Error("Common import fixture requires its isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-common-import`
const otherUserId = `${userId}-other`
const now = "2026-10-11T10:00:00.000Z"
const storageKey = `browser-test:${runId}:common-import`
const resultList = document.getElementById("results")
const statusElement = document.getElementById("status")
const actions = document.getElementById("actions")
if (!resultList || !statusElement || !actions)
  throw new Error("Fixture markup missing")
const results = resultList
const status = statusElement
const buttons = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Common backup import assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  results.append(row)
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
    copies: source.stores.items
      .filter(
        (item) =>
          item.kind === "plan" &&
          item.deletedAt === null &&
          item.recurrence === null
      )
      .map((item) => ({
        sourceItemId: item.id,
        itemId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      })),
  }
}
async function metadata(database: IDBDatabase, value?: unknown) {
  return runLocalTransaction<unknown>(
    database,
    ["syncMetadata"],
    value === undefined ? "readonly" : "readwrite",
    (context) => {
      const store = context.transaction.objectStore("syncMetadata")
      const request =
        value === undefined
          ? store.get("common-plan-release")
          : store.put(value)
      request.onsuccess = () => context.setResult(request.result)
    }
  )
}
async function activate() {
  let control = await readAccountControl()
  assert(control.userId === null || control.userId === userId)
  if (control.logoutPending) control = await completeRemoteLogout(control.epoch)
  const prepared = await activatePreparedAccount(userId, now, control.epoch)
  return { userId, epoch: prepared.epoch }
}
async function cleanup() {
  const control = await readAccountControl()
  assert(control.userId === null || control.userId === userId)
  localStorage.removeItem(storageKey)
  for (const name of [
    localDatabaseName(userId),
    localDatabaseName(otherUserId),
    ACCOUNT_CONTROL_DATABASE,
  ])
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Common import cleanup blocked"))
    })
  status.textContent = "Recursos propios limpiados."
}
async function run() {
  if (query.get("phase") === "cleanup") {
    await cleanup()
    return
  }
  const database = await openLocalDatabase(userId)
  const read = () => readLocalBackup(database, userId, now)
  try {
    if (query.get("phase") === "reload") {
      const persisted = JSON.parse(localStorage.getItem(storageKey) ?? "null")
      assert(persisted?.request?.userId === userId)
      await check(
        "Recarga conserva copias, ajustes, marcador y evidencia; replay no escribe",
        async () => {
          assert(JSON.stringify((await read()).stores) === persisted.stores)
          assert(JSON.stringify(await metadata(database)) === persisted.marker)
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
          assert(JSON.stringify((await read()).stores) === persisted.stores)
        }
      )
    } else {
      let account = await activate()
      await check(
        "Partición vacía permite simples; preparación limita a los cuatro tipos comunes",
        async () => {
          assert(
            (await readLocalBackupImportPolicy(database, userId)) ===
              "all_simple"
          )
          assert(
            (await prepareLocalCommonPlanRelease(database, userId, now))
              .status === "ready"
          )
          assert(
            (await readLocalBackupImportPolicy(database, userId)) ===
              "common_plans"
          )
        }
      )
      await runLocalTransaction(
        database,
        ["settings"],
        "readwrite",
        (context) => {
          context.transaction.objectStore("settings").put({
            userId,
            timeZone: "Europe/Madrid",
            weekStartsOn: 1,
            locale: "es-ES",
            revision: 0,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          })
          context.setResult(undefined)
        }
      )
      const marker = await metadata(database)
      const expected = await read()
      const source = structuredClone(expected)
      for (const [index, variant] of (
        ["task", "event", "appointment", "note"] as const
      ).entries())
        source.stores.items.push(
          applyItemCommand(
            null,
            {
              type: "item.create",
              itemId: crypto.randomUUID(),
              input: {
                kind: "plan",
                variant,
                title: `Plan ${variant}`,
                description: "Descripción importada",
                schedule:
                  index % 2
                    ? {
                        mode: "timed",
                        localStart: "2026-10-11T11:00",
                        localEnd: "2026-10-11T12:00",
                        timeZone: "Europe/Madrid",
                      }
                    : {
                        mode: "all_day",
                        startDate: "2026-10-11",
                        endDateExclusive: "2026-10-12",
                      },
                status: variant === "note" ? "completed" : "not_started",
                recurrence: null,
                checklist: [
                  {
                    id: crypto.randomUUID(),
                    text: `Paso ${variant}`,
                    completed: variant === "event",
                  },
                ],
              },
            },
            userId,
            now
          )
        )
      const legacy = applyItemCommand(
        null,
        {
          type: "item.create",
          itemId: crypto.randomUUID(),
          input: {
            kind: "task",
            title: "Tarea anterior",
            description: "",
            status: "not_started",
            scheduledDate: "2026-10-11",
            recurrence: null,
            checklist: [],
          },
        },
        userId,
        now
      )
      source.stores.items.push(legacy)
      source.stores.items.push({
        ...source.stores.items[0],
        id: crypto.randomUUID(),
        deletedAt: now,
      })
      const originalPlan = source.stores.items[0]
      assert(originalPlan.kind === "plan")
      const recurringId = crypto.randomUUID()
      source.stores.items.push({
        ...originalPlan,
        id: recurringId,
        recurrence: {
          frequency: "daily",
          interval: 1,
          anchorDate: "2026-10-11",
          timeZone: "Europe/Madrid",
          end: { type: "never" },
        },
      })
      const sourceJson = encodeLocalBackup(source, userId)
      const input = request(source, expected)
      await check(
        "Comparación real de cuenta ofrece sólo cuatro copias vivas y conserva sesión",
        async () => {
          const preview = previewLocalBackupImport(
            sourceJson,
            expected,
            userId,
            "common_plans"
          )
          assert(
            preview.stores.items.filter(
              (row) =>
                row.support === "simple_item" &&
                row.classification !== "source_deleted"
            ).length === 4
          )
          assert(
            preview.stores.items.find((row) => row.key === legacy.id)
              ?.support === "unsupported"
          )
          const actual = await readAccountBackupImportPreview(
            account,
            sourceJson
          )
          assert(
            JSON.stringify(actual.preview.stores) ===
              JSON.stringify(preview.stores)
          )
          assert((await readAccountControl()).epoch === account.epoch)
          assert(
            JSON.stringify((await read()).stores) ===
              JSON.stringify(expected.stores)
          )
        }
      )
      await check(
        "Importación atómica crea cuatro identidades, cola pendiente y recibo sin ACK",
        async () => {
          assert(
            (await importLocalBackupCopies(database, userId, input, sourceJson))
              .status === "applied"
          )
          const actual = await read()
          assert(
            actual.stores.items.length === 4 &&
              actual.stores.outbox.length === 4
          )
          assert(
            actual.stores.outbox.every(
              (entry) =>
                entry.state === "pending" &&
                entry.attempts === 0 &&
                entry.lease === null &&
                entry.dependencies.length === 0
            )
          )
          assert(
            actual.stores.outbox
              .map((entry) => entry.sequence)
              .sort((a, b) => a - b)
              .join(",") === "1,2,3,4"
          )
          for (const copy of input.copies) {
            const item = actual.stores.items.find(
              (item) => item.id === copy.itemId
            )
            const original = source.stores.items.find(
              (item) => item.id === copy.sourceItemId
            )
            assert(item?.kind === "plan" && original?.kind === "plan")
            assert(
              item.id !== original.id &&
                item.revision === 0 &&
                item.variant === original.variant
            )
            assert(
              JSON.stringify(item.schedule) ===
                JSON.stringify(original.schedule)
            )
            assert(
              item.status === original.status &&
                JSON.stringify(item.checklist) ===
                  JSON.stringify(original.checklist)
            )
          }
          assert(
            actual.stores.syncMetadata.some(
              (record) =>
                "importId" in record && record.importId === input.importId
            )
          )
          assert(
            !actual.stores.syncMetadata.some((record) => "result" in record)
          )
          assert(
            JSON.stringify(actual.stores.settings) ===
              JSON.stringify(expected.stores.settings)
          )
          assert(
            JSON.stringify(await metadata(database)) === JSON.stringify(marker)
          )
          assert((await readAccountControl()).epoch === account.epoch)
          assert(
            JSON.stringify(
              decodeLocalBackup(encodeLocalBackup(actual, userId), userId)
            ) === JSON.stringify(actual)
          )
          assert(
            !actual.stores.syncMetadata.some(
              (record) => record.key === "common-plan-release"
            )
          )
        }
      )
      await check(
        "Replay y carrera conservan una única escritura por identidad",
        async () => {
          const before = JSON.stringify((await read()).stores)
          assert(
            (await importLocalBackupCopies(database, userId, input, sourceJson))
              .status === "replayed"
          )
          assert(JSON.stringify((await read()).stores) === before)
          const concurrent = request(source, await read())
          concurrent.copies.length = 1
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
          assert((await read()).stores.items.length === 5)
        }
      )
      await check(
        "Snapshot obsoleto, legacy y fallo tardío revierten todas las escrituras",
        async () => {
          const baseline = await read()
          const before = JSON.stringify(baseline.stores)
          await refused(() =>
            importLocalBackupCopies(
              database,
              userId,
              request(source, expected),
              sourceJson
            )
          )
          const oldInput = request(source, baseline)
          oldInput.copies = [
            {
              sourceItemId: legacy.id,
              itemId: crypto.randomUUID(),
              operationId: crypto.randomUUID(),
            },
          ]
          await refused(() =>
            importLocalBackupCopies(database, userId, oldInput, sourceJson)
          )
          const failed = request(source, baseline)
          const nativeAdd = IDBObjectStore.prototype.add
          IDBObjectStore.prototype.add = function (value, key) {
            if (
              this.name === "syncMetadata" &&
              value?.key === `backup-import:${failed.importId}`
            )
              return nativeAdd.call(this, { key: "outbox-sequence", value: 0 })
            return nativeAdd.call(this, value, key)
          }
          try {
            await refused(() =>
              importLocalBackupCopies(database, userId, failed, sourceJson)
            )
          } finally {
            IDBObjectStore.prototype.add = nativeAdd
          }
          assert(JSON.stringify((await read()).stores) === before)
        }
      )
      await check(
        "Marcador corrupto o ajeno rechaza incluso replay sin reparar datos",
        async () => {
          assert(marker && typeof marker === "object")
          for (const bad of [
            { ...marker, version: 99 },
            { ...marker, userId: otherUserId },
          ]) {
            await metadata(database, bad)
            const before = JSON.stringify(await metadata(database))
            await refused(() => readLocalBackupImportPolicy(database, userId))
            await refused(() =>
              importLocalBackupCopies(database, userId, input, sourceJson)
            )
            assert(JSON.stringify(await metadata(database)) === before)
          }
          await metadata(database, marker)
          assert((await read()).stores.items.length === 5)
        }
      )
      await check(
        "Guardia de cuenta rechaza cambio de época durante apertura sin guardar",
        async () => {
          const comparison = await readAccountBackupImportPreview(
            account,
            sourceJson
          )
          const prepared = await prepareAccountBackupImport(account, {
            sourceJson,
            expected: comparison.expected,
            sourceItemIds: [source.stores.items[0].id],
          })
          const before = JSON.stringify((await read()).stores)
          const nativeOpen = LocalBackupImporter.open
          LocalBackupImporter.open = async (actor) => {
            const importer = await nativeOpen(actor)
            await hideLocalAccount()
            return importer
          }
          try {
            await refused(() => commitAccountBackupImport(account, prepared))
          } finally {
            LocalBackupImporter.open = nativeOpen
          }
          await refused(() =>
            readAccountBackupImportPreview(account, sourceJson)
          )
          assert(JSON.stringify((await read()).stores) === before)
          account = await activate()
        }
      )
      await check(
        "Partición ajena sigue vacía y rechaza identidades cruzadas",
        async () => {
          const other = await openLocalDatabase(otherUserId)
          try {
            const before = JSON.stringify(
              (await readLocalBackup(other, otherUserId, now)).stores
            )
            await refused(() => readLocalBackupImportPolicy(other, userId))
            await refused(() =>
              importLocalBackupCopies(other, userId, input, sourceJson)
            )
            assert(
              JSON.stringify(
                (await readLocalBackup(other, otherUserId, now)).stores
              ) === before
            )
          } finally {
            other.close()
          }
        }
      )
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          request: input,
          sourceJson,
          stores: JSON.stringify((await read()).stores),
          marker: JSON.stringify(marker),
        })
      )
    }
  } finally {
    database.close()
  }
  const next = document.createElement("a")
  next.href = `/?run=${runId}&phase=${query.get("phase") === "reload" ? "cleanup" : "reload"}`
  next.textContent =
    query.get("phase") === "reload"
      ? "Limpiar recursos propios"
      : "Comprobar tras recarga"
  buttons.append(next)
  status.textContent = "Pruebas de importación común aprobadas."
}
run().catch((error) => {
  status.textContent = "Una prueba de importación común ha fallado."
  console.error(error)
})
