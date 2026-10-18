import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { commitLocalPreferenceCommand } from "@/lib/local-db/preference-outbox"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { tagOrderResolutionStoreNames } from "@/lib/local-db/tag-order-resolution-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { compareRank } from "@/lib/ordering/rank"
import { captureTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import { entityIdSchema } from "@/schemas/primitives"
import type { TagOrderResolutionRequest } from "@/types/tag-order-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Category order proof requires its own loopback origin")
const runId = entityIdSchema.parse(
    new URLSearchParams(location.search).get("run")
  ),
  actor = `browser-test-${runId}-tag-order`,
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
  const f = tagOrderResolutionFixture(actor),
    database = await openLocalDatabase(actor),
    store = await LocalSyncStore.open(actor)
  let checks = 0,
    notices = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  async function write(work: (tx: IDBTransaction) => void) {
    return runLocalTransaction(
      database,
      tagOrderResolutionStoreNames,
      "readwrite",
      (context) => {
        work(context.transaction)
        context.setResult(true)
      }
    )
  }
  async function seed() {
    await write((tx) => {
      for (const key of tagOrderResolutionStoreNames)
        tx.objectStore(key).clear()
      for (const tag of f.local) tx.objectStore("tags").add(tag)
      for (const shadow of f.input.shadows)
        tx.objectStore("remoteShadows").add(shadow)
      for (const entry of f.input.entries) tx.objectStore("outbox").add(entry)
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
      tagOrderResolutionStoreNames,
      "readonly",
      (context) => {
        const result: Record<string, unknown[]> = {}
        let remaining = tagOrderResolutionStoreNames.length
        for (const key of tagOrderResolutionStoreNames) {
          const read = context.transaction.objectStore(key).getAll()
          read.onsuccess = () => {
            result[key] = read.result
            if (!--remaining) context.setResult(result)
          }
        }
      }
    )
  }
  async function backup() {
    return (await readLocalRecurringBackup(database, actor, f.now)).stores
  }
  async function request(retry = true): Promise<TagOrderResolutionRequest> {
    return {
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: retry ? crypto.randomUUID() : null,
      choice: retry ? "retry_latest_move" : "adopt_remote",
      createdAt: f.now,
      expected: await store.readTagOrderIncidentSnapshot(
        f.entry.operation.operationId
      ),
    }
  }
  async function rejected(input: unknown) {
    const before = JSON.stringify(await raw()),
      previous = notices
    let failed = false
    try {
      await store.resolveTagOrderIncident(input)
    } catch {
      failed = true
    }
    assert(
      failed && before === JSON.stringify(await raw()) && previous === notices,
      "Rejected order decision mutated data or notified"
    )
  }
  async function captureRejected() {
    let failed = false
    try {
      await store.readTagOrderIncidentSnapshot(f.entry.operation.operationId)
    } catch {
      failed = true
    }
    assert(failed, "Incomplete order capture offered choices")
  }
  async function check(label: string, work: () => Promise<void>) {
    await work()
    checks++
    const li = document.createElement("li")
    li.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(li)
  }
  try {
    await seed()
    await check("Captura completa readonly y reapertura", async () => {
      const before = JSON.stringify(await raw()),
        input = await request()
      assert(
        JSON.stringify(input.expected) === JSON.stringify(f.snapshot),
        "Captured catalog differs"
      )
      assert(
        before === JSON.stringify(await raw()),
        "Read capture mutated data"
      )
      const reopened = await LocalSyncStore.open(actor)
      try {
        assert(
          JSON.stringify(
            await reopened.readTagOrderIncidentSnapshot(
              f.entry.operation.operationId
            )
          ) === JSON.stringify(input.expected),
          "Reopened capture differs"
        )
      } finally {
        reopened.close()
      }
    })
    await check(
      "Cuenta, revisión y catálogo obsoletos conservan todo",
      async () => {
        const input = await request()
        await rejected({ ...input, userId: "foreign" })
        const expected = structuredClone(input.expected)
        expected.localTags[1].position += 100
        await rejected({ ...input, expected })
        await write((tx) => {
          const remote = { ...f.observed[1], revision: 2, position: 55 }
          tx.objectStore("remoteShadows").put({
            version: 2,
            kind: "preference",
            entityKey: `tag:${remote.id}`,
            record: { store: "tags", record: remote },
          })
        })
        await rejected(input)
        await seed()
      }
    )
    await check(
      "Fallo de recibo revierte catálogo, cola, contador y tail",
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
            String(value.key).startsWith("tag-order-resolution:")
          )
            throw new Error("Owned late order receipt failure")
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
      "Prerrequisitos, dependientes y otras intenciones personales no se descartan",
      async () => {
        const input = await request()
        for (const command of [
          {
            type: "item-view.set",
            itemId: crypto.randomUUID(),
            primaryTagId: f.original[1].id,
          },
          {
            type: "tag.move",
            tagId: f.original[1].id,
            beforeId: null,
            afterId: null,
          },
        ]) {
          await write((tx) => {
            tx.objectStore("outbox").add({
              ...f.child,
              sequence: 3,
              dependencies: [],
              entityKey:
                command.type === "item-view.set"
                  ? `item-view:${command.itemId}`
                  : `tag:${command.tagId}`,
              operation: {
                ...f.child.operation,
                operationId: crypto.randomUUID(),
                command,
              },
            })
            tx.objectStore("syncMetadata").put({
              key: "outbox-sequence",
              value: 3,
            })
          })
          await rejected(input)
          await seed()
        }
      }
    )
    await check(
      "Sombras ausentes, incompletas o ajenas bloquean la captura",
      async () => {
        for (const mode of ["missing", "foreign", "oversized"]) {
          await write((tx) => {
            if (mode === "missing")
              tx.objectStore("remoteShadows").delete(`tag:${f.original[1].id}`)
            if (mode === "foreign")
              tx.objectStore("tags").put({ ...f.local[1], userId: "foreign" })
            if (mode === "oversized")
              for (let i = 0; i < 9999; i++) {
                const tag = {
                  ...f.local[1],
                  id: crypto.randomUUID(),
                  name: `Extra ${i}`,
                  normalizedName: `extra ${i}`,
                }
                tx.objectStore("tags").add(tag)
              }
          })
          await captureRejected()
          await seed()
        }
      }
    )
    await check(
      "IDs globales, contador atrasado y agotado bloquean antes de escribir",
      async () => {
        const input = await request()
        await rejected({ ...input, operationId: f.entry.operation.operationId })
        await write((tx) =>
          tx.objectStore("syncMetadata").add({
            key: "owned-other-decision",
            resolutionId: input.resolutionId,
          })
        )
        await rejected(input)
        await seed()
        for (const value of [1, Number.MAX_SAFE_INTEGER]) {
          await write((tx) =>
            tx
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value })
          )
          await rejected(input)
          await seed()
        }
      }
    )
    await check(
      "Capacidad incluye recibo y tail adicional sin borrar historia",
      async () => {
        const input = await request()
        for (const missingTail of [false, true]) {
          await write((tx) => {
            if (missingTail)
              tx.objectStore("syncMetadata").delete("preference-tail")
            for (let i = 0; i < 9997; i++)
              tx.objectStore("syncMetadata").add({ key: `owned-capacity:${i}` })
          })
          await rejected(input)
          await seed()
        }
      }
    )
    await check(
      "Tail ausente se crea con capacidad; tail corrupto no se repara",
      async () => {
        await write((tx) =>
          tx.objectStore("syncMetadata").delete("preference-tail")
        )
        const input = await request()
        await store.resolveTagOrderIncident(input)
        const after = await backup()
        assert(
          after.syncMetadata.some(
            (value) =>
              value.key === "preference-tail" &&
              "operationId" in value &&
              value.operationId === input.operationId
          ),
          "Missing tail was not created"
        )
        await seed()
        const pending = await request()
        await write((tx) =>
          tx
            .objectStore("syncMetadata")
            .put({ key: "preference-tail", operationId: crypto.randomUUID() })
        )
        await rejected(pending)
        await seed()
      }
    )
    await check("ACK capturado exige resultado aplicado real", async () => {
      const ancestor = {
          ...f.entry,
          state: "acknowledged" as const,
          sequence: 1,
          dependencies: [],
          operation: { ...f.entry.operation, operationId: crypto.randomUUID() },
        },
        chain = f.input.entries.map((entry) => ({
          ...entry,
          sequence: entry.sequence + 1,
          dependencies:
            entry.sequence === 1
              ? [ancestor.operation.operationId]
              : entry.dependencies,
        }))
      await write((tx) => {
        tx.objectStore("outbox").clear()
        for (const entry of [ancestor, ...chain])
          tx.objectStore("outbox").add(entry)
        tx.objectStore("syncMetadata").put({ key: "outbox-sequence", value: 3 })
      })
      const expected = captureTagOrderResolutionSnapshot({
        ...f.capture,
        entries: [ancestor, ...chain],
        incident: { ...f.capture.incident, entry: chain[0], intentions: chain },
      })
      await rejected({
        userId: actor,
        resolutionId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        choice: "retry_latest_move",
        createdAt: f.now,
        expected,
      })
      await captureRejected()
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
              effects: [{ store: "tags", record: f.original[0] }],
            },
          },
        },
      }
      await write((tx) => tx.objectStore("syncMetadata").add(applied))
      await store.resolveTagOrderIncident(await request())
      await backup()
      await seed()
    })
    await check(
      "Retry conserva historia, genera pending sin ACK y encadena otro movimiento",
      async () => {
        const input = await request(),
          before = await backup(),
          previous = notices,
          result = await store.resolveTagOrderIncident(input),
          after = await backup()
        assert(
          result.status === "applied" && notices > previous,
          "Committed order did not notify"
        )
        for (const key of [
          "items",
          "occurrences",
          "itemViews",
          "taskPlacements",
          "settings",
          "remoteShadows",
        ] as const)
          assert(
            JSON.stringify(after[key]) === JSON.stringify(before[key]),
            "Order modified another domain"
          )
        assert(
          after.outbox.length === 3 &&
            after.outbox.every((value) => value.state !== "acknowledged"),
          "Local order manufactured ACK"
        )
        for (const old of before.outbox)
          assert(
            JSON.stringify(
              after.outbox.find(
                (value) =>
                  value.operation.operationId === old.operation.operationId
              )
            ) === JSON.stringify({ ...old, state: "superseded" }),
            "Original order changed"
          )
        const replacement = after.outbox.find(
          (value) => value.operation.operationId === input.operationId
        )
        assert(
          replacement?.state === "pending" &&
            replacement.attempts === 0 &&
            replacement.operation.baseRevision === 2 &&
            !replacement.dependencies.length,
          "Retry lost exact pending identity"
        )
        const sorted = result.record.tags.toSorted(compareRank),
          last = sorted.at(-1)
        assert(last?.id === f.original[0].id, "Latest move was not reapplied")
        const next = await commitLocalPreferenceCommand(
          database,
          actor,
          {
            type: "tag.move",
            tagId: sorted[0].id,
            beforeId: null,
            afterId: last.id,
          },
          { operationId: crypto.randomUUID(), now: new Date(f.now) }
        )
        assert(
          next.dependencies.includes(replacement.operation.operationId),
          "New peer movement omitted replacement dependency"
        )
        await backup()
        const later = JSON.stringify(await raw()),
          prior = notices
        assert(
          (await store.resolveTagOrderIncident(input)).status === "replayed" &&
            later === JSON.stringify(await raw()) &&
            prior === notices,
          "Replay overwrote later movement or notified"
        )
        await rejected({ ...input, createdAt: "2026-10-18T21:00:00.000Z" })
        await seed()
      }
    )
    await check(
      "Renumeración guarda varios peers con revisiones independientes sin ACK",
      async () => {
        const peers = f.observed
          .slice(1)
          .toSorted((a, b) => (a.id < b.id ? -1 : 1))
        await write((tx) => {
          tx.objectStore("outbox").put({
            ...f.child,
            operation: {
              ...f.child.operation,
              command: {
                type: "tag.move",
                tagId: f.original[0].id,
                afterId: peers[0].id,
                beforeId: peers[1].id,
              },
            },
          })
          for (const [i, peer] of peers.entries())
            tx.objectStore("remoteShadows").put({
              version: 2,
              kind: "preference",
              entityKey: `tag:${peer.id}`,
              record: {
                store: "tags",
                record: { ...peer, position: 0, revision: 7 + i },
              },
            })
        })
        const input = await request(),
          result = await store.resolveTagOrderIncident(input),
          after = await backup()
        assert(
          after.tags.every(
            (tag) =>
              tag.revision ===
              input.expected.observedTags.find((remote) => remote.id === tag.id)
                ?.revision
          ),
          "Optimistic rerank invented revisions"
        )
        assert(
          JSON.stringify(
            result.record.tags.toSorted(compareRank).map((tag) => tag.id)
          ) === JSON.stringify([peers[0].id, f.original[0].id, peers[1].id]),
          "Rerank preview order differs"
        )
        await seed()
      }
    )
    await check(
      "Adopción no crea operaciones, conserva tombstones y contador al reabrir",
      async () => {
        await write((tx) => {
          const tag = {
            ...f.observed[1],
            id: crypto.randomUUID(),
            deletedAt: f.now,
          }
          tx.objectStore("remoteShadows").add({
            version: 2,
            kind: "preference",
            entityKey: `tag:${tag.id}`,
            record: { store: "tags", record: tag },
          })
        })
        const input = await request(false)
        await store.resolveTagOrderIncident(input)
        const after = await backup()
        assert(
          after.outbox.length === 2 &&
            JSON.stringify(after.tags) ===
              JSON.stringify(input.expected.observedTags),
          "Adoption lost catalog or changed history"
        )
        assert(
          after.syncMetadata.some(
            (value) =>
              value.key === "outbox-sequence" &&
              "value" in value &&
              value.value === 2
          ),
          "Adoption advanced counter"
        )
        const reopened = await LocalSyncStore.open(actor)
        try {
          assert(
            (await reopened.readSettingsIncidentOverview()).length === 0,
            "Adoption remained unresolved"
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
        reject(new Error("Owned category order cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
