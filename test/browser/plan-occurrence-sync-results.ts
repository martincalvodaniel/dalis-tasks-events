import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import {
  readLocalBackup,
  readLocalRecurringBackup,
} from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { applyLocalPlanOccurrenceResult } from "@/lib/local-db/plan-occurrence-sync-results"
import { readLocalPlanOccurrenceSyncIncidents } from "@/lib/local-db/recurring-sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import type { OutboxEntry } from "@/types/local-sync"

if (location.hostname !== "127.0.0.1" || location.port !== "4253")
  throw new Error("Appearance fixture requires its isolated loopback origin")
const query = new URLSearchParams(location.search),
  runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-appearance-results`,
  otherId = `${userId}-other`
const marker = `dalis:appearance-result:${runId}`,
  proofKey = `${marker}:proof`,
  incidentKey = `${marker}:incident`,
  backupKey = `${marker}:backup`
const stores = [
  "items",
  "occurrences",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
const timestamp = "2026-10-11T13:00:00.000Z"
const rows = document.getElementById("results"),
  status = document.getElementById("status"),
  actions = document.getElementById("actions")
if (!rows || !status || !actions)
  throw new Error("Appearance fixture markup is missing")
const resultRows = rows,
  statusElement = status,
  actionElement = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Appearance transaction browser assertion failed")
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
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  resultRows.append(row)
}
async function snapshot(db: IDBDatabase) {
  return runLocalTransaction<Record<string, unknown[]>>(
    db,
    stores,
    "readonly",
    (context) => {
      const values: Record<string, unknown[]> = {},
        requests = stores.map(
          (store) =>
            [store, context.transaction.objectStore(store).getAll()] as const
        )
      let remaining = requests.length
      for (const [store, request] of requests)
        request.onsuccess = () => {
          values[store] = request.result
          if (!--remaining) context.setResult(values)
        }
    }
  )
}
function fixture() {
  const itemId = crypto.randomUUID(),
    senderId = crypto.randomUUID()
  const series = planSchema.parse({
    kind: "plan",
    variant: "appointment",
    id: itemId,
    ownerId: userId,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const operation = remotePlanOccurrenceOperationSchema.parse({
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision: 3,
    command: {
      type: "plan.set-occurrence-status",
      itemId,
      occurrenceId: `${itemId}:2026-10-11`,
      expectedOccurrenceRevision: 0,
      status: "completed",
    },
  })
  const { expectedOccurrenceRevision, ...command } = operation.command
  const local = applyPlanOccurrenceCommand(
    series,
    null,
    command,
    userId,
    timestamp
  )
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${itemId}`,
    operation,
    sequence: 1,
    dependencies: [],
    state: "sending",
    attempts: 1,
    createdAt: timestamp,
    lease: { ownerId: senderId, expiresAt: "2026-10-11T13:01:00.000Z" },
  }
  return {
    series,
    local,
    entry,
    submission: {
      senderId,
      operation,
      result: {
        kind: "plan-occurrence" as const,
        userId,
        outcome: {
          status: "applied" as const,
          operationId: operation.operationId,
          occurrence: { ...local, revision: expectedOccurrenceRevision + 1 },
          seriesRevision: 3,
          sequence: 5,
        },
      },
    },
  }
}
function seed(
  db: IDBDatabase,
  value: ReturnType<typeof fixture>,
  entries: OutboxEntry[] = [value.entry]
) {
  return runLocalTransaction<void>(db, stores, "readwrite", (context) => {
    for (const name of stores) context.transaction.objectStore(name).clear()
    context.transaction.objectStore("items").put(value.series)
    context.transaction.objectStore("occurrences").put(value.local)
    for (const entry of entries)
      context.transaction.objectStore("outbox").put(entry)
    context.setResult(undefined)
  })
}
async function cleanup() {
  assert(sessionStorage.getItem(marker) === "owned")
  for (const id of [userId, otherId])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(localDatabaseName(id))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned appearance cleanup is blocked"))
    })
  sessionStorage.removeItem(marker)
  sessionStorage.removeItem(proofKey)
  sessionStorage.removeItem(incidentKey)
  sessionStorage.removeItem(backupKey)
}
async function run() {
  const existing = await indexedDB.databases()
  if (query.get("phase") === "reload")
    assert(
      sessionStorage.getItem(marker) === "owned" &&
        existing.some((value) => value.name === localDatabaseName(userId))
    )
  else {
    assert(
      !existing.some((value) =>
        [localDatabaseName(userId), localDatabaseName(otherId)].includes(
          value.name ?? ""
        )
      )
    )
    sessionStorage.setItem(marker, "owned")
  }
  const db = await openLocalDatabase(userId),
    other = await openLocalDatabase(otherId)
  let keep = false
  try {
    if (query.get("phase") === "reload") {
      await check(
        "cola, aparición y evidencia exactas tras recarga",
        async () =>
          assert(
            JSON.stringify(await snapshot(db)) ===
              sessionStorage.getItem(proofKey)
          )
      )
      await check("comparación de conflicto exacta tras recarga", async () =>
        assert(
          JSON.stringify(
            await readLocalPlanOccurrenceSyncIncidents(db, userId)
          ) === sessionStorage.getItem(incidentKey)
        )
      )
      await check("backup recurrente exacto tras recarga", async () =>
        assert(
          encodeLocalRecurringBackup(
            await readLocalRecurringBackup(db, userId, timestamp),
            userId
          ) === sessionStorage.getItem(backupKey)
        )
      )
      statusElement.textContent =
        "Recarga verificada; limpiando particiones propias."
      return
    }
    await check("commit y replay únicos sin cambiar serie", async () => {
      const value = fixture()
      await seed(db, value)
      assert(
        (await applyLocalPlanOccurrenceResult(db, userId, value.submission)) ===
          "applied"
      )
      const stored = await snapshot(db)
      assert((stored.items[0] as { revision: number }).revision === 3)
      assert((stored.occurrences[0] as { revision: number }).revision === 1)
      assert(
        (stored.outbox[0] as OutboxEntry).state === "acknowledged" &&
          stored.syncMetadata.length === 1 &&
          stored.remoteShadows.length === 1
      )
      assert(
        (await applyLocalPlanOccurrenceResult(db, userId, value.submission)) ===
          "replayed"
      )
      assert(JSON.stringify(await snapshot(db)) === JSON.stringify(stored))
    })
    await check(
      "dependiente directo sin intento rebasa sólo aparición",
      async () => {
        const value = fixture()
        const next: OutboxEntry = {
          ...value.entry,
          state: "pending",
          lease: null,
          attempts: 0,
          sequence: 2,
          dependencies: [value.entry.operation.operationId],
          operation: {
            ...value.entry.operation,
            operationId: crypto.randomUUID(),
          },
        }
        const tried: OutboxEntry = {
          ...next,
          attempts: 1,
          sequence: 3,
          operation: { ...next.operation, operationId: crypto.randomUUID() },
        }
        await seed(db, value, [value.entry, next, tried])
        await applyLocalPlanOccurrenceResult(db, userId, value.submission)
        const stored = await snapshot(db),
          entries = stored.outbox as OutboxEntry[]
        const pending = entries.find(
          (entry) => entry.operation.operationId === next.operation.operationId
        )
        assert(
          pending?.operation.baseRevision === 3 &&
            "expectedOccurrenceRevision" in pending.operation.command &&
            pending.operation.command.expectedOccurrenceRevision === 1
        )
        assert(
          JSON.stringify(
            entries.find(
              (entry) =>
                entry.operation.operationId === tried.operation.operationId
            )
          ) === JSON.stringify(tried)
        )
        assert(
          JSON.stringify(stored.occurrences[0]) === JSON.stringify(value.local)
        )
      }
    )
    await check(
      "fallo de última escritura revierte aparición, shadow, ACK y outcome",
      async () => {
        const value = fixture()
        await seed(db, value)
        const before = JSON.stringify(await snapshot(db)),
          put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === "syncMetadata")
            throw new Error("Injected late outcome failure")
          return put.call(this, value, key)
        }
        try {
          await refused(() =>
            applyLocalPlanOccurrenceResult(db, userId, value.submission)
          )
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(JSON.stringify(await snapshot(db)) === before)
        assert(
          (await applyLocalPlanOccurrenceResult(
            db,
            userId,
            value.submission
          )) === "applied"
        )
      }
    )
    await check("partición y lease ajenos no escriben", async () => {
      const value = fixture()
      await seed(db, value)
      const before = JSON.stringify(await snapshot(db))
      await refused(async () =>
        applyLocalPlanOccurrenceResult(other, userId, value.submission)
      )
      await refused(async () =>
        applyLocalPlanOccurrenceResult(db, userId, {
          ...value.submission,
          senderId: crypto.randomUUID(),
        })
      )
      assert(
        JSON.stringify(await snapshot(db)) === before &&
          (await snapshot(other)).items.length === 0
      )
    })
    await check("snapshot corrupto bloquea antes de ACK", async () => {
      const value = fixture()
      await seed(db, value)
      await runLocalTransaction<void>(
        db,
        ["remoteShadows"],
        "readwrite",
        (context) => {
          context.transaction.objectStore("remoteShadows").put({
            version: 3,
            kind: "plan-occurrence",
            entityKey: "corrupt",
            userId,
          })
          context.setResult(undefined)
        }
      )
      const before = JSON.stringify(await snapshot(db))
      await refused(() =>
        applyLocalPlanOccurrenceResult(db, userId, value.submission)
      )
      assert(JSON.stringify(await snapshot(db)) === before)
    })
    await check(
      "incidente lee aparición actual y no escribe ni inventa ACK",
      async () => {
        const value = fixture()
        await seed(db, value)
        await applyLocalPlanOccurrenceResult(db, userId, {
          ...value.submission,
          result: {
            kind: "plan-occurrence",
            userId,
            outcome: {
              status: "conflict",
              operationId: value.entry.operation.operationId,
              series: value.series,
              current: value.submission.result.outcome.occurrence,
            },
          },
        })
        const current = {
          ...value.local,
          content: { title: "Later local", description: "" },
        }
        await runLocalTransaction<void>(
          db,
          ["occurrences"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("occurrences").put(current)
            context.setResult(undefined)
          }
        )
        const before = JSON.stringify(await snapshot(db)),
          incidents = await readLocalPlanOccurrenceSyncIncidents(db, userId)
        assert(
          incidents.length === 1 &&
            JSON.stringify(incidents[0].local) === JSON.stringify(current) &&
            JSON.stringify(incidents[0].localAtOutcome) ===
              JSON.stringify(value.local)
        )
        assert(
          JSON.stringify(await snapshot(db)) === before &&
            incidents[0].entry.state === "conflict"
        )
        await refused(() => readLocalPlanOccurrenceSyncIncidents(other, userId))
      }
    )
    await check(
      "backup readonly conserva aparición actual e historia con formato explícito",
      async () => {
        await runLocalTransaction<void>(
          db,
          ["syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 1 })
            context.setResult(undefined)
          }
        )
        const before = JSON.stringify(await snapshot(db)),
          put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = () => {
          throw new Error("Backup reader must not write")
        }
        try {
          const backup = await readLocalRecurringBackup(db, userId, timestamp)
          assert(
            backup.version === 3 && backup.stores.outbox[0].state === "conflict"
          )
          const json = encodeLocalRecurringBackup(backup, userId)
          assert(
            JSON.stringify(decodeLocalRecurringBackup(json, userId)) ===
              JSON.stringify(backup)
          )
          await refused(() => readLocalBackup(db, userId, timestamp))
          await refused(() =>
            readLocalRecurringBackup(other, userId, timestamp)
          )
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    const final = fixture()
    await seed(db, final)
    await applyLocalPlanOccurrenceResult(db, userId, {
      ...final.submission,
      result: {
        kind: "plan-occurrence",
        userId,
        outcome: {
          status: "conflict",
          operationId: final.entry.operation.operationId,
          series: final.series,
          current: null,
        },
      },
    })
    await runLocalTransaction<void>(
      db,
      ["syncMetadata"],
      "readwrite",
      (context) => {
        context.transaction
          .objectStore("syncMetadata")
          .put({ key: "outbox-sequence", value: 1 })
        context.setResult(undefined)
      }
    )
    sessionStorage.setItem(proofKey, JSON.stringify(await snapshot(db)))
    sessionStorage.setItem(
      incidentKey,
      JSON.stringify(await readLocalPlanOccurrenceSyncIncidents(db, userId))
    )
    sessionStorage.setItem(
      backupKey,
      encodeLocalRecurringBackup(
        await readLocalRecurringBackup(db, userId, timestamp),
        userId
      )
    )
    keep = true
    statusElement.textContent =
      "Siete comprobaciones aprobadas. Falta verificar recarga."
    const button = document.createElement("button")
    button.textContent = "Verificar recarga y limpiar"
    button.onclick = () => {
      location.search = `?run=${runId}&phase=reload`
    }
    actionElement.append(button)
  } finally {
    db.close()
    other.close()
    if (!keep) {
      await cleanup()
      statusElement.textContent += " Particiones propias eliminadas."
    }
  }
}
run().catch((error: unknown) => {
  statusElement.textContent = "La comprobación ha fallado."
  console.error(error)
})
