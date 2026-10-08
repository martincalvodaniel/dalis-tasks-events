import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { applyLocalChangesPageV2 } from "@/lib/local-db/pull-changes-v2"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import { entityIdSchema } from "@/schemas/primitives"
import type { RemoteChangeV2 } from "@/types/remote-change-v2"

if (location.hostname !== "127.0.0.1" || location.port !== "4192")
  throw new Error("Mixed pull fixture requires its isolated loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const userId = `browser-test-${runId}-mixed-pull`
const otherUserId = `${userId}-other`
const now = "2026-10-08T00:00:00.000Z"
const stores = [
  "items",
  "tags",
  "itemViews",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
const status = document.getElementById("status")
const results = document.getElementById("results")
if (!status || !results) throw new Error("Mixed pull fixture markup missing")
const statusElement = status
const list = results
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Mixed pull fixture assertion failed")
}
async function refused(work: () => unknown) {
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
  list.append(row)
}
function fixture() {
  const id = crypto.randomUUID()
  const first = crypto.randomUUID()
  const second = crypto.randomUUID()
  const metadata = {
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const item = calendarItemSchema.parse({
    ...metadata,
    id,
    ownerId: userId,
    kind: "task",
    title: "Remote task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    completedAt: null,
    recurrence: null,
  })
  const tag = (tagId: string, revision: number) =>
    tagSchema.parse({
      ...metadata,
      id: tagId,
      userId,
      revision,
      name: `Category ${tagId}`,
      normalizedName: `category ${tagId}`,
      color: "#123456",
      position: 0,
    })
  const tags = [tag(first, 8), tag(second, 2)]
  const view = itemViewSchema.parse({
    ...metadata,
    userId,
    itemId: id,
    primaryTagId: first,
  })
  const changes: RemoteChangeV2[] = [
    {
      version: 2,
      kind: "item",
      recipientUserId: userId,
      operationId: crypto.randomUUID(),
      sequence: 1,
      item,
    },
  ]
  for (const [index, effects] of [
    tags.map((record) => ({ store: "tags" as const, record })),
    [{ store: "itemViews" as const, record: view }],
  ].entries()) {
    const operationId = crypto.randomUUID()
    const sequence = index + 2
    changes.push({
      version: 2,
      kind: "preference",
      recipientUserId: userId,
      operationId,
      sequence,
      effects: { version: 1, userId, operationId, sequence, effects },
    })
  }
  return {
    item,
    tags,
    view,
    receipt: {
      query: { after: 0, through: null, limit: 50 },
      page: { version: 2, changes, nextAfter: 3, through: 3, hasMore: false },
    },
  }
}
function seed(
  db: IDBDatabase,
  rows: Record<string, unknown[] | undefined> = {}
) {
  return runLocalTransaction(db, stores, "readwrite", (context) => {
    for (const name of stores) {
      const store = context.transaction.objectStore(name)
      store.clear()
      for (const row of rows[name] ?? []) store.put(row)
    }
    context.setResult(undefined)
  })
}
function snapshot(db: IDBDatabase): Promise<Record<string, unknown[]>> {
  return runLocalTransaction(db, stores, "readonly", (context) => {
    const result: Record<string, unknown[]> = {}
    let remaining = stores.length
    for (const name of stores) {
      const request = context.transaction.objectStore(name).getAll()
      request.onsuccess = () => {
        result[name] = request.result
        if (--remaining === 0) context.setResult(result)
      }
    }
  })
}
async function run() {
  let db = await openLocalDatabase(userId)
  const other = await openLocalDatabase(otherUserId)
  try {
    await check(
      "La página guarda contenido, categorías, asignación y cursor juntos; persiste al reabrir",
      async () => {
        const value = fixture()
        await seed(db)
        assert(
          (await applyLocalChangesPageV2(db, userId, value.receipt)) ===
            "applied"
        )
        db.close()
        db = await openLocalDatabase(userId)
        const rows = await snapshot(db)
        assert(
          rows.items.length === 1 &&
            rows.tags.length === 2 &&
            rows.itemViews.length === 1
        )
        assert(rows.remoteShadows.length === 4 && rows.outbox.length === 0)
        assert(
          JSON.stringify(rows.syncMetadata) ===
            JSON.stringify([{ key: "pull-cursor", after: 3, through: null }])
        )
        const before = JSON.stringify(rows)
        assert(
          (await applyLocalChangesPageV2(db, userId, value.receipt)) ===
            "ignored"
        )
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    await check(
      "Los pendientes de contenido y personales conservan datos, cola e historia exacta",
      async () => {
        const value = fixture()
        const optimistic = { ...value.item, title: "Local task", revision: 0 }
        const localTag = {
          ...value.tags[0],
          name: "Local category",
          normalizedName: "local category",
          revision: 0,
        }
        const entries = [
          {
            entityKey: `item:${value.item.id}`,
            command: {
              type: "task.set-status",
              occurrenceId: null,
              itemId: value.item.id,
              status: "in_progress",
            },
          },
          {
            entityKey: `tag:${localTag.id}`,
            command: { type: "tag.delete", tagId: localTag.id },
          },
        ].map((entry, index) =>
          outboxEntrySchema.parse({
            userId,
            entityKey: entry.entityKey,
            sequence: index + 1,
            dependencies: [],
            state: "pending",
            attempts: 0,
            createdAt: now,
            lease: null,
            operation: {
              protocolVersion: 1,
              operationId: crypto.randomUUID(),
              baseRevision: 0,
              command: entry.command,
            },
          })
        )
        await seed(db, {
          items: [optimistic],
          tags: [localTag],
          outbox: entries,
          syncMetadata: [{ key: "fixture-history", evidence: "untouched" }],
        })
        const before = await snapshot(db)
        await applyLocalChangesPageV2(db, userId, value.receipt)
        const after = await snapshot(db)
        for (const name of ["items", "tags", "outbox"])
          assert(JSON.stringify(after[name]) === JSON.stringify(before[name]))
        assert(after.itemViews.length === 0 && after.remoteShadows.length === 4)
        assert(
          after.syncMetadata.some(
            (row) =>
              JSON.stringify(row) === JSON.stringify(before.syncMetadata[0])
          )
        )
      }
    )
    await check(
      "Cambio de checkpoint y contradicción tardía no dejan escrituras parciales",
      async () => {
        const value = fixture()
        await seed(db, {
          syncMetadata: [{ key: "pull-cursor", after: 0, through: 3 }],
        })
        const before = JSON.stringify(await snapshot(db))
        await refused(() => applyLocalChangesPageV2(db, userId, value.receipt))
        assert(JSON.stringify(await snapshot(db)) === before)
        await seed(db, {
          remoteShadows: [
            {
              version: 2,
              kind: "preference",
              entityKey: `tag:${value.tags[0].id}`,
              record: {
                store: "tags",
                record: { ...value.tags[0], color: "#654321" },
              },
            },
          ],
        })
        const baseline = JSON.stringify(await snapshot(db))
        await refused(() => applyLocalChangesPageV2(db, userId, value.receipt))
        assert(JSON.stringify(await snapshot(db)) === baseline)
      }
    )
    await check(
      "Un fallo final del cursor revierte todos los efectos y permite reintentar",
      async () => {
        const value = fixture()
        await seed(db)
        const before = JSON.stringify(await snapshot(db))
        const original = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (row, key) {
          if (this.name === "syncMetadata")
            throw new Error("Injected late cursor failure")
          return original.call(this, row, key)
        }
        try {
          await refused(() =>
            applyLocalChangesPageV2(db, userId, value.receipt)
          )
        } finally {
          IDBObjectStore.prototype.put = original
        }
        assert(JSON.stringify(await snapshot(db)) === before)
        assert(
          (await applyLocalChangesPageV2(db, userId, value.receipt)) ===
            "applied"
        )
      }
    )
    await check(
      "Cuenta equivocada y efecto sin soporte se rechazan antes de abrir transacción",
      async () => {
        const value = fixture()
        const original = IDBDatabase.prototype.transaction
        let calls = 0
        IDBDatabase.prototype.transaction = function (
          ...args: Parameters<IDBDatabase["transaction"]>
        ) {
          calls++
          return original.apply(this, args)
        }
        try {
          await refused(() =>
            applyLocalChangesPageV2(other, userId, value.receipt)
          )
          const change = value.receipt.page.changes[2]
          if (change.kind !== "preference")
            throw new Error("Personal fixture missing")
          change.effects.effects.push({
            store: "settings",
            record: {
              userId,
              revision: 1,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              timeZone: "Europe/Madrid",
              weekStartsOn: 1,
              locale: "es-ES",
            },
          })
          await refused(() =>
            applyLocalChangesPageV2(db, userId, value.receipt)
          )
          assert(calls === 0)
        } finally {
          IDBDatabase.prototype.transaction = original
        }
      }
    )
    await check(
      "La fila 10001 rechaza el snapshot sin truncarlo ni avanzar cursor",
      async () => {
        const value = fixture()
        const tags = Array.from({ length: 10001 }, () => ({
          ...value.tags[0],
          id: crypto.randomUUID(),
        }))
        await seed(db, { tags })
        await refused(() => applyLocalChangesPageV2(db, userId, value.receipt))
        const rows = await snapshot(db)
        assert(
          rows.tags.length === 10001 &&
            rows.items.length === 0 &&
            rows.syncMetadata.length === 0
        )
      }
    )
    await check(
      "El checkpoint se conserva entre páginas y los borrados mantienen tombstones",
      async () => {
        const value = fixture()
        await seed(db)
        const first = {
          query: value.receipt.query,
          page: {
            ...value.receipt.page,
            changes: value.receipt.page.changes.slice(0, 2),
            nextAfter: 2,
            hasMore: true,
          },
        }
        await applyLocalChangesPageV2(db, userId, first)
        assert(
          JSON.stringify((await snapshot(db)).syncMetadata) ===
            JSON.stringify([{ key: "pull-cursor", after: 2, through: 3 }])
        )
        const last = structuredClone(value.receipt.page.changes[2])
        if (last.kind !== "preference")
          throw new Error("Personal fixture missing")
        last.effects.effects[0].record.deletedAt = now
        await applyLocalChangesPageV2(db, userId, {
          query: { after: 2, through: 3, limit: 50 },
          page: { ...value.receipt.page, changes: [last] },
        })
        assert(
          (await snapshot(db)).itemViews.some(
            (row) => (row as { deletedAt: string | null }).deletedAt === now
          )
        )
        const change = value.receipt.page.changes[0]
        if (change.kind !== "item") throw new Error("Item fixture missing")
        await applyLocalChangesPageV2(db, userId, {
          query: { after: 3, through: null, limit: 50 },
          page: {
            version: 2,
            changes: [
              {
                ...change,
                sequence: 4,
                item: { ...change.item, revision: 2, deletedAt: now },
              },
            ],
            nextAfter: 4,
            through: 4,
            hasMore: false,
          },
        })
        const rows = await snapshot(db)
        assert(
          rows.items.length === 1 &&
            (rows.items[0] as { deletedAt: string | null }).deletedAt === now
        )
        assert(
          JSON.stringify(rows.syncMetadata) ===
            JSON.stringify([{ key: "pull-cursor", after: 4, through: null }])
        )
      }
    )
    await check(
      "Una página superada no oculta evidencia almacenada futura ni cuenta ajena",
      async () => {
        const value = fixture()
        for (const rows of [
          {
            remoteShadows: [
              { version: 3, entityKey: `tag:${value.tags[0].id}`, record: {} },
            ],
          },
          { tags: [{ ...value.tags[0], userId: otherUserId }] },
        ]) {
          await seed(db, {
            ...rows,
            syncMetadata: [{ key: "pull-cursor", after: 3, through: null }],
          })
          const before = JSON.stringify(await snapshot(db))
          await refused(() =>
            applyLocalChangesPageV2(db, userId, value.receipt)
          )
          assert(JSON.stringify(await snapshot(db)) === before)
        }
      }
    )
    statusElement.textContent = "Pruebas completadas."
  } finally {
    db.close()
    other.close()
    for (const id of [userId, otherUserId])
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(id))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () =>
          reject(new Error("Mixed pull fixture cleanup blocked"))
      })
  }
}
run().catch((error: unknown) => {
  statusElement.textContent = "La comprobación ha fallado."
  console.error(error)
})
