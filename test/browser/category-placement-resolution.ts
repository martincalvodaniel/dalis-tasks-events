import {
  readCategoryPlacementIncidentComparison,
  resolveCategoryPlacementIncident,
} from "@/features/sync/local-category-placement-resolution"
import { categoryPlacementResolutionBackupFixture } from "@/lib/backup/category-placement-resolution-fixture"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import {
  resolveLocalCategoryPlacementIncident,
  resolveLocalMixedPlacementIncident,
  resolveLocalPlacementIncident,
  resolveLocalRecurringPlacementIncident as resolveProtectedRecurringPlacementIncident,
} from "@/lib/local-db/placement-resolution"
import {
  readLocalCategoryPlacementResolutionSnapshot,
  readLocalMixedPlacementResolutionSnapshot,
  readLocalPlacementResolutionSnapshot,
  readLocalRecurringPlacementResolutionSnapshot as readProtectedRecurringPlacementSnapshot,
} from "@/lib/local-db/placement-resolution-capture"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import type { CategoryPlacementResolutionRequest } from "@/types/category-placement-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Recurring placement proof requires its own loopback origin")
const runId = entityIdSchema.parse(
    new URLSearchParams(location.search).get("run")
  ),
  actor = `browser-test-${runId}-category-placement`,
  name = localDatabaseName(actor)
const slotInput = new URLSearchParams(location.search).get("slot") ?? "moved"
if (slotInput !== "simple" && slotInput !== "moved" && slotInput !== "implicit")
  throw new Error("Unknown recurring placement proof slot")
