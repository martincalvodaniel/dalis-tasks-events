import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalMixedSyncStore } from "@/lib/local-db/mixed-sync-store"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import { entityIdSchema } from "@/schemas/primitives"
import type { OutboxEntry } from "@/types/local-sync"
import type { LocalSyncResultInputV2 } from "@/types/local-sync-result-v2"

if (location.hostname !== "127.0.0.1" || !location.port)
  throw new Error("Mixed store fixture requires an isolated loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const userId = `browser-test-${runId}-mixed-store`
const otherUserId = `${userId}-other`
const timestamp = "2026-10-09T00:00:00.000Z"
const stores = [
  "items",
  "tags",
  "itemViews",
  "taskPlacements",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
const status = document.getElementById("status")
const results = document.getElementById("results")
const button = document.getElementById("run")
if (!status || !results || !(button instanceof HTMLButtonElement))
  throw new Error("Mixed store fixture markup is missing")
const statusElement = status
const list = results
const runButton = button

function assert(value: unknown, description: string): asserts value {
  if (!value)
    throw new Error(`Mixed store browser assertion failed: ${description}`)
}
async function refused(work: () => unknown) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed, "unsafe operation rejected")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  list.append(row)
  await work()
  row.textContent = `Correcto: ${label}`
}
function item(id = crypto.randomUUID(), revision = 0) {
  return calendarItemSchema.parse({
    id,
    ownerId: userId,
    kind: "task",
    title: "Fixture task",
    description: "",
    scheduledDate: "2026-10-09",
    status: "not_started",
    checklist: [],
    completedAt: null,
    recurrence: null,
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
}
function itemEntry(id: string, sequence = 1): OutboxEntry {
  return outboxEntrySchema.parse({
    userId,
    entityKey: `item:${id}`,
    sequence,
    dependencies: [],
    state: "pending",
    attempts: 0,
    createdAt: timestamp,
    lease: null,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "item.create",
        itemId: id,
        input: {
          kind: "task",
          title: "Fixture task",
          description: "",
          scheduledDate: "2026-10-09",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      },
    },
  })
}
function seed(database: IDBDatabase, rows: Record<string, unknown[]> = {}) {
  return runLocalTransaction(database, stores, "readwrite", (context) => {
    for (const name of stores) {
      const store = context.transaction.objectStore(name)
      store.clear()
      for (const value of rows[name] ?? []) store.put(value)
    }
    context.setResult(undefined)
  })
}
function raw(database: IDBDatabase): Promise<Record<string, unknown[]>> {
  return runLocalTransaction(database, stores, "readonly", (context) => {
    const values: Record<string, unknown[]> = {}
    let remaining = stores.length
    for (const name of stores) {
      const request = context.transaction.objectStore(name).getAll()
      request.onsuccess = () => {
        values[name] = request.result
        if (--remaining === 0) context.setResult(values)
      }
    }
  })
}
function confirmations() {
  const local = item()
  const itemSender = crypto.randomUUID()
  const personalSender = crypto.randomUUID()
  const itemIntent = outboxEntrySchema.parse({
    ...itemEntry(local.id),
    state: "sending",
    attempts: 1,
    lease: { ownerId: itemSender, expiresAt: "2026-10-09T00:02:00.000Z" },
  })
  const tagId = crypto.randomUUID()
  const tag = tagSchema.parse({
    id: tagId,
    userId,
    name: "Fixture category",
    normalizedName: "fixture category",
    color: "#123456",
    position: 1024,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const personalIntent = outboxEntrySchema.parse({
    ...itemIntent,
    entityKey: `tag:${tagId}`,
    sequence: 2,
    lease: { ownerId: personalSender, expiresAt: "2026-10-09T00:02:00.000Z" },
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "tag.save",
        tagId,
        input: { name: tag.name, color: tag.color, position: tag.position },
      },
    },
  })
  const remoteItem = { ...local, revision: 1 }
  const remoteTag = { ...tag, revision: 1 }
  const itemSubmission: LocalSyncResultInputV2 = {
    operation: itemIntent.operation,
    senderId: itemSender,
    result: {
      kind: "item",
      outcome: {
        operationId: itemIntent.operation.operationId,
        status: "applied",
        item: remoteItem,
        sequence: 1,
      },
    },
  }
  const personalSubmission: LocalSyncResultInputV2 = {
    operation: personalIntent.operation,
    senderId: personalSender,
    result: {
      kind: "preference",
      outcome: {
        operationId: personalIntent.operation.operationId,
        status: "applied",
        effects: {
          version: 1,
          userId,
          operationId: personalIntent.operation.operationId,
          sequence: 2,
          effects: [{ store: "tags", record: remoteTag }],
        },
      },
    },
  }
  return {
    local,
    tag,
    itemIntent,
    personalIntent,
    remoteItem,
    remoteTag,
    itemSubmission,
    personalSubmission,
  }
}

async function run() {
  let database = await openLocalDatabase(userId)
  const other = await openLocalDatabase(otherUserId)
  let store = await LocalMixedSyncStore.open(userId)
  let passed = false
  try {
    await check(
      "Snapshot atómico conserva cola completa, clones e historia al reabrir",
      async () => {
        const first = item()
        const second = item()
        const parent = itemEntry(first.id)
        const dependent = outboxEntrySchema.parse({
          ...itemEntry(second.id, 2),
          dependencies: [parent.operation.operationId],
          state: "rejected",
          attempts: 3,
        })
        await seed(database, {
          items: [first, second],
          outbox: [parent, dependent],
          syncMetadata: [
            { key: "fixture-history", value: "Retained literal history" },
          ],
        })
        const before = JSON.stringify(await raw(database))
        const state = await store.readQueueState()
        assert(
          state.entries.length === 2 && state.items.length === 2,
          "complete atomic queue snapshot"
        )
        state.entries[0].dependencies.push(crypto.randomUUID())
        state.items[0].title = "Changed returned clone"
        assert(
          JSON.stringify(await raw(database)) === before,
          "returned clones do not alter durable data"
        )
        assert(
          (await store.readPullCursor()).after === 0,
          "default cursor is readonly"
        )
        store.close()
        database.close()
        store = await LocalMixedSyncStore.open(userId)
        database = await openLocalDatabase(userId)
        assert(
          JSON.stringify(await raw(database)) === before,
          "reopening retains every record and history"
        )
        const reopened = await store.readQueueState()
        assert(
          reopened.entries.find(
            (entry) =>
              entry.operation.operationId === dependent.operation.operationId
          )?.state === "rejected",
          "terminal dependent is not dropped"
        )
      }
    )
    await check(
      "Cuenta, dependencias y secuencias corruptas se rechazan sin perder historia",
      async () => {
        const first = item()
        const second = item()
        const entry = itemEntry(first.id)
        for (const rows of [
          { items: [{ ...first, ownerId: otherUserId }], outbox: [entry] },
          { items: [first], outbox: [{ ...entry, userId: otherUserId }] },
          {
            items: [first],
            outbox: [{ ...entry, dependencies: [crypto.randomUUID()] }],
          },
          {
            items: [first],
            outbox: [
              {
                ...entry,
                operation: { ...entry.operation, protocolVersion: 2 },
              },
            ],
          },
        ]) {
          await seed(database, rows)
          const before = JSON.stringify(await raw(database))
          await refused(() => store.readQueueState())
          assert(
            JSON.stringify(await raw(database)) === before,
            "invalid snapshot never writes or removes evidence"
          )
        }
        await seed(database, { items: [first], outbox: [entry] })
        const beforeDuplicate = JSON.stringify(await raw(database))
        await refused(() =>
          seed(database, {
            items: [first, second],
            outbox: [entry, itemEntry(second.id, 1)],
          })
        )
        assert(
          JSON.stringify(await raw(database)) === beforeDuplicate,
          "the unique sequence index rejects duplicate writes and rolls back the complete transaction"
        )
      }
    )
    await check(
      "La fila 10001 en contenido o cola se rechaza sin truncar ni escribir",
      async () => {
        const source = item()
        const items = Array.from({ length: 10001 }, () => ({
          ...source,
          id: crypto.randomUUID(),
        }))
        await seed(database, { items })
        await refused(() => store.readQueueState())
        assert(
          (await raw(database)).items.length === 10001,
          "all item rows remain stored"
        )
        const prototype = itemEntry(source.id)
        const entries = Array.from({ length: 10001 }, (_, index) => ({
          ...prototype,
          sequence: index + 1,
          operation: {
            ...prototype.operation,
            operationId: crypto.randomUUID(),
          },
        }))
        await seed(database, { items: [source], outbox: entries })
        await refused(() => store.readQueueState())
        assert(
          (await raw(database)).outbox.length === 10001,
          "all intention rows remain stored"
        )
      }
    )
    await check(
      "Dispatch item y personal confirma sólo leases válidos y conserva replay tras pull mixto",
      async () => {
        const value = confirmations()
        await seed(database, {
          items: [value.local],
          tags: [value.tag],
          outbox: [value.itemIntent, value.personalIntent],
        })
        const beforeWrong = JSON.stringify(await raw(database))
        await refused(() =>
          store.applyOperationResult({
            ...value.itemSubmission,
            senderId: crypto.randomUUID(),
          })
        )
        await refused(() =>
          store.applyOperationResult({
            ...value.personalSubmission,
            senderId: crypto.randomUUID(),
          })
        )
        assert(
          JSON.stringify(await raw(database)) === beforeWrong,
          "wrong senders do not confirm either family"
        )
        assert(
          (await store.applyOperationResult(value.itemSubmission)) ===
            "applied",
          "item result dispatch commits"
        )
        assert(
          (await store.applyOperationResult(value.personalSubmission)) ===
            "applied",
          "personal result dispatch commits"
        )
        assert(
          (await store.readQueueState()).entries.every(
            (entry) => entry.state === "acknowledged"
          ),
          "both ACKs are durable"
        )
        const receipt = {
          query: { after: 0, through: null, limit: 2 },
          page: {
            version: 2,
            changes: [
              {
                version: 2,
                kind: "item",
                recipientUserId: userId,
                operationId: value.itemIntent.operation.operationId,
                sequence: 1,
                item: value.remoteItem,
              },
              {
                version: 2,
                kind: "preference",
                recipientUserId: userId,
                operationId: value.personalIntent.operation.operationId,
                sequence: 2,
                effects: {
                  version: 1,
                  userId,
                  operationId: value.personalIntent.operation.operationId,
                  sequence: 2,
                  effects: [{ store: "tags", record: value.remoteTag }],
                },
              },
            ],
            nextAfter: 2,
            through: 2,
            hasMore: false,
          },
        }
        assert(
          (await store.applyChangesPage(receipt)) === "applied",
          "mixed page commits through the wrapper"
        )
        assert(
          (await store.readPullCursor()).after === 2,
          "mixed cursor advanced atomically"
        )
        const beforeReplay = JSON.stringify(await raw(database))
        assert(
          (await store.applyChangesPage(receipt)) === "ignored",
          "stale page ignored"
        )
        assert(
          (await store.applyOperationResult(value.itemSubmission)) ===
            "replayed",
          "legacy item outcome replays after versioned shadow"
        )
        assert(
          (await store.applyOperationResult(value.personalSubmission)) ===
            "replayed",
          "personal outcome replays after mixed download"
        )
        assert(
          JSON.stringify(await raw(database)) === beforeReplay,
          "replays preserve all outcomes, intentions and cursor literally"
        )
        store.close()
        store = await LocalMixedSyncStore.open(userId)
        assert(
          (await store.readPullCursor()).after === 2 &&
            (await store.readQueueState()).entries.length === 2,
          "reopened wrapper reads the completed mixed checkpoint and full history"
        )
      }
    )
    await check(
      "Correspondencia y partición se validan antes de cualquier transacción",
      async () => {
        const value = confirmations()
        const before = JSON.stringify(await raw(database))
        if (
          value.personalSubmission.result.kind !== "preference" ||
          value.personalSubmission.result.outcome.status !== "applied"
        )
          throw new Error("Fixture personal result is malformed")
        const outcome = value.personalSubmission.result.outcome
        await refused(() =>
          store.applyOperationResult({
            ...value.personalSubmission,
            result: {
              kind: "preference",
              outcome: {
                ...outcome,
                effects: {
                  ...outcome.effects,
                  userId: otherUserId,
                  effects: outcome.effects.effects.map((effect) => ({
                    ...effect,
                    record: { ...effect.record, userId: otherUserId },
                  })),
                },
              },
            },
          })
        )
        const internals = store as unknown as { database: IDBDatabase }
        const owned = internals.database
        internals.database = other
        let transactions = 0
        const original = other.transaction
        other.transaction = function (...parameters) {
          transactions++
          return original.apply(this, parameters)
        }
        try {
          await refused(() => store.readQueueState())
          await refused(() => store.readPullCursor())
          await refused(() => store.applyChangesPage({}))
          await refused(() => store.applyOperationResult(value.itemSubmission))
          assert(
            transactions === 0,
            "wrong database rejected before any transaction"
          )
        } finally {
          other.transaction = original
          internals.database = owned
        }
        assert(
          JSON.stringify(await raw(database)) === before,
          "rejections preserve all stored history"
        )
      }
    )
    await check(
      "Apertura parcial fallida y cierre idempotente liberan sus conexiones propias",
      async () => {
        store.close()
        store.close()
        await refused(() => store.readQueueState())
        const originalOpen = IDBFactory.prototype.open
        const originalItemOpen = LocalSyncStore.open
        let captured: IDBDatabase | null = null
        IDBFactory.prototype.open = function (name: string, version?: number) {
          const request = originalOpen.call(this, name, version)
          if (name === localDatabaseName(userId))
            request.addEventListener("success", () => {
              captured = request.result
            })
          return request
        }
        LocalSyncStore.open = async () => {
          throw new Error("Injected second connection failure")
        }
        try {
          await refused(() => LocalMixedSyncStore.open(userId))
          assert(
            captured,
            "first connection was opened before the injected failure"
          )
          await refused(() =>
            (captured as IDBDatabase).transaction("items", "readonly")
          )
        } finally {
          IDBFactory.prototype.open = originalOpen
          LocalSyncStore.open = originalItemOpen
        }
        store = await LocalMixedSyncStore.open(userId)
        assert(
          (await store.readQueueState()).entries.length === 2,
          "partial failure preserves durable intentions"
        )
      }
    )
    passed = true
    statusElement.textContent =
      "Seis comprobaciones correctas; limpiando recursos propios"
  } catch (error) {
    statusElement.textContent = `Prueba fallida: ${error instanceof Error ? error.message : "error"}`
  } finally {
    store.close()
    database.close()
    other.close()
    try {
      for (const id of [userId, otherUserId])
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(localDatabaseName(id))
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
          request.onblocked = () =>
            reject(new Error("Mixed store cleanup blocked"))
        })
    } catch {
      passed = false
    }
    statusElement.textContent += passed
      ? "; bases ficticias eliminadas"
      : "; revisar fallo"
    await fetch(passed ? "/fixture-pass" : "/fixture-fail", {
      method: "POST",
      headers: { "x-sync-test-run": runId },
      cache: "no-store",
    })
  }
}
runButton.onclick = () => {
  runButton.disabled = true
  void run()
}
