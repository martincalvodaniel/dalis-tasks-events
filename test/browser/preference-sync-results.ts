import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { applyLocalPreferenceResult } from "@/lib/local-db/preference-sync-results"
import { readLocalSyncIncidentOverview } from "@/lib/local-db/sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { validateLocalSyncResultInputV2 } from "@/lib/sync/local-sync-result-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
} from "@/schemas/preferences"
import { entityIdSchema } from "@/schemas/primitives"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { LocalSyncResultInputV2 } from "@/types/local-sync-result-v2"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"

if (location.hostname !== "127.0.0.1" || location.port !== "4191")
  throw new Error("Personal fixture requires its isolated loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const userId = `browser-test-${runId}-personal-results`
const otherUserId = `${userId}-other`
const timestamp = "2026-10-08T00:00:00.000Z"
const stores = [
  "items",
  "tags",
  "itemViews",
  "taskPlacements",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
const rows = document.getElementById("results")
const status = document.getElementById("status")
if (!rows || !status) throw new Error("Personal fixture markup missing")
const list = rows
const statusElement = status
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Personal result browser assertion failed")
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
  list.append(row)
}
function tag(
  id: string,
  revision: number,
  position = 1024
): Extract<PreferenceEffect, { store: "tags" }> {
  return {
    store: "tags",
    record: tagSchema.parse({
      id,
      userId,
      name: "Cached",
      normalizedName: "cached",
      color: "#123456",
      position,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }),
  }
}
type PersonalSubmission = Omit<LocalSyncResultInputV2, "result"> & {
  result: Extract<LocalSyncResultInputV2["result"], { kind: "preference" }>
}
type Fixture = {
  submission: PersonalSubmission
  entries: OutboxEntry[]
  tags: Extract<PreferenceEffect, { store: "tags" }>["record"][]
  views: Extract<PreferenceEffect, { store: "itemViews" }>["record"][]
  placements: Extract<PreferenceEffect, { store: "taskPlacements" }>["record"][]
  shadows: RemoteShadowV2[]
}
function fixture(pending = true, baseRevision = 1): Fixture {
  const first = crypto.randomUUID()
  const second = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  const senderId = crypto.randomUUID()
  const operation = {
    operationId,
    protocolVersion: 1 as const,
    baseRevision: 1,
    command: {
      type: "tag.move" as const,
      tagId: first,
      beforeId: second,
      afterId: null,
    },
  }
  const entry: OutboxEntry = outboxEntrySchema.parse({
    userId,
    operation,
    entityKey: `tag:${first}`,
    sequence: 1,
    dependencies: [],
    state: "sending",
    attempts: 1,
    createdAt: timestamp,
    lease: { ownerId: senderId, expiresAt: "2026-10-08T00:01:00.000Z" },
  })
  const effects = [tag(first, 2, 2048), tag(second, 8, 4096)]
  const submission: PersonalSubmission = {
    operation,
    senderId,
    result: {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: { version: 1, userId, operationId, sequence: 3, effects },
      },
    },
  }
  const entries = [entry]
  if (pending)
    for (const [index, id] of [first, second].entries())
      entries.push(
        outboxEntrySchema.parse({
          ...entry,
          sequence: index + 2,
          state: "pending",
          attempts: 0,
          lease: null,
          dependencies: [operationId],
          entityKey: `tag:${id}`,
          operation: {
            operationId: crypto.randomUUID(),
            protocolVersion: 1,
            baseRevision: 0,
            command: { type: "tag.delete", tagId: id },
          },
        })
      )
  return {
    submission,
    entries,
    tags: [tag(first, 0, 7000).record, tag(second, 0, 9000).record],
    views: [] as Extract<PreferenceEffect, { store: "itemViews" }>["record"][],
    placements: [],
    shadows: [first, second].map((id) => ({
      version: 2 as const,
      kind: "preference" as const,
      entityKey: `tag:${id}`,
      record: tag(id, baseRevision, 100),
    })),
  }
}
function movementFixture(baseRevision = 1): Fixture {
  const value = fixture(false)
  const itemId = crypto.randomUUID(),
    peerId = crypto.randomUUID()
  const operation = {
    ...value.submission.operation,
    baseRevision: 0,
    command: {
      type: "task.move" as const,
      itemId,
      occurrenceId: null,
      scope: "day" as const,
      date: "2026-10-08",
      tagId: null,
      beforeId: peerId,
      afterId: null,
    },
  }
  const effects: PreferenceEffect[] = [
    ...[itemId, peerId].map((occurrenceId, index) => ({
      store: "taskPlacements" as const,
      record: taskPlacementSchema.parse({
        userId,
        occurrenceId,
        scope: "day",
        date: "2026-10-08",
        tagId: null,
        position: (index + 1) * 1024,
        revision: index ? 8 : 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }),
    })),
    {
      store: "itemViews",
      record: itemViewSchema.parse({
        userId,
        itemId,
        primaryTagId: null,
        revision: 4,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }),
    },
  ]
  value.submission.operation = operation
  value.submission.result = {
    kind: "preference",
    outcome: {
      status: "applied",
      operationId: operation.operationId,
      effects: {
        version: 1,
        userId,
        operationId: operation.operationId,
        sequence: 4,
        effects,
      },
    },
  }
  value.tags = []
  value.placements = effects
    .filter((effect) => effect.store === "taskPlacements")
    .map((effect) => ({ ...effect.record, revision: 0, position: 9000 }))
  value.views = effects
    .filter((effect) => effect.store === "itemViews")
    .map((effect) => ({ ...effect.record, revision: 0 }))
  value.shadows = effects.map((effect) => {
    const record = structuredClone(effect)
    record.record.revision = baseRevision
    return {
      version: 2,
      kind: "preference",
      entityKey: personalShadowEntityKey(effect),
      record,
    }
  })
  value.entries = [
    outboxEntrySchema.parse({
      ...value.entries[0],
      operation,
      entityKey: taskPlacementEntityKey(itemId, "day", "2026-10-08"),
    }),
  ]
  return value
}
async function seed(db: IDBDatabase, value: ReturnType<typeof fixture>) {
  await runLocalTransaction<void>(db, stores, "readwrite", (context) => {
    for (const name of stores) context.transaction.objectStore(name).clear()
    for (const record of value.tags)
      context.transaction.objectStore("tags").put(record)
    for (const record of value.views)
      context.transaction.objectStore("itemViews").put(record)
    for (const record of value.placements)
      context.transaction.objectStore("taskPlacements").put(record)
    for (const record of value.entries)
      context.transaction.objectStore("outbox").put(record)
    for (const record of value.shadows)
      context.transaction.objectStore("remoteShadows").put(record)
    context.transaction
      .objectStore("syncMetadata")
      .put({ key: "outbox-sequence", value: value.entries.length })
    context.transaction
      .objectStore("syncMetadata")
      .put({ key: "pull-cursor", after: 1, through: 3 })
    context.setResult(undefined)
  })
}
async function snapshot(db: IDBDatabase) {
  return runLocalTransaction<Record<string, unknown[]>>(
    db,
    stores,
    "readonly",
    (context) => {
      const value: Record<string, unknown[]> = {}
      let remaining = stores.length
      for (const name of stores) {
        const request = context.transaction.objectStore(name).getAll()
        request.onsuccess = () => {
          value[name] = request.result
          if (!--remaining) context.setResult(value)
        }
      }
    }
  )
}
async function read(
  db: IDBDatabase,
  store: string,
  key: IDBValidKey
): Promise<unknown> {
  return runLocalTransaction<unknown>(db, [store], "readonly", (context) => {
    const request = context.transaction.objectStore(store).get(key)
    request.onsuccess = () => context.setResult(request.result)
  })
}
async function rejectsBeforeTransaction(
  db: IDBDatabase,
  work: () => Promise<unknown>
) {
  let calls = 0
  const own = Object.getOwnPropertyDescriptor(db, "transaction")
  Object.defineProperty(db, "transaction", {
    configurable: true,
    value() {
      calls++
      throw new Error("Unexpected transaction in a rejected request")
    },
  })
  try {
    await refused(work)
    assert(calls === 0)
  } finally {
    if (own) Object.defineProperty(db, "transaction", own)
    else Reflect.deleteProperty(db, "transaction")
  }
}
function outcome(value: unknown): LocalPreferenceOutcomeV2 {
  // The production decoder is exercised by the writer and its replay; assertions inspect the result.
  return value as LocalPreferenceOutcomeV2
}
async function runChecks() {
  const db = await openLocalDatabase(userId)
  const other = await openLocalDatabase(otherUserId)
  try {
    await check(
      "ACK de movimiento conserva UUID, compactación y sólo rebasa dependientes directos sin intento",
      async () => {
        const value = movementFixture()
        const command = value.submission.operation.command
        assert(command.type === "task.move" && command.beforeId !== null)
        const dependent = (
          sequence: number,
          entityKey: string,
          command: OutboxEntry["operation"]["command"]
        ) =>
          outboxEntrySchema.parse({
            ...value.entries[0],
            sequence,
            entityKey,
            state: "pending",
            attempts: 0,
            lease: null,
            dependencies: [value.submission.operation.operationId],
            operation: {
              protocolVersion: 1,
              operationId: crypto.randomUUID(),
              baseRevision: 0,
              command,
            },
          })
        value.entries.push(
          dependent(2, value.entries[0].entityKey, command),
          dependent(
            3,
            taskPlacementEntityKey(command.beforeId, "day", command.date),
            { ...command, itemId: command.beforeId, beforeId: null }
          ),
          dependent(4, `item-view:${command.itemId}`, {
            type: "item-view.set",
            itemId: command.itemId,
            primaryTagId: null,
          })
        )
        const tried = dependent(5, value.entries[1].entityKey, command)
        tried.attempts = 1
        const indirect = dependent(6, value.entries[1].entityKey, command)
        indirect.dependencies = [value.entries[1].operation.operationId]
        const unrelated = dependent(7, value.entries[1].entityKey, command)
        unrelated.dependencies = []
        value.entries.push(tried, indirect, unrelated)
        await seed(db, value)
        const baseline = await snapshot(db)
        await applyLocalPreferenceResult(db, userId, value.submission)
        const after = await snapshot(db)
        const entries = (after.outbox as OutboxEntry[]).toSorted(
          (a, b) => a.sequence - b.sequence
        )
        assert(
          JSON.stringify(
            entries.map((entry) => entry.operation.baseRevision)
          ) === JSON.stringify([0, 1, 8, 4, 0, 0, 0])
        )
        assert(entries[0].state === "acknowledged" && entries[0].lease === null)
        assert(
          JSON.stringify(entries.slice(4)) ===
            JSON.stringify(value.entries.slice(4))
        )
        for (let index = 0; index < entries.length; index++) {
          assert(
            JSON.stringify(entries[index].operation.command) ===
              JSON.stringify(value.entries[index].operation.command)
          )
          assert(
            entries[index].operation.operationId ===
              value.entries[index].operation.operationId
          )
          assert(
            JSON.stringify(entries[index].dependencies) ===
              JSON.stringify(value.entries[index].dependencies)
          )
        }
        for (const name of ["taskPlacements", "itemViews"])
          assert(JSON.stringify(after[name]) === JSON.stringify(baseline[name]))
        const evidence = outcome(
          await read(
            db,
            "syncMetadata",
            `operation-outcome:${value.submission.operation.operationId}`
          )
        )
        assert(evidence.local.length === 3 && evidence.base.length === 3)
        assert(
          evidence.result.outcome.status === "applied" &&
            JSON.stringify(evidence.result) ===
              JSON.stringify(
                validateLocalSyncResultInputV2(value.submission, userId).result
              )
        )
        assert(
          JSON.stringify(
            after.remoteShadows
              .map(
                (row) =>
                  (row as Extract<RemoteShadowV2, { kind: "preference" }>)
                    .record.record.revision
              )
              .sort((a, b) => a - b)
          ) === JSON.stringify([1, 4, 8])
        )
        const replay = JSON.stringify(after)
        assert(
          (await applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            senderId: crypto.randomUUID(),
          })) === "replayed"
        )
        assert(JSON.stringify(await snapshot(db)) === replay)
      }
    )
    await check(
      "ACK tardío conserva tombstone nuevo y replay no sobrescribe shadows posteriores",
      async () => {
        const value = movementFixture(20)
        const shadow = value.shadows.find(
          (entry) =>
            entry.kind === "preference" &&
            entry.record.store === "taskPlacements"
        )
        assert(shadow?.kind === "preference")
        shadow.record.record.deletedAt = timestamp
        await seed(db, value)
        await applyLocalPreferenceResult(db, userId, value.submission)
        const after = await snapshot(db)
        assert(
          after.taskPlacements.length === 2 &&
            after.taskPlacements.every(
              (row) => (row as { revision: number }).revision === 20
            )
        )
        assert(
          after.taskPlacements.some(
            (row) =>
              (row as { deletedAt: string | null }).deletedAt === timestamp
          )
        )
        const evidence = outcome(
          await read(
            db,
            "syncMetadata",
            `operation-outcome:${value.submission.operation.operationId}`
          )
        )
        assert(
          evidence.local.every((row) => row.record?.record.revision === 0) &&
            evidence.base.every((row) => row.record?.record.revision === 20)
        )
        assert(
          evidence.base.some(
            (row) => row.record?.record.deletedAt === timestamp
          )
        )
        shadow.record.record.revision = 30
        await runLocalTransaction(
          db,
          ["remoteShadows"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("remoteShadows").put(shadow)
            context.setResult(undefined)
          }
        )
        const newer = JSON.stringify(await snapshot(db))
        assert(
          (await applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            senderId: crypto.randomUUID(),
          })) === "replayed"
        )
        assert(JSON.stringify(await snapshot(db)) === newer)
        assert(
          JSON.stringify(await read(db, "syncMetadata", evidence.key)) ===
            JSON.stringify(evidence)
        )
      }
    )
    await check(
      "La incidencia de movimiento lee colocación actual y conserva evidencia del conflicto sin escribir",
      async () => {
        const value = movementFixture()
        const command = value.submission.operation.command
        assert(command.type === "task.move")
        const local = value.placements.find(
          (record) => record.occurrenceId === command.itemId
        )
        assert(local && local.revision === 0 && local.position === 9000)
        const remote: Extract<PreferenceEffect, { store: "taskPlacements" }> = {
          store: "taskPlacements",
          record: taskPlacementSchema.parse({
            ...local,
            revision: 21,
            position: 4096,
          }),
        }
        value.submission.result = {
          kind: "preference",
          outcome: {
            operationId: value.submission.operation.operationId,
            status: "conflict",
            current: remote,
          },
        }
        await seed(db, value)
        await applyLocalPreferenceResult(db, userId, value.submission)
        assert(
          JSON.stringify(
            await read(db, "taskPlacements", [
              local.occurrenceId,
              local.scope,
              local.date,
            ])
          ) === JSON.stringify(local)
        )
        const readOnly = async () => {
          const before = JSON.stringify(await snapshot(db))
          const overview = await readLocalSyncIncidentOverview(db, userId)
          assert(JSON.stringify(await snapshot(db)) === before)
          assert(overview.length === 1 && overview[0].kind === "preference")
          return overview[0].incident
        }
        const incident = await readOnly()
        assert(
          incident.reason === "conflict" &&
            incident.entry.state === "conflict" &&
            incident.entry.lease === null
        )
        assert(
          incident.local.length === 1 &&
            incident.local[0].record?.store === "taskPlacements"
        )
        assert(
          JSON.stringify(incident.local[0].record.record) ===
            JSON.stringify(local)
        )
        assert(
          JSON.stringify(incident.localAtOutcome) ===
            JSON.stringify(incident.local)
        )
        assert(
          incident.remote[0].record?.store === "taskPlacements" &&
            JSON.stringify(incident.remote[0].record) === JSON.stringify(remote)
        )
        assert(incident.shadowAtOutcome[0].record?.record.revision === 1)
        const evidence = JSON.stringify(incident.outcome)
        const historical = JSON.stringify(incident.localAtOutcome)
        const changed = taskPlacementSchema.parse({ ...local, position: 12000 })
        await runLocalTransaction(
          db,
          ["taskPlacements"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("taskPlacements").put(changed)
            context.setResult(undefined)
          }
        )
        const current = await readOnly()
        assert(
          current.local[0].record?.store === "taskPlacements" &&
            JSON.stringify(current.local[0].record.record) ===
              JSON.stringify(changed)
        )
        assert(
          JSON.stringify(current.localAtOutcome) === historical &&
            JSON.stringify(current.outcome) === evidence
        )
        assert(
          JSON.stringify(current.remote) === JSON.stringify(incident.remote) &&
            JSON.stringify(current.shadowAtOutcome) ===
              JSON.stringify(incident.shadowAtOutcome)
        )
        assert(
          JSON.stringify(
            await read(db, "syncMetadata", incident.outcome.key)
          ) === evidence
        )
      }
    )
    await check(
      "Fallo de colocación o outcome tardío revierte placements, vista, shadows y ACK juntos",
      async () => {
        for (const target of ["taskPlacements", "syncMetadata"]) {
          const value = movementFixture()
          await seed(db, value)
          const before = JSON.stringify(await snapshot(db))
          const original = IDBObjectStore.prototype.put
          let placementWrites = 0,
            injected = false
          IDBObjectStore.prototype.put = function (record, key) {
            if (this.name === "taskPlacements") placementWrites++
            if (
              this.name === target &&
              (target !== "syncMetadata" ||
                String(record?.key).startsWith("operation-outcome:"))
            ) {
              injected = true
              throw new Error("Injected placement transaction failure")
            }
            return key === undefined
              ? original.call(this, record)
              : original.call(this, record, key)
          }
          try {
            await refused(() =>
              applyLocalPreferenceResult(db, userId, value.submission)
            )
          } finally {
            IDBObjectStore.prototype.put = original
          }
          assert(injected && placementWrites > 0)
          assert(JSON.stringify(await snapshot(db)) === before)
          assert(
            (await applyLocalPreferenceResult(db, userId, value.submission)) ===
              "applied"
          )
        }
      }
    )
    await check(
      "Colocaciones ajenas o no canónicas detienen incluso el replay sin escrituras parciales",
      async () => {
        for (const invalid of ["owner", "date"] as const) {
          const value = movementFixture()
          await seed(db, value)
          await applyLocalPreferenceResult(db, userId, value.submission)
          const record = { ...value.placements[0] }
          if (invalid === "owner") record.userId = otherUserId
          else {
            record.scope = "overdue"
            record.date = "2026-10-08"
          }
          await runLocalTransaction(
            db,
            ["taskPlacements"],
            "readwrite",
            (context) => {
              context.transaction.objectStore("taskPlacements").put(record)
              context.setResult(undefined)
            }
          )
          const before = JSON.stringify(await snapshot(db))
          await refused(() =>
            applyLocalPreferenceResult(db, userId, value.submission)
          )
          assert(JSON.stringify(await snapshot(db)) === before)
        }
      }
    )
    await check(
      "Compactación completa, revisiones independientes y dependientes sin perder el estado local",
      async () => {
        const value = fixture()
        await seed(db, value)
        assert(
          (await applyLocalPreferenceResult(db, userId, value.submission)) ===
            "applied"
        )
        for (const entry of value.entries) {
          const stored = (await read(
            db,
            "outbox",
            entry.operation.operationId
          )) as OutboxEntry
          assert(stored.operation.operationId === entry.operation.operationId)
          assert(
            JSON.stringify(stored.operation.command) ===
              JSON.stringify(entry.operation.command)
          )
          assert(
            JSON.stringify(stored.dependencies) ===
              JSON.stringify(entry.dependencies)
          )
          if (entry.sequence === 1)
            assert(stored.state === "acknowledged" && stored.lease === null)
          else
            assert(
              stored.operation.baseRevision === (entry.sequence === 2 ? 2 : 8)
            )
        }
        const stored = await snapshot(db)
        assert(
          JSON.stringify(stored.tags) ===
            JSON.stringify(
              [...value.tags].sort((a, b) => a.id.localeCompare(b.id))
            )
        )
        const result = outcome(
          await read(
            db,
            "syncMetadata",
            `operation-outcome:${value.submission.operation.operationId}`
          )
        )
        assert(result.local.length === 2 && result.base.length === 2)
        assert(
          result.result.outcome.status === "applied" &&
            result.result.outcome.effects.effects.length === 2
        )
        const before = JSON.stringify(await snapshot(db))
        assert(
          (await applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            senderId: crypto.randomUUID(),
          })) === "replayed"
        )
        assert(JSON.stringify(await snapshot(db)) === before)
        assert(value.submission.result.outcome.status === "applied")
        const applied = value.submission.result.outcome
        await refused(() =>
          applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            result: {
              ...value.submission.result,
              outcome: {
                ...applied,
                effects: {
                  ...applied.effects,
                  sequence: 99,
                },
              },
            },
          })
        )
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    await check(
      "El ACK final reconcilia desde shadows nuevos y conserva el replay anterior exacto",
      async () => {
        const value = fixture(false, 20)
        await seed(db, value)
        await applyLocalPreferenceResult(db, userId, value.submission)
        const result = outcome(
          await read(
            db,
            "syncMetadata",
            `operation-outcome:${value.submission.operation.operationId}`
          )
        )
        assert(
          result.base.every((entry) => entry.record?.record.revision === 20)
        )
        assert(
          result.local.every((entry) => entry.record?.record.revision === 0)
        )
        assert(
          result.result.outcome.status === "applied" &&
            result.result.outcome.effects.effects[0].record.revision === 2
        )
        const stored = await snapshot(db)
        assert(
          stored.tags.every(
            (record) => (record as { revision: number }).revision === 20
          )
        )
        assert(
          JSON.stringify(
            stored.syncMetadata.find(
              (record) => (record as { key: string }).key === "pull-cursor"
            )
          ) === JSON.stringify({ key: "pull-cursor", after: 1, through: 3 })
        )
      }
    )
    await check(
      "Conflictos, rechazo y falta de soporte conservan snapshots y cadenas pendientes",
      async () => {
        for (const state of [
          "conflict",
          "unsupported",
          "unavailable",
          "invalid_command",
          "identity_reuse",
        ] as const) {
          const value = fixture(true, 20)
          assert(value.submission.operation.command.type === "tag.move")
          value.submission.result = {
            kind: "preference",
            outcome:
              state === "conflict"
                ? {
                    operationId: value.submission.operation.operationId,
                    status: state,
                    current: tag(value.submission.operation.command.tagId, 21),
                  }
                : {
                    operationId: value.submission.operation.operationId,
                    status: state,
                  },
          }
          if (state !== "conflict") {
            value.tags = []
            value.shadows = []
          }
          await seed(db, value)
          await applyLocalPreferenceResult(db, userId, value.submission)
          const entry = (await read(
            db,
            "outbox",
            value.submission.operation.operationId
          )) as OutboxEntry
          assert(
            entry.state ===
              (state === "conflict"
                ? "conflict"
                : state === "unsupported"
                  ? "pending"
                  : "rejected")
          )
          assert(entry.lease === null)
          assert(
            JSON.stringify(
              await read(db, "outbox", value.entries[1].operation.operationId)
            ) === JSON.stringify(value.entries[1])
          )
          const result = outcome(
            await read(
              db,
              "syncMetadata",
              `operation-outcome:${entry.operation.operationId}`
            )
          )
          assert(result.local.length === 1 && result.base.length === 1)
          if (state !== "conflict")
            assert(
              result.local[0].record === null && result.base[0].record === null
            )
        }
      }
    )
    await check(
      "El lease vigente, la intención y la partición se validan antes de escribir",
      async () => {
        const value = fixture(false)
        await seed(db, value)
        const before = JSON.stringify(await snapshot(db))
        await refused(() =>
          applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            senderId: crypto.randomUUID(),
          })
        )
        await refused(() =>
          applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            operation: { ...value.submission.operation, baseRevision: 99 },
          })
        )
        await refused(() =>
          applyLocalPreferenceResult(db, otherUserId, value.submission)
        )
        await refused(() =>
          applyLocalPreferenceResult(other, userId, value.submission)
        )
        assert(JSON.stringify(await snapshot(db)) === before)
        assert((await snapshot(other)).outbox.length === 0)
        assert(
          (await applyLocalPreferenceResult(db, userId, value.submission)) ===
            "applied"
        )
      }
    )
    await check(
      "Una vista personal se aplica sin alterar contenido ni otra cuenta",
      async () => {
        const value = fixture(false)
        const itemId = crypto.randomUUID()
        const operation = {
          ...value.submission.operation,
          command: {
            type: "item-view.set" as const,
            itemId,
            primaryTagId: null,
          },
        }
        const effect: PreferenceEffect = {
          store: "itemViews",
          record: itemViewSchema.parse({
            itemId,
            userId,
            primaryTagId: null,
            revision: 3,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          }),
        }
        value.submission.operation = operation
        value.submission.result = {
          kind: "preference",
          outcome: {
            status: "applied",
            operationId: operation.operationId,
            effects: {
              version: 1,
              userId,
              operationId: operation.operationId,
              sequence: 4,
              effects: [effect],
            },
          },
        }
        value.entries = [
          { ...value.entries[0], entityKey: `item-view:${itemId}`, operation },
        ]
        value.shadows = []
        await seed(db, value)
        await applyLocalPreferenceResult(db, userId, value.submission)
        assert(
          JSON.stringify(await read(db, "itemViews", itemId)) ===
            JSON.stringify(effect.record)
        )
        const result = outcome(
          await read(
            db,
            "syncMetadata",
            `operation-outcome:${operation.operationId}`
          )
        )
        assert(
          result.local[0].record === null && result.base[0].record === null
        )
        assert((await snapshot(other)).itemViews.length === 0)
      }
    )
    await check(
      "La partición equivocada se rechaza incluso si contiene registros del actor validado",
      async () => {
        const value = fixture(false)
        await seed(other, value)
        const before = JSON.stringify(await snapshot(other))
        await rejectsBeforeTransaction(other, () =>
          applyLocalPreferenceResult(other, userId, value.submission)
        )
        assert(JSON.stringify(await snapshot(other)) === before)
      }
    )
    await check(
      "Los efectos personales sin soporte se rechazan antes de abrir la transacción",
      async () => {
        const value = fixture(false)
        await seed(db, value)
        const before = JSON.stringify(await snapshot(db))
        assert(value.submission.result.outcome.status === "applied")
        value.submission.result.outcome.effects.effects.push({
          store: "settings",
          record: {
            userId,
            timeZone: "Europe/Madrid",
            locale: "es-ES",
            weekStartsOn: 1,
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          },
        })
        await rejectsBeforeTransaction(db, () =>
          applyLocalPreferenceResult(db, userId, value.submission)
        )
        assert(JSON.stringify(await snapshot(db)) === before)
      }
    )
    await check(
      "La evidencia futura ajena a la operación y los stores sin soporte detienen todo el conjunto",
      async () => {
        const value = fixture(false)
        await seed(db, value)
        await runLocalTransaction<void>(
          db,
          ["remoteShadows"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("remoteShadows").put({
              version: 3,
              entityKey: `item:${crypto.randomUUID()}`,
              record: {},
            })
            context.setResult(undefined)
          }
        )
        const before = JSON.stringify(await snapshot(db))
        await refused(() =>
          applyLocalPreferenceResult(db, userId, value.submission)
        )
        assert(JSON.stringify(await snapshot(db)) === before)
        await seed(db, value)
        await refused(() =>
          applyLocalPreferenceResult(db, userId, {
            ...value.submission,
            operation: {
              ...value.submission.operation,
              command: {
                type: "settings.update",
                input: {
                  timeZone: "Europe/Madrid",
                  locale: "es-ES",
                  weekStartsOn: 1,
                },
              },
            },
            result: {
              kind: "preference",
              outcome: {
                operationId: value.submission.operation.operationId,
                status: "unsupported",
              },
            },
          })
        )
        assert(
          (
            (await read(
              db,
              "outbox",
              value.submission.operation.operationId
            )) as OutboxEntry
          ).state === "sending"
        )
      }
    )
    await check(
      "Un fallo tardío del outcome revierte efectos, shadows, cola y metadata juntos",
      async () => {
        const value = fixture(false)
        await seed(db, value)
        const before = JSON.stringify(await snapshot(db))
        const original = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (
          record: unknown,
          key?: IDBValidKey
        ) {
          if (
            this.name === "syncMetadata" &&
            typeof record === "object" &&
            record !== null &&
            "key" in record &&
            String(record.key).startsWith("operation-outcome:")
          )
            throw new Error("Injected late outcome failure")
          return key === undefined
            ? original.call(this, record)
            : original.call(this, record, key)
        }
        try {
          await refused(() =>
            applyLocalPreferenceResult(db, userId, value.submission)
          )
        } finally {
          IDBObjectStore.prototype.put = original
        }
        assert(JSON.stringify(await snapshot(db)) === before)
        assert(
          (await applyLocalPreferenceResult(db, userId, value.submission)) ===
            "applied"
        )
      }
    )
    await check(
      "Los límites detectan la fila 10001 y nunca confirman una lectura truncada",
      async () => {
        const value = fixture(false)
        value.tags = Array.from(
          { length: 10001 },
          () => tag(crypto.randomUUID(), 0).record
        )
        await seed(db, value)
        await refused(() =>
          applyLocalPreferenceResult(db, userId, value.submission)
        )
        assert((await snapshot(db)).tags.length === 10001)
        assert(
          (
            (await read(
              db,
              "outbox",
              value.submission.operation.operationId
            )) as OutboxEntry
          ).state === "sending"
        )
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
          reject(new Error("Personal fixture cleanup blocked"))
      })
  }
}
runChecks().catch((error: unknown) => {
  statusElement.textContent = "La comprobación ha fallado."
  console.error(error)
})
