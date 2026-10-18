import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import { entityIdSchema } from "@/schemas/primitives"
import type { TagResolutionRequest } from "@/types/tag-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Category decision proof requires its own loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-tag-resolution`,
  name = localDatabaseName(actor)
const now = "2026-10-18T05:50:00.000Z"
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Proof status is missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Proof partition already exists"
  )
  const database = await openLocalDatabase(actor),
    store = await LocalSyncStore.open(actor)
  let notices = 0,
    checks = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  const local = tagSchema.parse({
    id: crypto.randomUUID(),
    userId: actor,
    name: "Local",
    normalizedName: "local",
    color: "#123456",
    position: 80,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const remote = {
    ...local,
    name: "Remote",
    normalizedName: "remote",
    color: "#654321",
    position: 20,
    revision: 2,
  }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `tag:${local.id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "tag.save",
        tagId: local.id,
        input: {
          name: local.name,
          color: local.color,
          position: local.position,
        },
      },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: now,
  })
  const child = outboxEntrySchema.parse({
    ...entry,
    operation: { ...entry.operation, operationId: crypto.randomUUID() },
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [entry.operation.operationId],
  })
  const outcome = localPreferenceOutcomeV2Schema.parse({
    version: 2,
    kind: "preference",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "preference",
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        current: { store: "tags", record: remote },
      },
    },
    local: [
      { entityKey: entry.entityKey, record: { store: "tags", record: local } },
    ],
    base: [{ entityKey: entry.entityKey, record: null }],
  })
  async function seed() {
    await runLocalTransaction(
      database,
      ["tags", "outbox", "syncMetadata"],
      "readwrite",
      (context) => {
        for (const name of ["tags", "outbox", "syncMetadata"])
          context.transaction.objectStore(name).clear()
        context.transaction.objectStore("tags").add(local)
        context.transaction.objectStore("outbox").add(entry)
        context.transaction.objectStore("outbox").add(child)
        context.transaction.objectStore("syncMetadata").add(outcome)
        context.transaction
          .objectStore("syncMetadata")
          .add({ key: "outbox-sequence", value: 2 })
        context.setResult(true)
      }
    )
  }
  async function snapshot() {
    return (await readLocalRecurringBackup(database, actor, now)).stores
  }
  async function request(
    choice: "adopt_remote" | "retry_local"
  ): Promise<TagResolutionRequest> {
    const value = (await store.readSettingsIncidentOverview()).find(
      (value) =>
        value.kind === "preference" &&
        value.incident.entry.operation.operationId ===
          entry.operation.operationId
    )
    assert(value?.kind === "preference", "Category conflict missing")
    assert(
      value.incident.blockedByRelatedIntentions !== undefined,
      "Category dependency guard missing"
    )
    return {
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: choice === "retry_local" ? crypto.randomUUID() : null,
      choice,
      createdAt: now,
      expected: {
        ...value.incident,
        blockedByRelatedIntentions: value.incident.blockedByRelatedIntentions,
      },
    }
  }
  async function rejected(input: unknown) {
    const before = JSON.stringify(await snapshot()),
      previousNotices = notices
    let failed = false
    try {
      await store.resolveTagIncident(input)
    } catch {
      failed = true
    }
    assert(
      failed &&
        before === JSON.stringify(await snapshot()) &&
        notices === previousNotices,
      "Rejected category decision changed state or notified"
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
      "Cuenta ajena y comparación obsoleta conservan todo",
      async () => {
        const input = await request("retry_local")
        await rejected({ ...input, userId: "foreign-owner" })
        await rejected({
          ...input,
          expected: {
            ...input.expected,
            tagNames: {
              ...input.expected.tagNames,
              [crypto.randomUUID()]: "Later",
            },
          },
        })
      }
    )
    await check(
      "Fallo tardío revierte categoría, cola, contador y recibo sin notificar",
      async () => {
        const input = await request("retry_local"),
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
            String(value.key).startsWith("tag-resolution:")
          )
            throw new Error("Owned late category receipt failure")
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
      "Dependiente externo impide resolver sólo la categoría",
      async () => {
        const other = {
          ...child,
          entityKey: `tag:${crypto.randomUUID()}`,
          sequence: 3,
          dependencies: [child.operation.operationId],
          operation: { ...child.operation, operationId: crypto.randomUUID() },
        }
        if (other.operation.command.type !== "tag.save")
          throw new Error("Owned dependent fixture command changed")
        other.operation.command = {
          ...other.operation.command,
          tagId: other.entityKey.slice(4),
        }
        await runLocalTransaction(
          database,
          ["outbox", "syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("outbox").add(other)
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 3 })
            context.setResult(true)
          }
        )
        await rejected(await request("retry_local"))
        await seed()
      }
    )
    await check(
      "Retry pendiente con UUID nuevo y originales superseded exactos, nunca ACK",
      async () => {
        const input = await request("retry_local"),
          before = await snapshot(),
          previous = notices
        const result = await store.resolveTagIncident(input),
          after = await snapshot()
        assert(
          result.status === "applied" && notices > previous,
          "Decision did not notify after commit"
        )
        assert(
          after.outbox.length === 3 &&
            after.outbox.filter((entry) => entry.state === "acknowledged")
              .length === 0,
          "Category decision invented an ACK"
        )
        for (const old of before.outbox) {
          const saved = after.outbox.find(
            (value) => value.operation.operationId === old.operation.operationId
          )
          assert(
            JSON.stringify(saved) ===
              JSON.stringify({ ...old, state: "superseded" }),
            "Category decision changed original evidence"
          )
        }
        const replacement = after.outbox.find(
          (entry) => entry.operation.operationId === input.operationId
        )
        assert(
          replacement?.state === "pending" &&
            replacement.attempts === 0 &&
            replacement.dependencies.length === 0 &&
            replacement.operation.baseRevision === 2 &&
            after.tags[0].position === remote.position,
          "Retry lost fresh CAS, pending state or remote order"
        )
        await runLocalTransaction(
          database,
          ["tags"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("tags")
              .put({ ...result.record.local, color: "#ffffff" })
            context.setResult(true)
          }
        )
        const changed = JSON.stringify(await snapshot()),
          previousNotices = notices
        assert(
          (await store.resolveTagIncident(input)).status === "replayed" &&
            changed === JSON.stringify(await snapshot()) &&
            notices === previousNotices,
          "Replay overwrote a later edit or notified"
        )
        await rejected({ ...input, createdAt: "2026-10-18T05:51:00.000Z" })
      }
    )
    await seed()
    await check(
      "Adoptar conserva versión remota sin operación ni cambio de contador",
      async () => {
        const result = await store.resolveTagIncident(
            await request("adopt_remote")
          ),
          after = await snapshot()
        assert(
          result.record.replacement === null &&
            after.outbox.length === 2 &&
            JSON.stringify(after.tags[0]) === JSON.stringify(remote),
          "Adoption created an operation or wrong category"
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
            "Reopened decision is unresolved"
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
        reject(new Error("Owned category proof cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
