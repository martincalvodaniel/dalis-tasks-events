import { tagDeletionResolutionFixture } from "@/lib/backup/tag-delete-resolution-fixture"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { commitLocalPreferenceCommand } from "@/lib/local-db/preference-outbox"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { tagDeletionResolutionStoreNames } from "@/lib/local-db/tag-delete-resolution-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { captureTagDeletionResolutionSnapshot } from "@/lib/sync/tag-delete-resolution"
import { entityIdSchema } from "@/schemas/primitives"
import type { TagDeletionResolutionRequest } from "@/types/tag-delete-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error(
    "Category deletion proof requires its isolated loopback origin"
  )
const runId = entityIdSchema.parse(
    new URLSearchParams(location.search).get("run")
  ),
  actor = `browser-test-${runId}-tag-delete`,
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
    "Owned deletion partition already exists"
  )
  const f = tagDeletionResolutionFixture(actor),
    database = await openLocalDatabase(actor),
    store = await LocalSyncStore.open(actor)
  let checks = 0,
    notices = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  async function write(work: (tx: IDBTransaction) => void) {
    return runLocalTransaction(
      database,
      tagDeletionResolutionStoreNames,
      "readwrite",
      (context) => {
        work(context.transaction)
        context.setResult(true)
      }
    )
  }
  async function seed() {
    await write((tx) => {
      for (const key of tagDeletionResolutionStoreNames)
        tx.objectStore(key).clear()
      for (const tag of f.local) tx.objectStore("tags").add(tag)
      for (const shadow of f.input.shadows)
        tx.objectStore("remoteShadows").add(shadow)
      tx.objectStore("outbox").add(f.entry)
      tx.objectStore("syncMetadata").add(f.outcome)
      tx.objectStore("syncMetadata").add({ key: "outbox-sequence", value: 1 })
      tx.objectStore("syncMetadata").add({
        key: "preference-tail",
        operationId: f.entry.operation.operationId,
      })
    })
  }
  async function raw() {
    return runLocalTransaction<Record<string, unknown[]>>(
      database,
      tagDeletionResolutionStoreNames,
      "readonly",
      (context) => {
        const result: Record<string, unknown[]> = {}
        let remaining = tagDeletionResolutionStoreNames.length
        for (const key of tagDeletionResolutionStoreNames) {
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
  async function request(retry = true): Promise<TagDeletionResolutionRequest> {
    return {
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: retry ? crypto.randomUUID() : null,
      choice: retry ? "retry_delete" : "adopt_remote",
      createdAt: f.now,
      expected: await store.readTagDeletionIncidentSnapshot(
        f.entry.operation.operationId
      ),
    }
  }
  async function rejected(input: unknown) {
    const before = JSON.stringify(await raw()),
      previous = notices
    let failed = false
    try {
      await store.resolveTagDeletionIncident(input)
    } catch {
      failed = true
    }
    assert(
      failed && before === JSON.stringify(await raw()) && previous === notices,
      "Rejected deletion changed state or notified"
    )
  }
  async function captureRejected() {
    let failed = false
    try {
      await request()
    } catch {
      failed = true
    }
    assert(failed, "Incomplete deletion capture offered choices")
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
    await check("Captura readonly exacta y reapertura", async () => {
      const before = JSON.stringify(await raw()),
        input = await request()
      assert(
        JSON.stringify(input.expected) === JSON.stringify(f.snapshot) &&
          before === JSON.stringify(await raw()),
        "Deletion capture changed data"
      )
      const reopened = await LocalSyncStore.open(actor)
      try {
        assert(
          JSON.stringify(
            await reopened.readTagDeletionIncidentSnapshot(
              f.entry.operation.operationId
            )
          ) === JSON.stringify(input.expected),
          "Reopened deletion capture differs"
        )
      } finally {
        reopened.close()
      }
    })
    await check("Cuenta y catálogo obsoleto no escriben", async () => {
      const input = await request()
      await rejected({ ...input, userId: "foreign" })
      const expected = structuredClone(input.expected)
      expected.localTags[1].position += 100
      await rejected({ ...input, expected })
      await write((tx) =>
        tx.objectStore("remoteShadows").delete(`tag:${f.original[1].id}`)
      )
      await rejected(input)
      await captureRejected()
      await seed()
    })
    await check(
      "Fallo tardío revierte catálogo, cola, contador, tail y recibo",
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
            String(value.key).startsWith("tag-delete-resolution:")
          )
            throw new Error("Owned late deletion receipt failure")
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
      "Asignaciones, otros movimientos y referencias incompletas quedan protegidos",
      async () => {
        const input = await request()
        for (const command of [
          {
            type: "item-view.set",
            itemId: crypto.randomUUID(),
            primaryTagId: f.original[0].id,
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
              ...f.entry,
              state: "pending",
              attempts: 0,
              sequence: 2,
              dependencies: [],
              entityKey:
                command.type === "item-view.set"
                  ? `item-view:${command.itemId}`
                  : `tag:${command.tagId}`,
              operation: {
                ...f.entry.operation,
                operationId: crypto.randomUUID(),
                command,
              },
            })
            tx.objectStore("syncMetadata").put({
              key: "outbox-sequence",
              value: 2,
            })
          })
          await rejected(input)
          await seed()
        }
        await write((tx) =>
          tx.objectStore("tags").put({ ...f.local[1], userId: "foreign" })
        )
        await captureRejected()
        await seed()
      }
    )
    await check(
      "Identidades usadas, contador y capacidad bloquean sin borrar historia",
      async () => {
        const input = await request()
        await rejected({ ...input, operationId: f.entry.operation.operationId })
        for (const value of [0, Number.MAX_SAFE_INTEGER]) {
          await write((tx) =>
            tx
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value })
          )
          await rejected(input)
          await seed()
        }
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
    await check("Prerrequisito ACK exige outcome aplicado real", async () => {
      const ancestor = {
          ...f.entry,
          state: "acknowledged" as const,
          sequence: 1,
          dependencies: [],
          operation: {
            ...f.entry.operation,
            operationId: crypto.randomUUID(),
            baseRevision: 0,
            command: {
              type: "tag.save" as const,
              tagId: f.original[0].id,
              input: {
                name: f.original[0].name,
                color: f.original[0].color,
                position: f.original[0].position,
              },
            },
          },
        },
        entry = {
          ...f.entry,
          sequence: 2,
          dependencies: [ancestor.operation.operationId],
        }
      await write((tx) => {
        tx.objectStore("outbox").clear()
        for (const value of [ancestor, entry])
          tx.objectStore("outbox").add(value)
        tx.objectStore("syncMetadata").put({ key: "outbox-sequence", value: 2 })
      })
      const expected = captureTagDeletionResolutionSnapshot({
        ...f.capture,
        entries: [ancestor, entry],
        incident: { ...f.capture.incident, entry, intentions: [entry] },
      })
      await rejected({
        userId: actor,
        resolutionId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        choice: "retry_delete",
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
      await store.resolveTagDeletionIncident(await request())
      await backup()
      await seed()
    })
    await check(
      "Retry genera pending sin ACK; operaciones posteriores dependen del reemplazo",
      async () => {
        const input = await request(),
          before = await backup(),
          previous = notices,
          result = await store.resolveTagDeletionIncident(input),
          after = await backup()
        assert(
          result.status === "applied" &&
            notices > previous &&
            after.outbox.length === 2 &&
            after.outbox.every((entry) => entry.state !== "acknowledged"),
          "Deletion decision manufactured ACK or lost pending"
        )
        assert(
          JSON.stringify(
            after.outbox.find(
              (entry) =>
                entry.operation.operationId === f.entry.operation.operationId
            )
          ) === JSON.stringify({ ...f.entry, state: "superseded" }),
          "Original deletion changed"
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
            JSON.stringify(before[key]) === JSON.stringify(after[key]),
            "Deletion modified another domain"
          )
        const primary = after.tags.find((tag) => tag.id === f.original[0].id)
        assert(
          primary?.deletedAt === f.now && primary.revision === 2,
          "Optimistic deletion invented revision or lost tombstone"
        )
        const next = await commitLocalPreferenceCommand(
          database,
          actor,
          {
            type: "tag.save",
            tagId: f.original[1].id,
            input: {
              name: f.original[1].name,
              color: "#abcdef",
              position: f.original[1].position,
            },
          },
          { operationId: crypto.randomUUID(), now: new Date(f.now) }
        )
        assert(
          input.operationId && next.dependencies.includes(input.operationId),
          "Later preference omitted deletion replacement dependency"
        )
        await backup()
        const later = JSON.stringify(await raw()),
          prior = notices
        assert(
          (await store.resolveTagDeletionIncident(input)).status ===
            "replayed" &&
            later === JSON.stringify(await raw()) &&
            prior === notices,
          "Deletion replay overwrote later edit or notified"
        )
        await rejected({ ...input, createdAt: "2026-10-18T22:00:00.000Z" })
        await seed()
      }
    )
    await check(
      "Tail ausente se crea; tail corrupto no se repara",
      async () => {
        await write((tx) =>
          tx.objectStore("syncMetadata").delete("preference-tail")
        )
        const input = await request()
        await store.resolveTagDeletionIncident(input)
        await backup()
        await seed()
        const next = await request()
        await write((tx) =>
          tx
            .objectStore("syncMetadata")
            .put({ key: "preference-tail", operationId: crypto.randomUUID() })
        )
        await rejected(next)
        await seed()
      }
    )
    await check(
      "Adoptar remoto vivo restaura explícitamente categoría sin ACK ni modificar asignaciones",
      async () => {
        const input = await request(false)
        await store.resolveTagDeletionIncident(input)
        const after = await backup()
        assert(
          after.outbox.length === 1 &&
            JSON.stringify(after.tags) ===
              JSON.stringify(input.expected.observedTags) &&
            after.tags.find((tag) => tag.id === f.original[0].id)?.deletedAt ===
              null,
          "Adoption did not restore exact remote category"
        )
        assert(
          after.syncMetadata.some(
            (value) =>
              value.key === "outbox-sequence" &&
              "value" in value &&
              value.value === 1
          ),
          "Adoption advanced counter"
        )
        const reopened = await LocalSyncStore.open(actor)
        try {
          assert(
            (await reopened.readSettingsIncidentOverview()).length === 0,
            "Reopened deletion adoption unresolved"
          )
        } finally {
          reopened.close()
        }
        await seed()
      }
    )
    await check(
      "Adopción conserva categoría ya eliminada remotamente",
      async () => {
        const remote = { ...f.observed[0], revision: 3, deletedAt: f.now }
        await write((tx) =>
          tx.objectStore("remoteShadows").put({
            version: 2,
            kind: "preference",
            entityKey: f.entry.entityKey,
            record: { store: "tags", record: remote },
          })
        )
        const input = await request(false)
        await store.resolveTagDeletionIncident(input)
        const after = await backup()
        assert(
          after.outbox.length === 1 &&
            JSON.stringify(after.tags.find((tag) => tag.id === remote.id)) ===
              JSON.stringify(remote),
          "Remote tombstone was undone or repeated"
        )
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
        reject(new Error("Owned deletion cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
