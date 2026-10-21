import { resolvePlanOccurrenceCopy } from "@/features/sync/local-plan-occurrence-copy"
import { validateLocalRecurringBackup } from "@/lib/backup/local-backup"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalRecurringBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { resolveLocalPlanOccurrenceCopy } from "@/lib/local-db/plan-occurrence-copy"
import { readLocalSettingsSyncIncidentOverview } from "@/lib/local-db/sync-incidents"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planOccurrenceCopyFixture } from "@/lib/sync/plan-occurrence-copy-fixture"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Appearance copy proof requires its own loopback origin")
const runId = entityIdSchema.parse(
    new URLSearchParams(location.search).get("run")
  ),
  actor = `browser-test-${runId}-appearance-copy`,
  name = localDatabaseName(actor),
  statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Appearance copy proof status missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Owned copy partition already exists"
  )
  let database = await openLocalDatabase(actor)
  const f = planOccurrenceCopyFixture("appointment", actor),
    stores = [...database.objectStoreNames]
  let checks = 0
  async function seed() {
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const store of stores) context.transaction.objectStore(store).clear()
      context.transaction.objectStore("items").add(f.series)
      for (const record of f.occurrences)
        context.transaction.objectStore("occurrences").add(record)
      for (const record of f.entries)
        context.transaction.objectStore("outbox").add(record)
      for (const record of f.shadows)
        context.transaction.objectStore("remoteShadows").add(record)
      for (const record of f.outcomes)
        context.transaction.objectStore("syncMetadata").add(record)
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
        for (const store of stores) {
          const read = context.transaction.objectStore(store).getAll()
          read.onsuccess = () => {
            values[store] = read.result
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
  async function request() {
    const overview = await readLocalSettingsSyncIncidentOverview(
        database,
        actor
      ),
      entry = overview.find(
        (value) =>
          value.kind === "plan-occurrence" &&
          value.incident.entry.operation.operationId ===
            f.entries[0].operation.operationId
      )
    assert(
      entry?.kind === "plan-occurrence",
      "Owned appearance copy incident missing"
    )
    return { ...f.request, expected: entry.incident }
  }
  async function rejected(action: () => Promise<unknown>) {
    const before = await raw()
    let failed = false
    try {
      await action()
    } catch {
      failed = true
    }
    assert(
      failed && before === (await raw()),
      "Rejected copy changed storage or was accepted"
    )
  }
  async function check(label: string, action: () => Promise<void>) {
    await seed()
    await action()
    checks++
    const row = document.createElement("li")
    row.textContent = `${checks}. ${label}`
    document.getElementById("results")?.append(row)
  }
  async function cleanupControl() {
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
        reject(new Error("Owned copy control cleanup blocked"))
    })
  }
  try {
    await check(
      "Lectura completa sin escrituras ni confirmaciones",
      async () => {
        const before = await raw(),
          input = await request()
        assert(
          JSON.stringify(input.expected) === JSON.stringify(f.snapshot) &&
            before === (await raw()),
          "Readonly copy snapshot changed history"
        )
      }
    )
    await check(
      "Cuenta y borrador posterior invalidan comparación antigua sin cambios",
      async () => {
        const input = await request()
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, "foreign", input)
        )
        assert(f.snapshot.local, "Owned local slot missing")
        await mutate("occurrences", {
          ...f.snapshot.local,
          content: { title: "Later local draft", description: "" },
        })
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Padre, remoto y outcome cambiados requieren otra revisión",
      async () => {
        const input = await request()
        for (const [store, value] of [
          ["items", { ...f.series, title: "Changed parent" }],
          [
            "remoteShadows",
            {
              ...f.shadows[0],
              record: { ...f.shadows[0].record, revision: 10 },
            },
          ],
        ] as const) {
          await seed()
          await mutate(store, value)
          await rejected(() =>
            resolveLocalPlanOccurrenceCopy(database, actor, input)
          )
        }
        await seed()
        await remove("syncMetadata", f.outcomes[0].key)
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Otro slot, dependencia externa e intento incierto conservan toda la cola",
      async () => {
        const input = await request()
        for (const entry of [
          { ...f.entries[1], attempts: 1 },
          { ...f.entries[1], dependencies: [] },
          {
            ...f.entries[1],
            operation: {
              ...f.entries[1].operation,
              command: {
                type: "plan.set-occurrence-status",
                itemId: f.series.id,
                occurrenceId: f.occurrences[1].id,
                expectedOccurrenceRevision: 2,
                status: "in_progress",
              },
            },
          },
          {
            ...f.entries[1],
            sequence: 4,
            entityKey: `item:${crypto.randomUUID()}`,
            operation: {
              ...f.entries[1].operation,
              operationId: crypto.randomUUID(),
            },
            dependencies: [f.entries[0].operation.operationId],
          },
        ]) {
          await seed()
          await mutate("outbox", entry)
          await rejected(() =>
            resolveLocalPlanOccurrenceCopy(database, actor, input)
          )
        }
      }
    )
    await check(
      "Dependiente externo válido impide una copia con supersesión parcial",
      async () => {
        const otherId = crypto.randomUUID()
        await mutate("items", { ...f.series, id: otherId, recurrence: null })
        await mutate("outbox", {
          ...f.entries[1],
          sequence: 4,
          entityKey: `item:${otherId}`,
          dependencies: [f.entries[0].operation.operationId],
          operation: {
            ...f.entries[1].operation,
            operationId: crypto.randomUUID(),
            command: { type: "item.delete", itemId: otherId },
          },
        })
        const input = await request()
        assert(
          input.expected.blockedByRelatedIntentions,
          "Valid external dependent was not captured"
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Identidad existente, tombstone y sombra histórica impiden otra copia",
      async () => {
        const input = await request()
        for (const deletedAt of [null, f.request.createdAt]) {
          await seed()
          await mutate("items", {
            ...f.series,
            id: input.copyItemId,
            deletedAt,
          })
          await rejected(() =>
            resolveLocalPlanOccurrenceCopy(database, actor, input)
          )
        }
        await seed()
        await mutate("remoteShadows", {
          version: 2,
          kind: "item",
          entityKey: `item:${input.copyItemId}`,
          record: {
            ...f.series,
            id: input.copyItemId,
            deletedAt: f.request.createdAt,
          },
        })
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "IDs reservados en metadata y en historia no se reutilizan",
      async () => {
        const input = await request()
        for (const field of [
          "resolutionId",
          "operationId",
          "copyItemId",
          "importId",
        ]) {
          await seed()
          await mutate("syncMetadata", {
            key: "owned-copy-reservation",
            [field]: input.operationId,
          })
          await rejected(() =>
            resolveLocalPlanOccurrenceCopy(database, actor, input)
          )
        }
        await seed()
        await mutate("outbox", {
          ...f.entries[1],
          sequence: 2,
          entityKey: `item:${input.copyItemId}`,
          dependencies: [],
          operation: {
            ...f.entries[1].operation,
            operationId: crypto.randomUUID(),
            command: {
              type: "plan.set-status",
              itemId: input.copyItemId,
              status: "not_started",
            },
          },
        })
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Contador ausente, atrasado o agotado no se repara ni desborda",
      async () => {
        const input = await request()
        for (const value of [2, Number.MAX_SAFE_INTEGER]) {
          await seed()
          await mutate("syncMetadata", { key: "outbox-sequence", value })
          await rejected(() =>
            resolveLocalPlanOccurrenceCopy(database, actor, input)
          )
        }
        await seed()
        await remove("syncMetadata", "outbox-sequence")
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Límite posterior de metadata conserva recibos e historia",
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
                .add({ key: `owned-filler-${index}`, value: index })
            context.setResult(true)
          }
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Límite posterior de items conserva todos los planes",
      async () => {
        const input = await request()
        await runLocalTransaction(
          database,
          ["items"],
          "readwrite",
          (context) => {
            for (let index = 0; index < 9999; index++)
              context.transaction
                .objectStore("items")
                .add({ ...f.series, id: crypto.randomUUID() })
            context.setResult(true)
          }
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Límite posterior de cola no elimina intenciones para hacer espacio",
      async () => {
        const input = await request(),
          otherId = crypto.randomUUID()
        await runLocalTransaction(
          database,
          ["items", "outbox", "syncMetadata"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("items")
              .add({ ...f.series, id: otherId, recurrence: null })
            for (let index = 0; index < 9998; index++)
              context.transaction.objectStore("outbox").add({
                ...f.entries[1],
                sequence: index + 4,
                entityKey: `item:${otherId}`,
                dependencies: [],
                operation: {
                  ...f.entries[1].operation,
                  operationId: crypto.randomUUID(),
                  command: {
                    type: "plan.set-status",
                    itemId: otherId,
                    status: "not_started",
                  },
                },
              })
            context.transaction
              .objectStore("syncMetadata")
              .put({ key: "outbox-sequence", value: 10001 })
            context.setResult(true)
          }
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, input)
        )
      }
    )
    await check(
      "Fallo tardío revierte aparición, copia, cola, contador y recibo",
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
            String(value.key).startsWith("appearance-copy-resolution:")
          )
            throw new Error("Owned late copy failure")
          return add.call(this, value, key)
        }
        try {
          await rejected(() =>
            resolveLocalPlanOccurrenceCopy(database, actor, input)
          )
        } finally {
          IDBObjectStore.prototype.add = add
        }
      }
    )
    await check(
      "Copia y original se guardan juntos sin alterar padre, otros slots ni preferencias",
      async () => {
        const input = await request(),
          result = await resolveLocalPlanOccurrenceCopy(database, actor, input),
          backup = await readLocalRecurringBackup(
            database,
            actor,
            input.createdAt
          ),
          replacement = backup.stores.outbox.find(
            (entry) => entry.operation.operationId === input.operationId
          )
        assert(
          result.status === "applied" && backup.stores.items.length === 2,
          "Copy was not stored once"
        )
        assert(
          JSON.stringify(
            backup.stores.items.find((item) => item.id === f.series.id)
          ) === JSON.stringify(f.series),
          "Parent changed"
        )
        assert(
          JSON.stringify(
            backup.stores.occurrences.find(
              (record) => record.id === f.occurrences[1].id
            )
          ) === JSON.stringify(f.occurrences[1]),
          "Other slot changed"
        )
        assert(
          replacement?.state === "pending" &&
            replacement.attempts === 0 &&
            replacement.dependencies.length === 0,
          "Copy fabricated an ACK or inherited dependency"
        )
        assert(
          backup.stores.outbox.filter((entry) => entry.state === "superseded")
            .length === 2,
          "Original chain changed"
        )
        assert(
          backup.stores.tags.length === 0 &&
            backup.stores.itemViews.length === 0 &&
            backup.stores.taskPlacements.length === 0,
          "Copy duplicated preferences"
        )
        validateLocalRecurringBackup(backup, actor)
      }
    )
    await check(
      "Recarga y replay conservan una edición posterior de la copia",
      async () => {
        const input = await request(),
          first = await resolveLocalPlanOccurrenceCopy(database, actor, input)
        await mutate("items", {
          ...first.record.copy,
          title: "Later edit after decision",
        })
        database.close()
        database = await openLocalDatabase(actor)
        const before = await raw(),
          replay = await resolveLocalPlanOccurrenceCopy(database, actor, input)
        assert(
          replay.status === "replayed" && before === (await raw()),
          "Replay overwrote later work"
        )
        await rejected(() =>
          resolveLocalPlanOccurrenceCopy(database, actor, {
            ...input,
            copyItemId: crypto.randomUUID(),
          })
        )
        await readLocalRecurringBackup(database, actor, input.createdAt)
      }
    )
    await check(
      "Época antes y durante apertura bloquea escrituras y cierra conexiones",
      async () => {
        await cleanupControl()
        const prior = await readAccountControl(),
          control = await activatePreparedAccount(
            actor,
            f.request.createdAt,
            prior.epoch
          ),
          account = { userId: actor, epoch: control.epoch },
          input = await request()
        await rejected(() =>
          resolvePlanOccurrenceCopy(
            { ...account, epoch: crypto.randomUUID() },
            input
          )
        )
        const open = LocalSyncStore.open
        LocalSyncStore.open = async (userId) => {
          const store = await open(userId),
            current = await readAccountControl()
          await activatePreparedAccount(
            actor,
            f.request.createdAt,
            current.epoch
          )
          return store
        }
        try {
          await rejected(() => resolvePlanOccurrenceCopy(account, input))
        } finally {
          LocalSyncStore.open = open
        }
      }
    )
    await check(
      "Dos confirmaciones equivalentes producen un commit y un aviso después de guardar",
      async () => {
        const control = await readAccountControl(),
          account = { userId: actor, epoch: control.epoch },
          input = await request()
        let notices = 0
        const observed: Promise<boolean>[] = [],
          notified = (event: Event) => {
            if (
              event instanceof CustomEvent &&
              event.detail?.userId === actor
            ) {
              notices++
              observed.push(
                readLocalRecurringBackup(database, actor, input.createdAt).then(
                  (backup) =>
                    backup.stores.items.some(
                      (item) => item.id === input.copyItemId
                    )
                )
              )
            }
          }
        window.addEventListener("dalis:outbox-changed", notified)
        try {
          const results = await Promise.all([
            resolvePlanOccurrenceCopy(account, input),
            resolvePlanOccurrenceCopy(account, input),
          ])
          assert(
            results.filter((result) => result.status === "applied").length ===
              1 &&
              results.filter((result) => result.status === "replayed")
                .length === 1 &&
              notices === 1,
            "Copy race duplicated commit or notice"
          )
          assert(
            observed.length === 1 &&
              (await Promise.all(observed)).every(Boolean),
            "Notice preceded commit"
          )
        } finally {
          window.removeEventListener("dalis:outbox-changed", notified)
        }
      }
    )
    await check(
      "Cambio de época después del commit conserva la copia pendiente sin mostrar éxito",
      async () => {
        const control = await readAccountControl(),
          account = { userId: actor, epoch: control.epoch },
          input = await request(),
          original = LocalSyncStore.prototype.resolvePlanOccurrenceCopy
        LocalSyncStore.prototype.resolvePlanOccurrenceCopy = async function (
          this: LocalSyncStore,
          value: unknown
        ) {
          const result = await original.call(this, value),
            current = await readAccountControl()
          await activatePreparedAccount(
            actor,
            f.request.createdAt,
            current.epoch
          )
          return result
        }
        let failed = false
        try {
          await resolvePlanOccurrenceCopy(account, input)
        } catch {
          failed = true
        } finally {
          LocalSyncStore.prototype.resolvePlanOccurrenceCopy = original
        }
        const backup = await readLocalRecurringBackup(
            database,
            actor,
            input.createdAt
          ),
          entry = backup.stores.outbox.find(
            (value) => value.operation.operationId === input.operationId
          )
        assert(
          failed &&
            entry?.state === "pending" &&
            entry.attempts === 0 &&
            backup.stores.items.some((item) => item.id === input.copyItemId),
          "Post-commit epoch change lost pending data or reported success"
        )
        const current = await readAccountControl(),
          before = await raw()
        assert(
          (
            await resolvePlanOccurrenceCopy(
              { userId: actor, epoch: current.epoch },
              input
            )
          ).status === "replayed" && before === (await raw()),
          "New account epoch replay changed pending data"
        )
      }
    )
  } finally {
    database.close()
    await cleanupControl()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned appearance copy cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición y control propios eliminados`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
