import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { resolveLocalSettingsIncident } from "@/lib/local-db/settings-resolution"
import {
  readLocalSettingsSyncIncidentOverview,
  readLocalSyncIncidents,
} from "@/lib/local-db/sync-incidents"
import { resolveLocalSyncIncident } from "@/lib/local-db/sync-resolution"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import {
  localOperationOutcomeSchema,
  outboxEntrySchema,
} from "@/schemas/local-sync"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Resolution capacity proof requires its own loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-resolution-capacity`,
  name = localDatabaseName(actor)
const now = "2026-10-18T06:00:00.000Z"
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Resolution capacity status missing")
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
    stores = [...database.objectStoreNames]
  let checks = 0
  async function snapshot() {
    return runLocalTransaction<string>(
      database,
      stores,
      "readonly",
      (context) => {
        const values: Record<string, unknown> = {}
        let remaining = stores.length
        for (const name of stores) {
          const read = context.transaction.objectStore(name).getAll()
          read.onsuccess = () => {
            values[name] = read.result
            if (!--remaining) context.setResult(JSON.stringify(values))
          }
        }
      }
    )
  }
  async function counts() {
    return runLocalTransaction<Record<string, number>>(
      database,
      ["items", "outbox", "syncMetadata"],
      "readonly",
      (context) => {
        const value: Record<string, number> = {}
        let remaining = 3
        for (const name of ["items", "outbox", "syncMetadata"]) {
          const read = context.transaction.objectStore(name).count()
          read.onsuccess = () => {
            value[name] = read.result
            if (!--remaining) context.setResult(value)
          }
        }
      }
    )
  }
  async function check(label: string, work: () => Promise<void>) {
    await work()
    checks++
    const row = document.createElement("li")
    row.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(row)
  }
  async function seed(
    kind: "item" | "settings",
    outboxCount: number,
    metadataCount: number,
    itemCount = 1,
    deletedRemote = false
  ) {
    const id = crypto.randomUUID()
    const item = {
      kind: "task" as const,
      id,
      ownerId: actor,
      title: "Local",
      description: "Draft",
      scheduledDate: "2026-10-18",
      status: "not_started" as const,
      checklist: [],
      recurrence: null,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      completedAt: null,
    }
    const settings = {
      userId: actor,
      timeZone: "Europe/Madrid",
      weekStartsOn: 1 as const,
      locale: "es-ES" as const,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    const entry = outboxEntrySchema.parse({
      userId: actor,
      entityKey: kind === "item" ? `item:${id}` : `settings:${actor}`,
      sequence: 1,
      dependencies: [],
      state: "conflict",
      attempts: 1,
      lease: null,
      createdAt: now,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: kind === "item" ? 0 : 1,
        command:
          kind === "item"
            ? {
                type: "task.set-status",
                itemId: id,
                occurrenceId: null,
                status: "not_started",
              }
            : {
                type: "settings.update",
                input: {
                  timeZone: settings.timeZone,
                  weekStartsOn: 1,
                  locale: "es-ES",
                },
              },
      },
    })
    const outcome =
      kind === "item"
        ? localOperationOutcomeSchema.parse({
            key: `operation-outcome:${entry.operation.operationId}`,
            operation: entry.operation,
            result: {
              operationId: entry.operation.operationId,
              status: "conflict",
              current: {
                ...item,
                title: "Remote",
                revision: 1,
                deletedAt: deletedRemote ? now : null,
              },
            },
            local: item,
            base: null,
          })
        : localPreferenceOutcomeV2Schema.parse({
            version: 2,
            kind: "preference",
            key: `operation-outcome:${entry.operation.operationId}`,
            operation: entry.operation,
            result: {
              kind: "preference",
              outcome: {
                operationId: entry.operation.operationId,
                status: "conflict",
                current: {
                  store: "settings",
                  record: { ...settings, timeZone: "UTC", revision: 2 },
                },
              },
            },
            local: [
              {
                entityKey: entry.entityKey,
                record: { store: "settings", record: settings },
              },
            ],
            base: [{ entityKey: entry.entityKey, record: null }],
          })
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const name of stores) context.transaction.objectStore(name).clear()
      if (kind === "item") {
        context.transaction.objectStore("items").add(item)
        for (let index = 1; index < itemCount; index++)
          context.transaction
            .objectStore("items")
            .add({ ...item, id: crypto.randomUUID() })
      } else context.transaction.objectStore("settings").add(settings)
      const outbox = context.transaction.objectStore("outbox"),
        metadata = context.transaction.objectStore("syncMetadata")
      outbox.add(entry)
      for (let index = 1; index < outboxCount; index++)
        outbox.add({
          ...entry,
          operation: { ...entry.operation, operationId: crypto.randomUUID() },
          state: "superseded",
          sequence: index + 1,
        })
      metadata.add(outcome)
      metadata.add({ key: "outbox-sequence", value: outboxCount })
      // Count sentinels exercise capacity only, not portable backup validity.
      for (let index = 2; index < metadataCount; index++)
        metadata.add({ key: `owned-capacity:${index}` })
      context.setResult(true)
    })
    const expected =
      kind === "item"
        ? (await readLocalSyncIncidents(database, actor))[0]
        : (await readLocalSettingsSyncIncidentOverview(database, actor)).find(
            (value) => value.kind === "preference"
          )?.incident
    assert(expected, "Capacity conflict missing")
    return async function choose(
      choice: "adopt_remote" | "retry_local" | "copy_local",
      replayInput?: unknown
    ) {
      const request = replayInput ?? {
        userId: actor,
        resolutionId: crypto.randomUUID(),
        operationId: choice === "adopt_remote" ? null : crypto.randomUUID(),
        ...(kind === "item"
          ? { copyItemId: choice === "copy_local" ? crypto.randomUUID() : null }
          : {}),
        choice,
        createdAt: now,
        expected,
      }
      const result =
        kind === "item"
          ? await resolveLocalSyncIncident(database, actor, request)
          : await resolveLocalSettingsIncident(database, actor, request)
      return { result, request }
    }
  }
  async function rejectsUnchanged(
    work: () => Promise<unknown>,
    message: string
  ) {
    const before = await snapshot()
    let error = ""
    try {
      await work()
    } catch (value) {
      error = value instanceof Error ? value.message : String(value)
    }
    assert(
      error.includes(message),
      `Capacity rejection did not match: ${error}`
    )
    assert(
      before === (await snapshot()),
      "Capacity rejection changed durable state"
    )
  }
  try {
    for (const kind of ["item", "settings"] as const) {
      let choose = await seed(kind, 1, 10000)
      await check(
        `${kind === "item" ? "Planes" : "Zona"}: metadata llena conserva adopción y reintento`,
        async () => {
          await rejectsUnchanged(
            () => choose("adopt_remote"),
            "complete metadata"
          )
          await rejectsUnchanged(
            () => choose("retry_local"),
            "complete metadata"
          )
        }
      )
      choose = await seed(kind, 10000, 2)
      await check(
        `${kind === "item" ? "Planes" : "Zona"}: cola llena rechaza reintento y permite adopción sin operación`,
        async () => {
          await rejectsUnchanged(() => choose("retry_local"), "complete queue")
          assert(
            (await choose("adopt_remote")).result.record.replacement === null &&
              (await counts()).outbox === 10000,
            "Adoption added an operation"
          )
        }
      )
      choose = await seed(kind, 9999, 9999)
      await check(
        `${kind === "item" ? "Planes" : "Zona"}: último hueco y replay sin duplicados con ambas tablas llenas`,
        async () => {
          const saved = await choose("retry_local"),
            totals = await counts()
          assert(
            totals.outbox === 10000 && totals.syncMetadata === 10000,
            "Retry did not fill exact boundary"
          )
          const before = await snapshot(),
            replay = await choose("retry_local", saved.request)
          assert(
            replay.result.status === "replayed" &&
              before === (await snapshot()),
            "Full-capacity replay wrote or duplicated"
          )
        }
      )
    }
    let choose = await seed("item", 1, 2, 10000, true)
    await check(
      "Copia rechazada con diez mil elementos conserva original y cola",
      () => rejectsUnchanged(() => choose("copy_local"), "complete item")
    )
    choose = await seed("item", 1, 2, 9999, true)
    await check(
      "Copia ocupa exactamente el último hueco sin resucitar el original",
      async () => {
        const result = await choose("copy_local")
        assert(
          result.result.record.replacement !== null &&
            (await counts()).items === 10000,
          "Copy boundary did not persist"
        )
      }
    )
  } finally {
    database.close()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned capacity cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
