import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { placementResolutionStoreNames } from "@/lib/local-db/placement-resolution-capture"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import type { PlacementResolutionRequest } from "@/types/placement-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Placement proof requires its isolated loopback origin")
const runId = entityIdSchema.parse(
    new URLSearchParams(location.search).get("run")
  ),
  actor = `browser-test-${runId}-placement`,
  name = localDatabaseName(actor),
  statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Proof status missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Owned placement partition already exists"
  )
  const f = placementResolutionFixture(actor),
    database = await openLocalDatabase(actor),
    store = await LocalSyncStore.open(actor)
  let checks = 0,
    notices = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  async function write(work: (tx: IDBTransaction) => void) {
    return runLocalTransaction(
      database,
      placementResolutionStoreNames,
      "readwrite",
      (context) => {
        work(context.transaction)
        context.setResult(true)
      }
    )
  }
  async function seed() {
    await write((tx) => {
      for (const key of placementResolutionStoreNames)
        tx.objectStore(key).clear()
      for (const item of f.items) {
        tx.objectStore("items").add(item)
        tx.objectStore("remoteShadows").add({
          version: 2,
          kind: "item",
          entityKey: `item:${item.id}`,
          record: item,
        })
      }
      for (const view of f.local.views) {
        tx.objectStore("itemViews").add(view)
        tx.objectStore("remoteShadows").add({
          version: 2,
          kind: "preference",
          entityKey: `item-view:${view.itemId}`,
          record: { store: "itemViews", record: view },
        })
      }
      for (const placement of f.local.placements)
        tx.objectStore("taskPlacements").add(placement)
      for (const shadow of f.input.shadows)
        tx.objectStore("remoteShadows").add(shadow)
      for (const entry of [f.entry, f.child])
        tx.objectStore("outbox").add(entry)
      tx.objectStore("syncMetadata").add(f.outcome)
      tx.objectStore("syncMetadata").add({ key: "outbox-sequence", value: 2 })
      tx.objectStore("syncMetadata").add({
        key: "preference-tail",
        operationId: f.child.operation.operationId,
      })
    })
  }
  async function raw() {
    return runLocalTransaction<Record<string, unknown[]>>(
      database,
      placementResolutionStoreNames,
      "readonly",
      (context) => {
        const data: Record<string, unknown[]> = {}
        let remaining = placementResolutionStoreNames.length
        for (const name of placementResolutionStoreNames) {
          const request = context.transaction.objectStore(name).getAll()
          request.onsuccess = () => {
            data[name] = request.result
            if (!--remaining) context.setResult(data)
          }
        }
      }
    )
  }
  async function backup() {
    return (await readLocalRecurringBackup(database, actor, f.now)).stores
  }
  async function request(retry = true): Promise<PlacementResolutionRequest> {
    return {
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: retry ? crypto.randomUUID() : null,
      choice: retry ? "retry_latest_move" : "adopt_remote",
      createdAt: f.now,
      expected: await store.readPlacementIncidentSnapshot(
        f.entry.operation.operationId
      ),
    }
  }
  async function rejects(work: () => Promise<unknown>) {
    const before = JSON.stringify(await raw()),
      count = notices
    let failed = false
    try {
      await work()
    } catch {
      failed = true
    }
    assert(
      failed && JSON.stringify(await raw()) === before && count === notices,
      "Rejected placement work changed durable state or notified"
    )
  }
  async function check(label: string, work: () => Promise<void>) {
    await seed()
    await work()
    checks++
    const li = document.createElement("li")
    li.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(li)
  }
  try {
    await check(
      "Captura completa readonly y reapertura conservan historia",
      async () => {
        const before = JSON.stringify(await raw()),
          snapshot = await store.readPlacementIncidentSnapshot(
            f.entry.operation.operationId
          )
        assert(
          JSON.stringify(snapshot) === JSON.stringify(f.snapshot) &&
            before === JSON.stringify(await raw()),
          "Readonly capture changed evidence"
        )
        const reopened = await LocalSyncStore.open(actor)
        try {
          assert(
            JSON.stringify(
              await reopened.readPlacementIncidentSnapshot(
                f.entry.operation.operationId
              )
            ) === JSON.stringify(snapshot),
            "Reopened capture differs"
          )
        } finally {
          reopened.close()
        }
      }
    )
    await check(
      "Actor, comparación obsoleta y sombra ausente rechazan sin escribir",
      async () => {
        const input = await request()
        await rejects(() =>
          store.resolvePlacementIncident({ ...input, userId: "foreign" })
        )
        const expected = structuredClone(input.expected)
        expected.local.placements[0].position++
        await rejects(() =>
          store.resolvePlacementIncident({ ...input, expected })
        )
        await write((tx) =>
          tx.objectStore("remoteShadows").delete(`item:${f.items[0].id}`)
        )
        await rejects(() =>
          store.readPlacementIncidentSnapshot(f.entry.operation.operationId)
        )
      }
    )
    await check(
      "Fallo tardío revierte rangos, cola, contador, tail y recibo",
      async () => {
        const input = await request(),
          add = IDBObjectStore.prototype.add
        IDBObjectStore.prototype.add = function (
          value: unknown,
          key?: IDBValidKey
        ) {
          if (
            this.name === "syncMetadata" &&
            value &&
            typeof value === "object" &&
            "key" in value &&
            value.key === `placement-resolution:${input.resolutionId}`
          )
            throw new Error("Owned late receipt failure")
          return key === undefined
            ? add.call(this, value)
            : add.call(this, value, key)
        }
        try {
          await rejects(() => store.resolvePlacementIncident(input))
        } finally {
          IDBObjectStore.prototype.add = add
        }
      }
    )
    await check(
      "Otros pendientes, slots y referencias incompletas siguen protegidos",
      async () => {
        await write((tx) =>
          tx.objectStore("outbox").add({
            ...f.child,
            sequence: 3,
            entityKey: `item:${f.items[1].id}`,
            dependencies: [],
            operation: {
              ...f.child.operation,
              operationId: crypto.randomUUID(),
              command: {
                type: "plan.set-status",
                itemId: f.items[1].id,
                status: "completed",
              },
            },
          })
        )
        await rejects(() =>
          store.readPlacementIncidentSnapshot(f.entry.operation.operationId)
        )
      }
    )
    await check(
      "IDs globales, counter agotado y tail corrupto rechazan atómicamente",
      async () => {
        const input = await request()
        await rejects(() =>
          store.resolvePlacementIncident({
            ...input,
            resolutionId: f.child.operation.operationId,
          })
        )
        await rejects(() =>
          store.resolvePlacementIncident({
            ...input,
            operationId: f.entry.operation.operationId,
          })
        )
        await write((tx) =>
          tx
            .objectStore("syncMetadata")
            .put({ key: "outbox-sequence", value: Number.MAX_SAFE_INTEGER })
        )
        await rejects(() => store.resolvePlacementIncident(input))
        await write((tx) => {
          tx.objectStore("syncMetadata").put({
            key: "outbox-sequence",
            value: 2,
          })
          tx.objectStore("syncMetadata").put({
            key: "preference-tail",
            operationId: crypto.randomUUID(),
          })
        })
        await rejects(() => store.resolvePlacementIncident(input))
      }
    )
    await check(
      "Capacidad postwrite cuenta también el tail ausente",
      async () => {
        const input = await request()
        await write((tx) => {
          tx.objectStore("syncMetadata").delete("preference-tail")
          for (let index = 0; index < 9997; index++)
            tx.objectStore("syncMetadata").add({
              key: `owned-capacity:${index}`,
              value: index,
            })
        })
        await rejects(() => store.resolvePlacementIncident(input))
      }
    )
    await check(
      "ACK capturado necesita su outcome aplicado durable",
      async () => {
        const ack = {
            ...f.entry,
            state: "acknowledged",
            sequence: 1,
            operation: {
              ...f.entry.operation,
              operationId: crypto.randomUUID(),
            },
          },
          root = {
            ...f.entry,
            sequence: 2,
            dependencies: [ack.operation.operationId],
          },
          child = { ...f.child, sequence: 3 }
        await write((tx) => {
          tx.objectStore("outbox").put(child)
          tx.objectStore("outbox").put(root)
          tx.objectStore("outbox").put(ack)
          tx.objectStore("syncMetadata").put({
            key: "outbox-sequence",
            value: 3,
          })
        })
        await rejects(() =>
          store.readPlacementIncidentSnapshot(f.entry.operation.operationId)
        )
        await write((tx) =>
          tx.objectStore("syncMetadata").add({
            ...f.outcome,
            key: `operation-outcome:${ack.operation.operationId}`,
            operation: ack.operation,
            result: {
              kind: "preference",
              outcome: {
                status: "applied",
                operationId: ack.operation.operationId,
                effects: {
                  version: 1,
                  userId: actor,
                  operationId: ack.operation.operationId,
                  sequence: 1,
                  effects: [
                    {
                      store: "taskPlacements",
                      record: f.observed.placements[0],
                    },
                  ],
                },
              },
            },
          })
        )
        const input = await request(false)
        assert(
          input.expected.acknowledgedDependencies.length === 1,
          "Proven prerequisite missing"
        )
        await store.resolvePlacementIncident(input)
        await backup()
      }
    )
    await check(
      "Reintento pending sin ACK y replay no retrocede cambios posteriores",
      async () => {
        const input = await request(),
          before = await backup(),
          count = notices,
          result = await store.resolvePlacementIncident(input),
          decided = await backup()
        assert(
          result.status === "applied" && notices > count,
          "Committed recovery did not notify after commit"
        )
        for (const old of [f.entry, f.child])
          assert(
            JSON.stringify(
              decided.outbox.find(
                (entry) =>
                  entry.operation.operationId === old.operation.operationId
              )
            ) === JSON.stringify({ ...old, state: "superseded" }),
            "Original movement changed"
          )
        const retry = decided.outbox.find(
          (entry) => entry.operation.operationId === input.operationId
        )
        assert(
          retry?.state === "pending" &&
            retry.attempts === 0 &&
            retry.sequence === 3 &&
            !retry.dependencies.length,
          "Recovery manufactured ACK or detached pending chain"
        )
        for (const name of [
          "items",
          "itemViews",
          "tags",
          "occurrences",
          "settings",
          "remoteShadows",
        ] as const)
          assert(
            JSON.stringify(before[name]) === JSON.stringify(decided[name]),
            "Recovery changed another domain"
          )
        await write((tx) =>
          tx
            .objectStore("taskPlacements")
            .put({ ...f.local.placements[1], position: 9876 })
        )
        const later = JSON.stringify(await raw()),
          notice = notices,
          replayed = await store.resolvePlacementIncident(input)
        assert(
          replayed.status === "replayed" &&
            later === JSON.stringify(await raw()) &&
            notice === notices,
          "Replay rewrote later work or notified"
        )
        const reopened = await LocalSyncStore.open(actor)
        try {
          assert(
            (await reopened.resolvePlacementIncident(input)).status ===
              "replayed",
            "Decision receipt did not survive reopen"
          )
        } finally {
          reopened.close()
        }
        await backup()
      }
    )
    await check(
      "Adopción conserva catálogo observado sin operación ni counter nuevo",
      async () => {
        const input = await request(false),
          result = await store.resolvePlacementIncident(input),
          saved = await backup()
        assert(
          result.status === "applied" &&
            saved.outbox.length === 2 &&
            saved.outbox.every((entry) => entry.state === "superseded"),
          "Adoption produced an operation or lost history"
        )
        assert(
          saved.taskPlacements.every(
            (record) =>
              JSON.stringify(record) ===
              JSON.stringify(
                f.observed.placements.find(
                  (value) => value.occurrenceId === record.occurrenceId
                )
              )
          ),
          "Adoption differs from observed ranks"
        )
        assert(
          saved.syncMetadata.some(
            (value) =>
              value.key === "outbox-sequence" &&
              "value" in value &&
              value.value === 2
          ),
          "Adoption changed counter"
        )
      }
    )
    status.textContent = `${checks} comprobaciones IndexedDB correctas; partición propia eliminada`
  } finally {
    unsubscribe()
    store.close()
    database.close()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned placement cleanup blocked"))
    })
  }
}
run().catch((error) => {
  status.textContent = `Error: ${error instanceof Error ? error.message : "Unknown failure"}`
  console.error(error)
})