const slot: "simple" | "moved" | "implicit" = slotInput
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Recurring placement proof status missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Owned recurring partition already exists"
  )
  let database = await openLocalDatabase(actor)
  const f = categoryPlacementResolutionBackupFixture(true, slot, "day", actor),
    stores = [...database.objectStoreNames]
  let checks = 0,
    notices = 0
  const notified = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.userId === actor)
      notices++
  }
  window.addEventListener("dalis:outbox-changed", notified)
  async function seed() {
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const key of stores) context.transaction.objectStore(key).clear()
      for (const [key, records] of Object.entries(f.backup.stores))
        for (const record of records) {
          if (
            key === "outbox" ||
            key === "syncMetadata" ||
            key === "itemViews" ||
            key === "taskPlacements"
          )
            continue
          context.transaction.objectStore(key).add(record)
        }
      for (const record of f.capture.local.views)
        context.transaction.objectStore("itemViews").add(record)
      for (const record of f.capture.local.placements)
        context.transaction.objectStore("taskPlacements").add(record)
      for (const entry of f.capture.entries)
        context.transaction.objectStore("outbox").add(entry)
      context.transaction.objectStore("syncMetadata").add(f.outcome)
      context.transaction
        .objectStore("syncMetadata")
        .add({ key: "outbox-sequence", value: 2 })
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
          const request = context.transaction.objectStore(key).getAll()
          request.onsuccess = () => {
            values[key] = request.result
            if (!--remaining) context.setResult(JSON.stringify(values))
          }
        }
      }
    )
  }
  async function mutate(store: string, value: unknown) {
    await runLocalTransaction(database, [store], "readwrite", (context) => {
      context.transaction.objectStore(store).put(value)
      context.setResult(true)
    })
  }
  async function remove(store: string, key: IDBValidKey) {
    await runLocalTransaction(database, [store], "readwrite", (context) => {
      context.transaction.objectStore(store).delete(key)
      context.setResult(true)
    })
  }
  async function request(
    choice: CategoryPlacementResolutionRequest["choice"] = "retry_latest_move"
  ): Promise<CategoryPlacementResolutionRequest> {
    return {
      ...f.request,
      resolutionId: crypto.randomUUID(),
      operationId: choice === "retry_latest_move" ? crypto.randomUUID() : null,
      choice,
      expected: await readLocalCategoryPlacementResolutionSnapshot(
        database,
        actor,
        f.entry.operation.operationId
      ),
    }
  }
  async function rejected(work: () => Promise<unknown>) {
    const before = await raw(),
      count = notices
    let failed = false
    try {
      await work()
    } catch {
      failed = true
    }
    assert(
      failed && before === (await raw()) && count === notices,
      "Rejected recurring recovery mutated storage or notified"
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
      "Account control belongs to another identity"
    )
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(ACCOUNT_CONTROL_DATABASE)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned recurring control cleanup blocked"))
    })
  }
  try {
    await check(
      "Captura conjunta de solo lectura y familias anteriores protegidas",
      async () => {
        const before = await raw(),
          input = await request()
        assert(
          before === (await raw()) &&
            input.expected.observed.occurrences.length === 1 &&
            input.expected.observed.items.length === 4,
          "Recurring capture lost recurring context"
        )
        await rejected(() =>
          readLocalPlacementResolutionSnapshot(
            database,
            actor,
            f.entry.operation.operationId
          )
        )
        await rejected(() =>
          resolveLocalPlacementIncident(database, actor, input)
        )
        await rejected(() =>
          readLocalMixedPlacementResolutionSnapshot(
            database,
            actor,
            f.entry.operation.operationId
          )
        )
        await rejected(() =>
          resolveLocalMixedPlacementIncident(database, actor, input)
        )
      }
    )
    await check(
      "La familia recurrente anterior no acepta decisiones entre categorías",
      async () => {
        const input = await request()
        await rejected(() =>
          readProtectedRecurringPlacementSnapshot(
            database,
            actor,
            f.entry.operation.operationId
          )
        )
        await rejected(() =>
          resolveProtectedRecurringPlacementIncident(database, actor, input)
        )
      }
    )
    await check("Cuenta y contexto obsoletos no se reinterpretan", async () => {
      const input = await request()
      await rejected(() =>
        resolveLocalCategoryPlacementIncident(database, "foreign", input)
      )
      for (const [key, value] of [
        ["items", { ...f.f.series, title: "Later parent" }],
        ["occurrences", { ...f.f.moved, cancelled: true }],
        [
          "itemViews",
          { ...f.capture.local.views[0], primaryTagId: crypto.randomUUID() },
        ],
      ] as const) {
        await seed()
        await mutate(key, value)
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, input)
        )
      }
    })
    await check(
      "Remotos desconocidos o posiciones locales nuevas permanecen protegidos",
      async () => {
        const input = await request()
        await remove("remoteShadows", `plan-occurrence:${f.f.moved.id}`)
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, input)
        )
        await seed()
        await mutate("taskPlacements", {
          ...f.f.simple.original[0],
          occurrenceId: f.f.implicit.id,
          revision: 0,
        })
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, input)
        )
      }
    )
    await check(
      "Otra intención pendiente preserva la cadena completa",
      async () => {
        const input = await request()
        await mutate("outbox", {
          ...f.child,
          sequence: 3,
          entityKey: `tag:${crypto.randomUUID()}`,
          dependencies: [],
          operation: {
            operationId: crypto.randomUUID(),
            protocolVersion: 1,
            baseRevision: 0,
            command: { type: "tag.delete", tagId: crypto.randomUUID() },
          },
        })
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, input)
        )
      }
    )
    await check(
      "Fallo tardío revierte categoría, posiciones, cola, tail, contador y recibo",
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
            "reviewKind" in value &&
            value.reviewKind === "category_movement"
          )
            throw new Error("Owned recurring late failure")
          return add.call(this, value, key)
        }
        try {
          await rejected(() =>
            resolveLocalCategoryPlacementIncident(database, actor, input)
          )
        } finally {
          IDBObjectStore.prototype.add = add
        }
      }
    )
    await check(
      "Identidades globales y contador inválido no se reparan",
      async () => {
        const input = await request()
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, {
            ...input,
            resolutionId: f.entry.operation.operationId,
          })
        )
        await mutate("syncMetadata", {
          key: "proof-existing",
          resolutionId: input.operationId,
        })
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, input)
        )
        for (const value of [1, Number.MAX_SAFE_INTEGER]) {
          await seed()
          await mutate("syncMetadata", { key: "outbox-sequence", value })
          await rejected(() =>
            resolveLocalCategoryPlacementIncident(database, actor, input)
          )
        }
      }
    )
    await check(
      "Reintento conserva evidencia portable, proyección y tail y sobrevive recarga",
      async () => {
        const input = await request(),
          result = await resolveLocalCategoryPlacementIncident(
            database,
            actor,
            input
          )
        const backup = await readLocalRecurringBackup(database, actor, f.now)
        assert(
          result.status === "applied" &&
            result.record.reviewKind === "category_movement" &&
            backup.stores.outbox.length === 3 &&
            backup.stores.outbox[0].state !== "acknowledged" &&
            result.record.placements.every((record) =>
              backup.stores.taskPlacements.some(
                (value) => JSON.stringify(value) === JSON.stringify(record)
              )
            ) &&
            JSON.stringify(
              backup.stores.itemViews.find((view) => view.itemId === f.parentId)
            ) === JSON.stringify(result.record.view) &&
            result.record.view.primaryTagId === f.destinationId,
          "Recurring retry lost pending projection"
        )
        assert(
          backup.stores.syncMetadata.some(
            (value) =>
              value.key === "preference-tail" &&
              "operationId" in value &&
              value.operationId === result.record.operationId
          ),
          "Recurring retry tail missing"
        )
        await mutate("items", { ...f.f.series, title: "Later edit" })
        const later = await raw()
        database.close()
        database = await openLocalDatabase(actor)
        assert(
          (await resolveLocalCategoryPlacementIncident(database, actor, input))
            .status === "replayed" && later === (await raw()),
          "Recurring replay rewrote later data"
        )
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, {
            ...input,
            createdAt: "2026-10-20T02:00:00.000Z",
          })
        )
      }
    )
    await check(
      "Adopción restaura categoría y posiciones sin operaciones ni tail nuevos",
      async () => {
        const result = await resolveLocalCategoryPlacementIncident(
            database,
            actor,
            await request("adopt_remote")
          ),
          backup = await readLocalRecurringBackup(database, actor, f.now)
        assert(
          result.record.replacement === null &&
            backup.stores.outbox.length === 2 &&
            backup.stores.taskPlacements.length ===
              f.snapshot.observed.placements.length &&
            !backup.stores.syncMetadata.some(
              (value) => value.key === "preference-tail"
            ),
          "Recurring adoption created an intention or tail"
        )
        assert(
          backup.stores.itemViews.find((view) => view.itemId === f.parentId)
            ?.primaryTagId === f.sourceId,
          "Category adoption failed to restore its reviewed parent assignment"
        )
        assert(
          JSON.stringify(backup.stores.items) ===
            JSON.stringify(
              f.backup.stores.items.toSorted((a, b) => a.id.localeCompare(b.id))
            ),
          "Recurring adoption changed parents"
        )
      }
    )
    await check(
      "Capacidad posterior reserva tail faltante y recibo, replay no añade registros",
      async () => {
        const input = await request()
        await runLocalTransaction(
          database,
          ["syncMetadata"],
          "readwrite",
          (context) => {
            for (let i = 0; i < 9997; i++)
              context.transaction
                .objectStore("syncMetadata")
                .add({ key: `proof-capacity:${i}` })
            context.setResult(true)
          }
        )
        await rejected(() =>
          resolveLocalCategoryPlacementIncident(database, actor, input)
        )
        await remove("syncMetadata", "proof-capacity:0")
        assert(
          (await resolveLocalCategoryPlacementIncident(database, actor, input))
            .status === "applied",
          "Last receipt and tail slots rejected"
        )
        const full = await raw()
        assert(
          (await resolveLocalCategoryPlacementIncident(database, actor, input))
            .status === "replayed" && full === (await raw()),
          "Full metadata blocked replay"
        )
      }
    )
    await check(
      "Un ACK previo necesita historia y outcome aplicado coincidentes",
      async () => {
        const ancestor = {
          ...f.entry,
          state: "acknowledged" as const,
          sequence: 1,
          operation: {
            ...f.entry.operation,
            operationId: crypto.randomUUID(),
            baseRevision: 0,
          },
        }
        const chain = f.capture.entries.map((entry, index) => ({
          ...entry,
          sequence: entry.sequence + 1,
          dependencies: index
            ? entry.dependencies
            : [ancestor.operation.operationId],
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
        await rejected(() =>
          readLocalCategoryPlacementResolutionSnapshot(
            database,
            actor,
            f.entry.operation.operationId
          )
        )
        await mutate("syncMetadata", {
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
                effects: [
                  {
                    store: "taskPlacements",
                    record: { ...f.known, tagId: f.destinationId, revision: 1 },
                  },
                ],
              },
            },
          },
        })
        const input = await request(),
          result = await resolveLocalCategoryPlacementIncident(
            database,
            actor,
            input
          )
        assert(
          result.status === "applied" &&
            result.record.expected.acknowledgedDependencies.length === 1,
          "Category writer lost durable prerequisite proof"
        )
        await readLocalRecurringBackup(database, actor, f.now)
      }
    )
    await check(
      "Cuenta y época también se validan después de abrir",
      async () => {
        await clearOwnedControl()
        const prior = await readAccountControl(),
          control = await activatePreparedAccount(actor, f.now, prior.epoch),
          account = { userId: actor, epoch: control.epoch },
          input = await request()
        await readCategoryPlacementIncidentComparison(
          account,
          f.entry.operation.operationId
        )
        await rejected(() =>
          resolveCategoryPlacementIncident(
            { ...account, epoch: crypto.randomUUID() },
            input
          )
        )
        const open = LocalSyncStore.open
        LocalSyncStore.open = async (id: string) => {
          const store = await open(id),
            current = await readAccountControl()
          await activatePreparedAccount(actor, f.now, current.epoch)
          return store
        }
        try {
          await rejected(() =>
            readCategoryPlacementIncidentComparison(
              account,
              f.entry.operation.operationId
            )
          )
          const current = await readAccountControl()
          await rejected(() =>
            resolveCategoryPlacementIncident(
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
      "Dos confirmaciones simultáneas guardan una decisión y un aviso local",
      async () => {
        const current = await readAccountControl(),
          account = { userId: actor, epoch: current.epoch },
          input = await request(),
          count = notices
        const results = await Promise.all([
          resolveCategoryPlacementIncident(account, input),
          resolveCategoryPlacementIncident(account, input),
        ])
        assert(
          results.filter((value) => value.status === "applied").length === 1 &&
            results.filter((value) => value.status === "replayed").length ===
              1 &&
            notices === count + 1,
          "Recurring concurrent decision duplicated commit or event"
        )
        const backup = await readLocalRecurringBackup(database, actor, f.now)
        assert(
          backup.stores.outbox.filter((entry) => entry.state === "pending")
            .length === 1,
          "Recurring concurrent decision duplicated replacement"
        )
      }
    )
  } finally {
    window.removeEventListener("dalis:outbox-changed", notified)
    database.close()
    await clearOwnedControl()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned recurring cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición y control propios eliminados`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
