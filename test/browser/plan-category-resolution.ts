import {
  readPlanCategoryIncidentComparison,
  resolvePlanCategoryIncident,
} from "@/features/sync/local-plan-category-resolution"
import { planCategoryResolutionFixture } from "@/lib/backup/plan-category-resolution-fixture"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { resolveLocalPlanCategoryIncident } from "@/lib/local-db/plan-category-resolution"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import type { PlanCategoryResolutionRequest } from "@/types/plan-category-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Joint decision proof requires its own loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-joint-resolution`,
  name = localDatabaseName(actor)
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Joint decision status missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Proof partition exists"
  )
  let database = await openLocalDatabase(actor)
  let store = await LocalSyncStore.open(actor)
  const f = planCategoryResolutionFixture(actor),
    stores = [...database.objectStoreNames]
  let checks = 0,
    notices = 0
  const unsubscribe = subscribeLocalOutboxChanges(actor, () => notices++)
  async function seed() {
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const key of stores) context.transaction.objectStore(key).clear()
      context.transaction.objectStore("items").add(f.local)
      context.transaction.objectStore("tags").add(f.tag)
      context.transaction.objectStore("itemViews").add(f.view)
      context.transaction.objectStore("remoteShadows").add({
        version: 2,
        kind: "preference",
        entityKey: `item-view:${f.local.id}`,
        record: { store: "itemViews", record: f.remoteView },
      })
      for (const entry of f.capture.entries)
        context.transaction.objectStore("outbox").add(entry)
      context.transaction.objectStore("syncMetadata").add(f.outcome)
      context.transaction
        .objectStore("syncMetadata")
        .add({ key: "outbox-sequence", value: 3 })
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
  async function request(
    choice: "adopt_remote" | "retry_local" = "retry_local"
  ): Promise<PlanCategoryResolutionRequest> {
    return {
      ...f.request,
      choice,
      operationId: choice === "retry_local" ? crypto.randomUUID() : null,
      viewOperationId: choice === "retry_local" ? crypto.randomUUID() : null,
      resolutionId: crypto.randomUUID(),
      expected: await store.readPlanCategoryIncidentSnapshot(
        f.entry.operation.operationId
      ),
    }
  }
  async function mutate(key: string, value: unknown) {
    await runLocalTransaction(database, [key], "readwrite", (context) => {
      context.transaction.objectStore(key).put(value)
      context.setResult(true)
    })
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
      failed && before === (await raw()) && notices === beforeNotices,
      "Rejected joint decision mutated or notified"
    )
  }
  async function check(label: string, work: () => Promise<void>) {
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
      "Control belongs to another account"
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
    await seed()
    await check(
      "Cuenta ajena y comparación obsoleta no cambian datos",
      async () => {
        const input = await request()
        await rejected(() =>
          resolveLocalPlanCategoryIncident(database, "foreign-owner", input)
        )
        await rejected(() =>
          store.resolvePlanCategoryIncident({
            ...input,
            expected: {
              ...input.expected,
              remoteView: { ...input.expected.remoteView, revision: 8 },
            },
          })
        )
        for (const [key, value] of [
          ["items", { ...f.local, title: "Later draft" }],
          ["itemViews", { ...f.view, primaryTagId: null }],
          ["tags", { ...f.tag, color: "#abcdef" }],
        ] as const) {
          await seed()
          await mutate(key, value)
          await rejected(() => store.resolvePlanCategoryIncident(input))
        }
      }
    )
    await seed()
    await check(
      "Fallo al añadir recibo revierte contenido, vista, cola y contador",
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
            String(value.key).startsWith("plan-category-resolution:")
          )
            throw new Error("Owned late joint failure")
          return add.call(this, value, key)
        }
        try {
          await rejected(() => store.resolvePlanCategoryIncident(input))
        } finally {
          IDBObjectStore.prototype.add = add
        }
      }
    )
    await check(
      "UUID global de cola y decisiones anteriores no se reutiliza",
      async () => {
        const input = await request()
        await rejected(() =>
          store.resolvePlanCategoryIncident({
            ...input,
            viewOperationId: f.entry.operation.operationId,
          })
        )
        await mutate("syncMetadata", {
          key: "proof-prior-decision",
          resolutionId: input.resolutionId,
        })
        await rejected(() => store.resolvePlanCategoryIncident(input))
      }
    )
    await seed()
    await check(
      "Contador atrasado o agotado rechaza sin escritura parcial",
      async () => {
        const input = await request()
        for (const value of [
          2,
          Number.MAX_SAFE_INTEGER - 1,
          Number.MAX_SAFE_INTEGER,
        ]) {
          await mutate("syncMetadata", { key: "outbox-sequence", value })
          await rejected(() => store.resolvePlanCategoryIncident(input))
        }
      }
    )
    await seed()
    await check(
      "Dependiente externo y asignación intentada requieren otra revisión",
      async () => {
        const input = await request()
        await mutate("outbox", { ...f.assignment, attempts: 1 })
        await rejected(() => store.resolvePlanCategoryIncident(input))
        await seed()
        const id = crypto.randomUUID()
        await mutate("outbox", {
          ...f.assignment,
          sequence: 4,
          entityKey: `item-view:${id}`,
          operation: {
            ...f.assignment.operation,
            operationId: crypto.randomUUID(),
            command: { type: "item-view.set", itemId: id, primaryTagId: null },
          },
        })
        await mutate("syncMetadata", { key: "outbox-sequence", value: 4 })
        await rejected(() => store.resolvePlanCategoryIncident(input))
      }
    )
    await seed()
    await check(
      "Categoría ausente permite adoptar pero nunca reenviar asignación desconocida",
      async () => {
        const input = await request()
        await runLocalTransaction(
          database,
          ["tags"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("tags").delete(f.tag.id)
            context.setResult(true)
          }
        )
        await rejected(() => store.resolvePlanCategoryIncident(input))
        const retry = await request()
        await rejected(() => store.resolvePlanCategoryIncident(retry))
        const result = await store.resolvePlanCategoryIncident(
          await request("adopt_remote")
        )
        assert(
          result.record.view.primaryTagId === null &&
            !result.record.replacement,
          "Unknown category adopted incorrectly"
        )
      }
    )
    await seed()
    await check(
      "Retry guarda ambos CAS y UUID nuevos enlazados, originales exactos sin ACK",
      async () => {
        const input = await request(),
          previous = notices
        const result = await store.resolvePlanCategoryIncident(input)
        assert(
          result.status === "applied" && notices > previous,
          "Commit notification missing"
        )
        const backup = await readLocalRecurringBackup(database, actor, f.now)
        assert(
          backup.stores.outbox.length === 5 &&
            backup.stores.outbox.filter((entry) => entry.state === "superseded")
              .length === 3 &&
            !backup.stores.outbox.some(
              (entry) => entry.state === "acknowledged"
            ),
          "Joint writer invented ACK or lost cohort"
        )
        const entries = backup.stores.outbox.toSorted(
          (a, b) => a.sequence - b.sequence
        )
        assert(
          entries[3].operation.baseRevision === 5 &&
            entries[4].operation.baseRevision === 7 &&
            entries[3].dependencies.length === 0 &&
            JSON.stringify(entries[4].dependencies) ===
              JSON.stringify([input.operationId]) &&
            entries[3].attempts === 0 &&
            entries[4].attempts === 0 &&
            entries[4].sequence === 5,
          "Joint retry lost independent CAS or exact replacement chain"
        )
        assert(
          backup.stores.items[0].title === f.local.title &&
            backup.stores.itemViews[0].primaryTagId === f.tag.id,
          "Joint projections incorrect"
        )
        await mutate("outbox", { ...entries[3], attempts: 1 })
        await readLocalRecurringBackup(database, actor, f.now)
        await mutate("items", {
          ...result.record.local,
          title: "Later local draft",
        })
        await mutate("itemViews", { ...result.record.view, primaryTagId: null })
        const later = await raw(),
          count = notices
        assert(
          (await store.resolvePlanCategoryIncident(input)).status ===
            "replayed" &&
            later === (await raw()) &&
            notices === count,
          "Replay overwrote later edits or notified"
        )
        await rejected(() =>
          store.resolvePlanCategoryIncident({
            ...input,
            createdAt: "2026-10-18T10:31:00.000Z",
          })
        )
        database.close()
        store.close()
        database = await openLocalDatabase(actor)
        store = await LocalSyncStore.open(actor)
        assert(
          later === (await raw()) &&
            (await store.resolvePlanCategoryIncident(input)).status ===
              "replayed",
          "Reopen changed joint evidence"
        )
      }
    )
    await seed()
    await check(
      "Adopción guarda ambas versiones remotas sin operaciones ni incremento de contador",
      async () => {
        const result = await store.resolvePlanCategoryIncident(
          await request("adopt_remote")
        )
        const backup = await readLocalRecurringBackup(database, actor, f.now)
        assert(
          !result.record.replacement &&
            !result.record.viewReplacement &&
            backup.stores.outbox.length === 3 &&
            backup.stores.items[0].title === f.remote.title &&
            backup.stores.itemViews[0].primaryTagId === null &&
            backup.stores.syncMetadata.some(
              (value) =>
                value.key === "outbox-sequence" &&
                "value" in value &&
                value.value === 3
            ),
          "Adoption created operations"
        )
      }
    )
    await seed()
    await check(
      "Límite de metadata posterior y replay previo conservan historia",
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
                .add({ key: `proof-capacity:${index}` })
            context.setResult(true)
          }
        )
        await rejected(() => store.resolvePlanCategoryIncident(input))
        await runLocalTransaction(
          database,
          ["syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("syncMetadata")
              .delete("proof-capacity:0")
            context.setResult(true)
          }
        )
        assert(
          (await store.resolvePlanCategoryIncident(input)).status === "applied",
          "Last metadata slot rejected"
        )
        const full = await raw()
        assert(
          (await store.resolvePlanCategoryIncident(input)).status ===
            "replayed" && full === (await raw()),
          "Full metadata blocked durable replay"
        )
      }
    )
    await seed()
    await check("Dos reemplazos deben caber completos en la cola", async () => {
      const input = await request(),
        unrelated = crypto.randomUUID()
      await runLocalTransaction(
        database,
        ["outbox", "syncMetadata"],
        "readwrite",
        (context) => {
          for (let sequence = 4; sequence <= 9999; sequence++)
            context.transaction.objectStore("outbox").add({
              ...f.child,
              sequence,
              entityKey: `item:${unrelated}`,
              dependencies: [],
              operation: {
                ...f.child.operation,
                operationId: crypto.randomUUID(),
                command: {
                  type: "plan.set-status",
                  itemId: unrelated,
                  status: "not_started",
                },
              },
            })
          context.transaction
            .objectStore("syncMetadata")
            .put({ key: "outbox-sequence", value: 9999 })
          context.setResult(true)
        }
      )
      await rejected(() => store.resolvePlanCategoryIncident(input))
      assert(
        (await store.resolvePlanCategoryIncident(await request("adopt_remote")))
          .status === "applied",
        "Full queue blocked zero-operation adoption"
      )
    })
    await seed()
    await check(
      "Cuenta y época vigentes protegen lectura y decisión, también tras apertura",
      async () => {
        await clearOwnedControl()
        const prior = await readAccountControl(),
          control = await activatePreparedAccount(actor, f.now, prior.epoch)
        const account = { userId: actor, epoch: control.epoch },
          input = await request()
        await readPlanCategoryIncidentComparison(
          account,
          f.entry.operation.operationId
        )
        await rejected(() =>
          resolvePlanCategoryIncident(
            { ...account, epoch: crypto.randomUUID() },
            input
          )
        )
        await rejected(() =>
          readPlanCategoryIncidentComparison(
            { ...account, epoch: crypto.randomUUID() },
            f.entry.operation.operationId
          )
        )
        const open = LocalSyncStore.open
        LocalSyncStore.open = async (id: string) => {
          const result = await open(id),
            current = await readAccountControl()
          await activatePreparedAccount(actor, f.now, current.epoch)
          return result
        }
        try {
          await rejected(() => resolvePlanCategoryIncident(account, input))
        } finally {
          LocalSyncStore.open = open
        }
        const current = await readAccountControl()
        assert(
          (
            await resolvePlanCategoryIncident(
              { userId: actor, epoch: current.epoch },
              input
            )
          ).status === "applied",
          "Valid account decision rejected"
        )
      }
    )
  } finally {
    unsubscribe()
    store.close()
    database.close()
    await clearOwnedControl()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned joint cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición y control propios eliminados`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
