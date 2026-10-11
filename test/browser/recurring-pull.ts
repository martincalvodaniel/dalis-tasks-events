import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import {
  applyLocalPreferenceResult,
  applyLocalRecurringPreferenceResult,
} from "@/lib/local-db/preference-sync-results"
import { applyLocalRecurringChangesPage } from "@/lib/local-db/pull-recurring-changes"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { localRecurringChangesPageInputSchema } from "@/schemas/local-recurring-pull"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { OutboxEntry } from "@/types/local-sync"

if (location.hostname !== "127.0.0.1" || location.port !== "4254")
  throw new Error("Recurring fixture requires its isolated loopback origin")
const query = new URLSearchParams(location.search),
  runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-recurring-pull`,
  otherId = `${userId}-other`
const marker = `dalis:recurring-pull:${runId}`,
  proofKey = `${marker}:proof`
const stores = [
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
const timestamp = "2026-10-11T13:00:00.000Z"
const rows = document.getElementById("results"),
  status = document.getElementById("status"),
  actions = document.getElementById("actions")
if (!rows || !status || !actions)
  throw new Error("Recurring fixture markup is missing")
const resultRows = rows,
  statusElement = status,
  actionElement = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Recurring pull browser assertion failed")
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
function seed(db: IDBDatabase, values: Record<string, unknown[]> = {}) {
  return runLocalTransaction<void>(db, stores, "readwrite", (context) => {
    for (const name of stores) {
      const store = context.transaction.objectStore(name)
      store.clear()
      for (const record of values[name] ?? []) store.put(record)
    }
    context.setResult(undefined)
  })
}
function fixture() {
  const id = crypto.randomUUID(),
    tagId = crypto.randomUUID()
  const metadata = {
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const series = planSchema.parse({
    ...metadata,
    kind: "plan",
    variant: "note",
    id,
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
  })
  const occurrence = {
    ...applyPlanOccurrenceCommand(
      series,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        status: "completed",
      },
      userId,
      timestamp
    ),
    revision: 1,
  }
  const personalId = crypto.randomUUID()
  const receipt = localRecurringChangesPageInputSchema.parse({
    query: { after: 0, through: null, limit: 100 },
    page: {
      version: 2,
      changes: [
        {
          version: 2,
          kind: "item",
          recipientUserId: userId,
          operationId: crypto.randomUUID(),
          sequence: 1,
          item: series,
        },
        {
          version: 2,
          kind: "preference",
          recipientUserId: userId,
          operationId: personalId,
          sequence: 2,
          effects: {
            version: 1,
            userId,
            operationId: personalId,
            sequence: 2,
            effects: [
              {
                store: "tags",
                record: {
                  ...metadata,
                  id: tagId,
                  userId,
                  name: "Category",
                  normalizedName: "category",
                  color: "#123456",
                  position: 1024,
                },
              },
              {
                store: "itemViews",
                record: {
                  ...metadata,
                  userId,
                  itemId: id,
                  primaryTagId: tagId,
                },
              },
            ],
          },
        },
        {
          version: 2,
          kind: "plan-occurrence",
          recipientUserId: userId,
          operationId: crypto.randomUUID(),
          sequence: 3,
          seriesRevision: 1,
          occurrence,
        },
      ],
      nextAfter: 3,
      through: 3,
      hasMore: false,
    },
  })
  const entry = outboxEntrySchema.parse({
    userId,
    entityKey: `item:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: occurrence.id,
        expectedOccurrenceRevision: 0,
        status: "in_progress",
      },
    },
    state: "pending",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: timestamp,
  })
  return { series, occurrence, receipt, entry }
}
async function cleanup() {
  assert(sessionStorage.getItem(marker) === "owned")
  for (const id of [userId, otherId])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(localDatabaseName(id))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned recurring cleanup is blocked"))
    })
  sessionStorage.removeItem(marker)
  sessionStorage.removeItem(proofKey)
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
      await check("snapshot y cursor exactos tras recarga", async () =>
        assert(
          JSON.stringify(await snapshot(db)) ===
            sessionStorage.getItem(proofKey)
        )
      )
      statusElement.textContent =
        "Recarga verificada; limpiando particiones propias."
      return
    }
    await check(
      "contenido, categoría, asignación y aparición en un commit; replay sin writes",
      async () => {
        const value = fixture()
        await seed(db)
        assert(
          (await applyLocalRecurringChangesPage(db, userId, value.receipt)) ===
            "applied"
        )
        const stored = await snapshot(db),
          before = JSON.stringify(stored)
        assert(
          JSON.stringify(stored.items) === JSON.stringify([value.series]) &&
            JSON.stringify(stored.occurrences) ===
              JSON.stringify([value.occurrence])
        )
        assert(
          stored.tags.length === 1 &&
            stored.itemViews.length === 1 &&
            stored.outbox.length === 0 &&
            stored.remoteShadows.length === 4
        )
        assert(
          JSON.stringify(stored.syncMetadata) ===
            JSON.stringify([{ key: "pull-cursor", after: 3, through: null }])
        )
        const put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = () => {
          throw new Error("Ignored page must not write")
        }
        try {
          assert(
            (await applyLocalRecurringChangesPage(
              db,
              userId,
              value.receipt
            )) === "ignored"
          )
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    await check(
      "checkpoint parcial congelado y rechazo sin avance",
      async () => {
        const value = fixture()
        await seed(db)
        const first = {
          query: { ...value.receipt.query, limit: 2 },
          page: {
            ...value.receipt.page,
            changes: value.receipt.page.changes.slice(0, 2),
            nextAfter: 2,
            hasMore: true,
          },
        }
        await applyLocalRecurringChangesPage(db, userId, first)
        const before = JSON.stringify(await snapshot(db))
        const last = {
          query: { after: 2, through: 3, limit: 100 },
          page: {
            ...value.receipt.page,
            changes: [value.receipt.page.changes[2]],
          },
        }
        await refused(() =>
          applyLocalRecurringChangesPage(db, userId, {
            ...last,
            query: { ...last.query, through: null },
          })
        )
        assert(JSON.stringify(await snapshot(db)) === before)
        await applyLocalRecurringChangesPage(db, userId, last)
        assert((await snapshot(db)).occurrences.length === 1)
      }
    )
    await check(
      "pendiente intentado y outcome exactos; descarga nunca ACK",
      async () => {
        const value = fixture(),
          local = {
            ...value.occurrence,
            status: "in_progress",
            completedAt: null,
            revision: 0,
          }
        const outcome = { key: "operator-proof", value: "keep" }
        await seed(db, {
          items: [value.series],
          occurrences: [local],
          outbox: [value.entry],
          syncMetadata: [outcome],
        })
        await applyLocalRecurringChangesPage(db, userId, value.receipt)
        const stored = await snapshot(db)
        assert(
          JSON.stringify(stored.occurrences) === JSON.stringify([local]) &&
            JSON.stringify(stored.outbox) === JSON.stringify([value.entry])
        )
        assert(
          stored.syncMetadata.some(
            (record) => JSON.stringify(record) === JSON.stringify(outcome)
          ) && (stored.outbox[0] as OutboxEntry).state === "pending"
        )
      }
    )
    await check(
      "fallo del cursor revierte todas las escrituras y retry recupera",
      async () => {
        const value = fixture()
        await seed(db)
        const before = JSON.stringify(await snapshot(db)),
          put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === "syncMetadata")
            throw new Error("Injected late cursor failure")
          return put.call(this, value, key)
        }
        try {
          await refused(() =>
            applyLocalRecurringChangesPage(db, userId, value.receipt)
          )
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(JSON.stringify(await snapshot(db)) === before)
        assert(
          (await applyLocalRecurringChangesPage(db, userId, value.receipt)) ===
            "applied"
        )
      }
    )
    await check(
      "actor, padre ausente y corrupción bloquean incluso páginas ignoradas",
      async () => {
        const value = fixture()
        await seed(db)
        const before = JSON.stringify(await snapshot(db))
        await refused(() =>
          applyLocalRecurringChangesPage(other, userId, value.receipt)
        )
        await refused(async () =>
          applyLocalRecurringChangesPage(db, otherId, value.receipt)
        )
        await refused(async () =>
          applyLocalRecurringChangesPage(db, userId, {
            ...value.receipt,
            page: {
              ...value.receipt.page,
              changes: [
                ...value.receipt.page.changes.slice(0, 2),
                { ...value.receipt.page.changes[2], seriesRevision: 2 },
              ],
            },
          })
        )
        assert(
          JSON.stringify(await snapshot(db)) === before &&
            (await snapshot(other)).items.length === 0
        )
        await applyLocalRecurringChangesPage(db, userId, value.receipt)
        const stored = await snapshot(db)
        await seed(db, {
          ...stored,
          remoteShadows: [
            ...stored.remoteShadows,
            { entityKey: "corrupt", kind: "plan-occurrence", version: 8 },
          ],
        })
        const corrupt = JSON.stringify(await snapshot(db))
        await refused(() =>
          applyLocalRecurringChangesPage(db, userId, value.receipt)
        )
        assert(JSON.stringify(await snapshot(db)) === corrupt)
      }
    )
    await check(
      "cancelación, tombstones y cache anterior se conservan",
      async () => {
        const value = fixture()
        const legacyId = crypto.randomUUID()
        const legacy = itemOccurrenceSchema.parse({
          kind: "task",
          id: `${legacyId}:2026-10-11`,
          seriesId: legacyId,
          slotKey: "2026-10-11",
          scheduledDate: "2026-10-11",
          status: "not_started",
          checklist: [],
          completedAt: null,
          cancelled: false,
          revision: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        })
        await seed(db, { occurrences: [legacy] })
        await applyLocalRecurringChangesPage(db, userId, value.receipt)
        const occurrence = {
            ...value.occurrence,
            revision: 2,
            cancelled: true,
            deletedAt: timestamp,
          },
          series = { ...value.series, revision: 2, deletedAt: timestamp }
        await applyLocalRecurringChangesPage(db, userId, {
          query: { after: 3, through: null, limit: 100 },
          page: {
            version: 2,
            changes: [
              {
                ...value.receipt.page.changes[2],
                sequence: 4,
                operationId: crypto.randomUUID(),
                occurrence,
              },
              {
                ...value.receipt.page.changes[0],
                sequence: 5,
                operationId: crypto.randomUUID(),
                item: series,
              },
            ],
            nextAfter: 5,
            through: 5,
            hasMore: false,
          },
        })
        const stored = await snapshot(db)
        assert(
          JSON.stringify(stored.items) === JSON.stringify([series]) &&
            stored.occurrences.length === 2 &&
            stored.occurrences.some(
              (record) => JSON.stringify(record) === JSON.stringify(occurrence)
            ) &&
            stored.occurrences.some(
              (record) => JSON.stringify(record) === JSON.stringify(legacy)
            )
        )
      }
    )
    await check(
      "ACK de categoría conserva aparición y su intención; puerto anterior rechaza",
      async () => {
        const value = fixture()
        await seed(db)
        await applyLocalRecurringChangesPage(db, userId, value.receipt)
        const before = await snapshot(db),
          tag = before.tags[0] as { id: string },
          senderId = crypto.randomUUID()
        const entry = outboxEntrySchema.parse({
          ...value.entry,
          state: "sending",
          attempts: 1,
          lease: { ownerId: senderId, expiresAt: "2026-10-11T13:01:00.000Z" },
          entityKey: `tag:${tag.id}`,
          operation: {
            ...value.entry.operation,
            operationId: crypto.randomUUID(),
            baseRevision: 1,
            command: { type: "tag.delete", tagId: tag.id },
          },
        })
        const dependent = {
          ...value.entry,
          sequence: 2,
          dependencies: [entry.operation.operationId],
        }
        const submission = {
          senderId,
          operation: entry.operation,
          result: {
            kind: "preference",
            outcome: {
              status: "applied",
              operationId: entry.operation.operationId,
              effects: {
                version: 1,
                userId,
                operationId: entry.operation.operationId,
                sequence: 4,
                effects: [
                  {
                    store: "tags",
                    record: {
                      ...(before.tags[0] as object),
                      revision: 2,
                      deletedAt: timestamp,
                    },
                  },
                ],
              },
            },
          },
        }
        await seed(db, { ...before, outbox: [entry, dependent] })
        const frozen = JSON.stringify(await snapshot(db))
        await refused(() => applyLocalPreferenceResult(db, userId, submission))
        assert(JSON.stringify(await snapshot(db)) === frozen)
        const put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === "syncMetadata")
            throw new Error("Injected recurring personal outcome failure")
          return put.call(this, value, key)
        }
        try {
          await refused(() =>
            applyLocalRecurringPreferenceResult(db, userId, submission)
          )
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(JSON.stringify(await snapshot(db)) === frozen)
        assert(
          (await applyLocalRecurringPreferenceResult(
            db,
            userId,
            submission
          )) === "applied"
        )
        const stored = await snapshot(db),
          entries = stored.outbox as OutboxEntry[]
        assert(
          entries.find(
            (record) =>
              record.operation.operationId === entry.operation.operationId
          )?.state === "acknowledged"
        )
        assert(
          JSON.stringify(
            entries.find(
              (record) =>
                record.operation.operationId === dependent.operation.operationId
            )
          ) === JSON.stringify(dependent)
        )
        assert(
          JSON.stringify(stored.items) === JSON.stringify(before.items) &&
            JSON.stringify(stored.occurrences) ===
              JSON.stringify(before.occurrences)
        )
        const appearance = (records: unknown[]) =>
          records.filter(
            (record) =>
              record &&
              typeof record === "object" &&
              "kind" in record &&
              record.kind === "plan-occurrence"
          )
        assert(
          JSON.stringify(appearance(stored.remoteShadows)) ===
            JSON.stringify(appearance(before.remoteShadows))
        )
        const exact = JSON.stringify(stored)
        assert(
          (await applyLocalRecurringPreferenceResult(
            db,
            userId,
            submission
          )) === "replayed"
        )
        assert(JSON.stringify(await snapshot(db)) === exact)
      }
    )
    sessionStorage.setItem(proofKey, JSON.stringify(await snapshot(db)))
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
