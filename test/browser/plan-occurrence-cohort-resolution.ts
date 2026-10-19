import {
  readPlanOccurrenceCohortComparison,
  resolvePlanOccurrenceCohort,
} from "@/features/sync/local-plan-occurrence-cohort-resolution"
import { planOccurrenceCohortResolutionFixture } from "@/lib/backup/plan-occurrence-cohort-resolution-fixture"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { readLocalPlanOccurrenceCohortComparison } from "@/lib/local-db/plan-occurrence-cohort-capture"
import { resolveLocalPlanOccurrenceCohort } from "@/lib/local-db/plan-occurrence-cohort-resolution"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planOccurrenceCohortRetryOperationCount } from "@/lib/sync/plan-occurrence-cohort-resolution"
import { entityIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceCohortResolutionRequest } from "@/types/plan-occurrence-cohort-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Cohort proof requires its own loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-appearance-cohort`,
  name = localDatabaseName(actor)
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Cohort proof status missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Owned partition already exists"
  )
  let database = await openLocalDatabase(actor)
  const f = planOccurrenceCohortResolutionFixture(true, false, actor)
  const stores = [...database.objectStoreNames]
  let checks = 0,
    notices = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  async function seed(source = f.source) {
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const key of stores) context.transaction.objectStore(key).clear()
      context.transaction.objectStore("items").add(source.series)
      for (const record of source.occurrences)
        context.transaction.objectStore("occurrences").add(record)
      for (const entry of source.entries)
        context.transaction.objectStore("outbox").add(entry)
      for (const shadow of source.shadows)
        context.transaction.objectStore("remoteShadows").add(shadow)
      for (const outcome of source.outcomes)
        context.transaction.objectStore("syncMetadata").add(outcome)
      context.transaction.objectStore("syncMetadata").add({
        key: "outbox-sequence",
        value: Math.max(...source.entries.map((entry) => entry.sequence)),
      })
      context.setResult(true)
    })
  }
  async function raw() {
    return runLocalTransaction<string>(
      database,
      stores,
      "readonly",
      (context) => {
        const values: Record<string, unknown> = {}
        let remaining = stores.length
        for (const key of stores) {
          const read = context.transaction.objectStore(key).getAll()
          read.onsuccess = () => {
            values[key] = read.result
            if (!--remaining) context.setResult(JSON.stringify(values))
          }
        }
      }
    )
  }
  async function mutate(key: string, value: unknown) {
    await runLocalTransaction(database, [key], "readwrite", (context) => {
      context.transaction.objectStore(key).put(value)
      context.setResult(true)
    })
  }
  async function remove(key: string, id: string) {
    await runLocalTransaction(database, [key], "readwrite", (context) => {
      context.transaction.objectStore(key).delete(id)
      context.setResult(true)
    })
  }
  async function request(
    choice: "adopt_remote" | "retry_local" = "retry_local"
  ): Promise<PlanOccurrenceCohortResolutionRequest> {
    const expected = await readLocalPlanOccurrenceCohortComparison(
      database,
      actor,
      f.source.operationId
    )
    return {
      ...f.request,
      expected,
      choice,
      resolutionId: crypto.randomUUID(),
      operationIds:
        choice === "retry_local"
          ? Array.from(
              { length: planOccurrenceCohortRetryOperationCount(expected) },
              () => crypto.randomUUID()
            )
          : [],
    }
  }
  async function rejected(work: () => Promise<unknown>) {
    const before = await raw(),
      beforeNotices = notices
    let failed = false
    try {
      await work()
    } catch {
      failed = true
    }
    assert(
      failed && before === (await raw()) && beforeNotices === notices,
      "Rejected cohort operation mutated its partition"
    )
  }
  async function check(label: string, work: () => Promise<void>) {
    await seed()
    await work()
    checks++
    const row = document.createElement("li")
    row.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(row)
  }
  async function clearOwnedControl() {
    const control = await readAccountControl()
    assert(
      control.userId === null || control.userId === actor,
      "Control belongs to another identity"
    )
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(ACCOUNT_CONTROL_DATABASE)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned control cleanup blocked"))
    })
  }
  try {
    await check(
      "Captura coherente de padre, dos fechas y dependencias intercaladas sin escrituras",
      async () => {
        const before = await raw(),
          input = await request()
        assert(
          before === (await raw()) &&
            input.expected.operationIds.length === 3 &&
            input.expected.slots.length === 2 &&
            input.expected.source.entries
              .map((entry) => entry.sequence)
              .join() === "1,2,3",
          "Readonly capture changed history"
        )
      }
    )
    await check(
      "Cuenta y comparación obsoletas preservan todo el estado",
      async () => {
        const input = await request()
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, "foreign", input)
        )
        for (const [store, record] of [
          ["items", { ...f.source.series, title: "Changed parent" }],
          ["occurrences", { ...f.source.occurrences[1], cancelled: true }],
          [
            "remoteShadows",
            {
              ...f.source.shadows[1],
              record: { ...f.source.shadows[1].record, revision: 3 },
            },
          ],
        ] as const) {
          await seed()
          await mutate(store, record)
          await rejected(() =>
            resolveLocalPlanOccurrenceCohort(database, actor, input)
          )
        }
      }
    )
    await check(
      "Intentada posterior y dependiente externo impiden supersesión parcial",
      async () => {
        const input = await request()
        await mutate("outbox", { ...f.source.entries[1], attempts: 1 })
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, input)
        )
        await seed()
        await mutate("outbox", {
          ...f.source.entries[1],
          operation: {
            ...f.source.entries[1].operation,
            operationId: crypto.randomUUID(),
            command: { type: "tag.delete", tagId: crypto.randomUUID() },
          },
          entityKey: `tag:${crypto.randomUUID()}`,
          sequence: 4,
        })
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, input)
        )
      }
    )
    await check(
      "Outcome o remoto desconocidos no se convierten en decisiones",
      async () => {
        const input = await request()
        await remove("syncMetadata", f.source.outcomes[0].key)
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, input)
        )
        await seed()
        await remove("remoteShadows", f.source.shadows[1].entityKey)
        await rejected(() =>
          readLocalPlanOccurrenceCohortComparison(
            database,
            actor,
            f.source.operationId
          )
        )
      }
    )
    await check(
      "Prerrequisito confirmado requiere outcome durable y no sólo estado ACK",
      async () => {
        const dependency = planOccurrenceCohortResolutionFixture(
          true,
          true,
          actor
        )
        await seed(dependency.source)
        const expected = await readLocalPlanOccurrenceCohortComparison(
          database,
          actor,
          dependency.source.operationId
        )
        const input = { ...dependency.request, expected }
        await remove("syncMetadata", dependency.source.outcomes[0].key)
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, input)
        )
      }
    )
    await check(
      "Identidad de slot con padre corrupto no se oculta como borrador ausente",
      async () => {
        const input = await request()
        await mutate("occurrences", {
          ...f.source.occurrences[1],
          seriesId: crypto.randomUUID(),
        })
        await rejected(() =>
          readLocalPlanOccurrenceCohortComparison(
            database,
            actor,
            f.source.operationId
          )
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, {
            ...input,
            choice: "adopt_remote",
            operationIds: [],
          })
        )
      }
    )
    await check(
      "Fallo tardío del recibo revierte excepciones, originales, reemplazos y contador",
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
            String(value.key).startsWith("appearance-cohort-resolution:")
          )
            throw new Error("Owned late cohort failure")
          return add.call(this, value, key)
        }
        try {
          await rejected(() =>
            resolveLocalPlanOccurrenceCohort(database, actor, input)
          )
        } finally {
          IDBObjectStore.prototype.add = add
        }
      }
    )
    await check(
      "Identidades globales de cola y metadata no se reutilizan",
      async () => {
        const input = await request()
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, {
            ...input,
            resolutionId: f.source.operationId,
          })
        )
        await mutate("syncMetadata", {
          key: "proof-other-decision",
          resolutionId: input.operationIds[0],
        })
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, input)
        )
      }
    )
    await check(
      "Contador ausente, atrasado o agotado no se repara automáticamente",
      async () => {
        const input = await request()
        for (const value of [null, 2, Number.MAX_SAFE_INTEGER]) {
          await seed()
          if (value === null) await remove("syncMetadata", "outbox-sequence")
          else await mutate("syncMetadata", { key: "outbox-sequence", value })
          await rejected(() =>
            resolveLocalPlanOccurrenceCohort(database, actor, input)
          )
        }
      }
    )
    await check(
      "Reintento conjunto durable y replay tras editar y reabrir conservan historia",
      async () => {
        const input = await request(),
          result = await resolveLocalPlanOccurrenceCohort(
            database,
            actor,
            input
          )
        const backup = await readLocalRecurringBackup(
          database,
          actor,
          f.request.createdAt
        )
        assert(
          result.status === "applied" &&
            backup.stores.outbox.filter((entry) => entry.state === "superseded")
              .length === 3 &&
            backup.stores.outbox.filter((entry) => entry.state === "pending")
              .length === 4 &&
            backup.stores.outbox.every(
              (entry) => entry.state !== "acknowledged"
            ),
          "Joint decision manufactured an ACK or lost a slot"
        )
        assert(
          JSON.stringify(backup.stores.items[0]) ===
            JSON.stringify(f.source.series),
          "Joint decision modified parent"
        )
        await mutate("occurrences", {
          ...result.record.locals[0].record,
          cancelled: true,
        })
        await mutate("items", { ...f.source.series, title: "Later edit" })
        const later = await raw()
        database.close()
        database = await openLocalDatabase(actor)
        assert(
          (await resolveLocalPlanOccurrenceCohort(database, actor, input))
            .status === "replayed" && later === (await raw()),
          "Replay rewrote later work"
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, {
            ...input,
            createdAt: "2026-10-19T17:01:00.000Z",
          })
        )
      }
    )
    await check(
      "Adopción conjunta no añade operaciones ni incrementa el contador",
      async () => {
        const result = await resolveLocalPlanOccurrenceCohort(
          database,
          actor,
          await request("adopt_remote")
        )
        const backup = await readLocalRecurringBackup(
          database,
          actor,
          f.request.createdAt
        )
        assert(
          result.record.replacements.length === 0 &&
            backup.stores.outbox.length === 3 &&
            result.record.locals.every(
              (slot) =>
                JSON.stringify(slot.record) ===
                JSON.stringify(
                  result.record.expected.slots.find(
                    (value) => value.occurrenceId === slot.occurrenceId
                  )?.remote
                )
            ) &&
            backup.stores.syncMetadata.some(
              (value) =>
                value.key === "outbox-sequence" &&
                "value" in value &&
                value.value === 3
            ),
          "Adoption changed queue or counter"
        )
      }
    )
    await check(
      "Último espacio de metadata permite decisión y replay previo sin borrar historia",
      async () => {
        const input = await request()
        await runLocalTransaction(
          database,
          ["syncMetadata"],
          "readwrite",
          (context) => {
            for (let i = 0; i < 9998; i++)
              context.transaction
                .objectStore("syncMetadata")
                .add({ key: `proof-capacity:${i}` })
            context.setResult(true)
          }
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, input)
        )
        await remove("syncMetadata", "proof-capacity:0")
        assert(
          (await resolveLocalPlanOccurrenceCohort(database, actor, input))
            .status === "applied",
          "Last metadata slot rejected"
        )
        const full = await raw()
        assert(
          (await resolveLocalPlanOccurrenceCohort(database, actor, input))
            .status === "replayed" && full === (await raw()),
          "Full metadata blocked replay"
        )
      }
    )
    await check(
      "Cadena completa debe caber en outbox y adopción no borra otras intenciones",
      async () => {
        await runLocalTransaction(
          database,
          ["outbox", "syncMetadata"],
          "readwrite",
          (context) => {
            const tagId = crypto.randomUUID()
            for (let sequence = 4; sequence <= 9998; sequence++)
              context.transaction.objectStore("outbox").add({
                ...f.source.entries[1],
                operation: {
                  operationId: crypto.randomUUID(),
                  protocolVersion: 1,
                  baseRevision: 1,
                  command: { type: "tag.delete", tagId },
                },
                entityKey: `tag:${tagId}`,
                sequence,
                dependencies: [],
              })
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 9998 })
            context.setResult(true)
          }
        )
        const adopt = await request("adopt_remote")
        await rejected(() =>
          resolveLocalPlanOccurrenceCohort(database, actor, {
            ...adopt,
            choice: "retry_local",
            operationIds: Array.from({ length: 4 }, () => crypto.randomUUID()),
          })
        )
        assert(
          (await resolveLocalPlanOccurrenceCohort(database, actor, adopt))
            .status === "applied",
          "Zero-operation adoption rejected"
        )
      }
    )
    await check(
      "Cuenta y época antes y después de apertura protegen lectura y decisión",
      async () => {
        await clearOwnedControl()
        const prior = await readAccountControl(),
          control = await activatePreparedAccount(
            actor,
            f.request.createdAt,
            prior.epoch
          )
        const account = { userId: actor, epoch: control.epoch },
          input = await request()
        const before = await raw()
        await readPlanOccurrenceCohortComparison(account, f.source.operationId)
        assert(before === (await raw()), "Feature comparison mutated storage")
        await rejected(() =>
          readPlanOccurrenceCohortComparison(
            { ...account, epoch: crypto.randomUUID() },
            f.source.operationId
          )
        )
        await rejected(() =>
          resolvePlanOccurrenceCohort(
            { ...account, epoch: crypto.randomUUID() },
            input
          )
        )
        await rejected(() =>
          resolvePlanOccurrenceCohort(account, { ...input, userId: "foreign" })
        )
        const open = LocalSyncStore.open
        LocalSyncStore.open = async (id: string) => {
          const store = await open(id),
            current = await readAccountControl()
          await activatePreparedAccount(
            actor,
            f.request.createdAt,
            current.epoch
          )
          return store
        }
        try {
          await rejected(() =>
            readPlanOccurrenceCohortComparison(account, f.source.operationId)
          )
          const current = await readAccountControl()
          await rejected(() =>
            resolvePlanOccurrenceCohort(
              { userId: actor, epoch: current.epoch },
              input
            )
          )
        } finally {
          LocalSyncStore.open = open
        }
      }
    )
    await check(
      "Commit durable emite un aviso local; fallo y replay no emiten",
      async () => {
        const control = await readAccountControl(),
          account = { userId: actor, epoch: control.epoch },
          input = await request()
        const add = IDBObjectStore.prototype.add
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
            String(value.key).startsWith("appearance-cohort-resolution:")
          )
            throw new Error("Owned feature rollback")
          return add.call(this, value, key)
        }
        try {
          await rejected(() => resolvePlanOccurrenceCohort(account, input))
        } finally {
          IDBObjectStore.prototype.add = add
        }
        let localNotices = 0
        const localNotice = (event: Event) => {
          if (event instanceof CustomEvent && event.detail?.userId === actor)
            localNotices++
        }
        window.addEventListener("dalis:outbox-changed", localNotice)
        const count = notices,
          observed: Promise<boolean>[] = []
        const stop = subscribeLocalOutboxChanges(actor, () => {
          observed.push(
            readLocalRecurringBackup(database, actor, f.request.createdAt).then(
              (backup) =>
                backup.stores.syncMetadata.some(
                  (value) =>
                    value.key ===
                    `appearance-cohort-resolution:${input.resolutionId}`
                )
            )
          )
        })
        try {
          assert(
            (await resolvePlanOccurrenceCohort(account, input)).status ===
              "applied" &&
              localNotices === 1 &&
              notices > count,
            "Commit notification missing or duplicated"
          )
          assert(
            observed.length >= 1 &&
              (await Promise.all(observed)).every(Boolean),
            "Notification preceded durable decision"
          )
          const later = await raw()
          assert(
            (await resolvePlanOccurrenceCohort(account, input)).status ===
              "replayed" &&
              localNotices === 1 &&
              later === (await raw()),
            "Replay wrote or notified"
          )
        } finally {
          window.removeEventListener("dalis:outbox-changed", localNotice)
          stop()
        }
      }
    )
  } finally {
    unsubscribe()
    database.close()
    await clearOwnedControl()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned cohort cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición y control propios eliminados`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
