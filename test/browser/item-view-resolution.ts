import { itemViewResolutionFixture } from "@/lib/backup/item-view-resolution-fixture"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { itemViewResolutionStoreNames } from "@/lib/local-db/item-view-resolution-capture"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { captureItemViewResolutionSnapshot } from "@/lib/sync/item-view-resolution"
import { entityIdSchema } from "@/schemas/primitives"
import type { ItemViewResolutionRequest } from "@/types/item-view-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Assignment proof requires its own loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-view-resolution`,
  name = localDatabaseName(actor)
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Proof status is missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Owned partition already exists"
  )
  const f = itemViewResolutionFixture("note", actor),
    database = await openLocalDatabase(actor),
    store = await LocalSyncStore.open(actor)
  let notices = 0,
    checks = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  async function seed() {
    await runLocalTransaction(
      database,
      itemViewResolutionStoreNames,
      "readwrite",
      (context) => {
        for (const name of itemViewResolutionStoreNames)
          context.transaction.objectStore(name).clear()
        context.transaction.objectStore("items").add(f.parent)
        context.transaction.objectStore("tags").add(f.tag)
        context.transaction.objectStore("itemViews").add(f.local)
        for (const entry of f.input.entries)
          context.transaction.objectStore("outbox").add(entry)
        context.transaction.objectStore("syncMetadata").add(f.outcome)
        context.transaction
          .objectStore("syncMetadata")
          .add({ key: "outbox-sequence", value: 2 })
        context.setResult(true)
      }
    )
  }
  async function raw() {
    return runLocalTransaction<Record<string, unknown[]>>(
      database,
      itemViewResolutionStoreNames,
      "readonly",
      (context) => {
        const snapshot: Record<string, unknown[]> = {}
        let remaining = itemViewResolutionStoreNames.length
        for (const name of itemViewResolutionStoreNames) {
          const request = context.transaction.objectStore(name).getAll()
          request.onsuccess = () => {
            snapshot[name] = request.result
            if (!--remaining) context.setResult(snapshot)
          }
        }
      }
    )
  }
  async function backup() {
    return (await readLocalRecurringBackup(database, actor, f.now)).stores
  }
  async function request(
    choice: "adopt_remote" | "retry_local" = "retry_local"
  ): Promise<ItemViewResolutionRequest> {
    return {
      ...f.request,
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: choice === "retry_local" ? crypto.randomUUID() : null,
      choice,
      expected: await store.readItemViewIncidentSnapshot(
        f.entry.operation.operationId
      ),
    }
  }
  async function rejected(input: unknown) {
    const before = JSON.stringify(await raw()),
      previous = notices
    let failed = false
    try {
      await store.resolveItemViewIncident(input)
    } catch {
      failed = true
    }
    assert(
      failed && before === JSON.stringify(await raw()) && previous === notices,
      "Rejected assignment changed data or notified"
    )
  }
  async function check(label: string, work: () => Promise<void>) {
    await work()
    checks++
    const row = document.createElement("li")
    row.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(row)
  }
  try {
    await seed()
    await check(
      "Captura readonly completa y reapertura conservan los datos",
      async () => {
        const before = JSON.stringify(await raw())
        await request()
        assert(
          before === JSON.stringify(await raw()),
          "Capture mutated durable state"
        )
        const reopened = await LocalSyncStore.open(actor)
        try {
          assert(
            JSON.stringify(
              await reopened.readItemViewIncidentSnapshot(
                f.entry.operation.operationId
              )
            ) === JSON.stringify(f.current),
            "Reopened capture differs"
          )
        } finally {
          reopened.close()
        }
      }
    )
    await check("Cuenta y comparación obsoleta no escriben", async () => {
      const input = await request()
      await rejected({ ...input, userId: "foreign" })
      await rejected({
        ...input,
        expected: {
          ...input.expected,
          parent: { ...input.expected.parent, title: "Stale title" },
        },
      })
    })
    await check(
      "Fallo tardío revierte vista, cola, contador y recibo",
      async () => {
        const input = await request(),
          add = IDBObjectStore.prototype.add
        IDBObjectStore.prototype.add = function (
          value: unknown,
          key?: IDBValidKey
        ) {
          if (
            this.transaction.db.name === name &&
            this.name === "syncMetadata" &&
            value &&
            typeof value === "object" &&
            "key" in value &&
            String(value.key).startsWith("item-view-resolution:")
          )
            throw new Error("Owned late receipt failure")
          return add.call(this, value, key)
        }
        try {
          await rejected(input)
        } finally {
          IDBObjectStore.prototype.add = add
        }
      }
    )
    await check(
      "Cambios pendientes del mismo plan bloquean una decisión parcial",
      async () => {
        const input = await request()
        await runLocalTransaction(
          database,
          ["outbox", "syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("outbox").add({
              ...f.child,
              sequence: 3,
              dependencies: [],
              entityKey: `item:${f.parent.id}`,
              operation: {
                ...f.child.operation,
                operationId: crypto.randomUUID(),
                command: {
                  type: "plan.set-status",
                  itemId: f.parent.id,
                  status: "completed",
                },
              },
            })
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 3 })
            context.setResult(true)
          }
        )
        await rejected(input)
        await seed()
      }
    )
    await check("IDs usados y contador agotado conservan todo", async () => {
      const input = await request()
      await rejected({ ...input, operationId: f.entry.operation.operationId })
      await runLocalTransaction(
        database,
        ["syncMetadata"],
        "readwrite",
        (context) => {
          context.transaction
            .objectStore("syncMetadata")
            .put({ key: "outbox-sequence", value: Number.MAX_SAFE_INTEGER })
          context.setResult(true)
        }
      )
      await rejected(input)
      await seed()
    })
    await check(
      "Capacidad de evidencia se valida antes de escribir",
      async () => {
        const input = await request()
        await runLocalTransaction(
          database,
          ["syncMetadata"],
          "readwrite",
          (context) => {
            for (let index = 0; index < 9998; index++)
              context.transaction
                .objectStore("syncMetadata")
                .add({ key: `owned-capacity:${index}` })
            context.setResult(true)
          }
        )
        await rejected(input)
        await seed()
      }
    )
    await check(
      "Un ACK en el DTO no sustituye su resultado durable",
      async () => {
        const ancestor = {
          ...f.entry,
          state: "acknowledged" as const,
          sequence: 1,
          dependencies: [],
          operation: {
            ...f.entry.operation,
            operationId: crypto.randomUUID(),
            baseRevision: 0,
          },
        }
        const chain = f.input.entries.map((entry) => ({
          ...entry,
          sequence: entry.sequence + 1,
          dependencies:
            entry.sequence === 1
              ? [ancestor.operation.operationId]
              : entry.dependencies,
        }))
        await runLocalTransaction(
          database,
          ["outbox", "syncMetadata"],
          "readwrite",
          (context) => {
            const outbox = context.transaction.objectStore("outbox")
            outbox.clear()
            for (const entry of [ancestor, ...chain]) outbox.add(entry)
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 3 })
            context.setResult(true)
          }
        )
        const expected = captureItemViewResolutionSnapshot({
          ...f.capture,
          entries: [ancestor, ...chain],
          incident: {
            ...f.capture.incident,
            entry: chain[0],
            intentions: chain,
          },
        })
        await rejected({ ...f.request, expected })
        let failed = false
        try {
          await store.readItemViewIncidentSnapshot(
            f.entry.operation.operationId
          )
        } catch {
          failed = true
        }
        assert(failed, "Read comparison offered a choice from an unproved ACK")
        const applied = {
          ...f.outcome,
          key: `operation-outcome:${ancestor.operation.operationId}`,
          operation: ancestor.operation,
          result: {
            kind: "preference",
            outcome: {
              status: "applied",
              operationId: ancestor.operation.operationId,
              effects: {
                version: 1,
                userId: actor,
                operationId: ancestor.operation.operationId,
                sequence: 1,
                effects: [{ store: "itemViews", record: f.local }],
              },
            },
          },
        }
        await runLocalTransaction(
          database,
          ["syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("syncMetadata").add(applied)
            context.setResult(true)
          }
        )
        const input = await request()
        await store.resolveItemViewIncident(input)
        await backup()
        await seed()
      }
    )
    await check(
      "Retry crea una intención pendiente sin ACK ni cambios a plan/categoría/orden",
      async () => {
        const input = await request(),
          before = await backup(),
          previous = notices
        const result = await store.resolveItemViewIncident(input),
          after = await backup()
        assert(
          result.status === "applied" && notices > previous,
          "Committed assignment did not notify"
        )
        for (const key of [
          "items",
          "tags",
          "taskPlacements",
          "occurrences",
          "settings",
        ] as const)
          assert(
            JSON.stringify(after[key]) === JSON.stringify(before[key]),
            "Assignment modified another domain"
          )
        assert(
          after.outbox.length === 3 &&
            after.outbox.filter((v) => v.state === "acknowledged").length === 0,
          "Local choice manufactured ACK"
        )
        for (const old of before.outbox)
          assert(
            JSON.stringify(
              after.outbox.find(
                (e) => e.operation.operationId === old.operation.operationId
              )
            ) === JSON.stringify({ ...old, state: "superseded" }),
            "Original intention changed"
          )
        const replacement = after.outbox.find(
          (e) => e.operation.operationId === input.operationId
        )
        assert(
          replacement?.state === "pending" &&
            replacement.attempts === 0 &&
            replacement.dependencies.length === 0 &&
            replacement.operation.baseRevision === 2,
          "Retry lost CAS or identity"
        )
        await runLocalTransaction(
          database,
          ["itemViews"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("itemViews")
              .put({ ...result.record.local, primaryTagId: null })
            context.setResult(true)
          }
        )
        const later = JSON.stringify(await raw()),
          prior = notices
        assert(
          (await store.resolveItemViewIncident(input)).status === "replayed" &&
            later === JSON.stringify(await raw()) &&
            prior === notices,
          "Replay overwrote later edit or notified"
        )
        await rejected({ ...input, createdAt: "2026-10-18T16:00:00.000Z" })
      }
    )
    await seed()
    await check(
      "Adopción no genera operación ni avanza contador y persiste",
      async () => {
        const input = await request("adopt_remote")
        await store.resolveItemViewIncident(input)
        const after = await backup()
        assert(
          after.outbox.length === 2 &&
            JSON.stringify(after.itemViews[0]) === JSON.stringify(f.remote),
          "Adoption changed history or wrong view"
        )
        assert(
          after.syncMetadata.some(
            (v) => v.key === "outbox-sequence" && "value" in v && v.value === 2
          ),
          "Adoption advanced counter"
        )
        const reopened = await LocalSyncStore.open(actor)
        try {
          assert(
            (await reopened.readSettingsIncidentOverview()).length === 0,
            "Reopened adoption unresolved"
          )
        } finally {
          reopened.close()
        }
      }
    )
  } finally {
    unsubscribe()
    store.close()
    database.close()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned assignment cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
