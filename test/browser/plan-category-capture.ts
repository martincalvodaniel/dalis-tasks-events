import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { readLocalPlanCategoryResolutionSnapshot } from "@/lib/local-db/plan-category-resolution-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { localItemOutcomeV2Schema } from "@/schemas/local-item-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { tagSchema } from "@/schemas/preferences"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Joint capture proof requires its own loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-joint-capture`,
  name = localDatabaseName(actor),
  now = "2026-10-18T06:00:00.000Z"
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Joint proof status missing")
const status = statusNode
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Proof partition already exists"
  )
  let database = await openLocalDatabase(actor)
  const stores = [...database.objectStoreNames]
  const local = planSchema.parse({
    kind: "plan",
    variant: "note",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Local",
    description: "Complete draft",
    status: "in_progress",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-18",
      endDateExclusive: "2026-10-19",
    },
    recurrence: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const remote = { ...local, title: "Remote", revision: 5 }
  const tag = tagSchema.parse({
    id: crypto.randomUUID(),
    userId: actor,
    name: "Chosen",
    normalizedName: "chosen",
    color: "#123456",
    position: 20,
    revision: 3,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const view = {
    userId: actor,
    itemId: local.id,
    primaryTagId: tag.id,
    revision: 2,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const remoteView = { ...view, primaryTagId: null, revision: 7 }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `item:${local.id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "plan.set-status",
        itemId: local.id,
        status: "in_progress",
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
  const assignment = outboxEntrySchema.parse({
    ...child,
    entityKey: `item-view:${local.id}`,
    sequence: 3,
    dependencies: [child.operation.operationId],
    operation: {
      ...child.operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "item-view.set",
        itemId: local.id,
        primaryTagId: tag.id,
      },
    },
  })
  const outcome = localItemOutcomeV2Schema.parse({
    version: 2,
    kind: "item",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "item",
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        current: remote,
      },
    },
    local,
    base: null,
  })
  async function seed() {
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const store of stores) context.transaction.objectStore(store).clear()
      context.transaction.objectStore("items").add(local)
      context.transaction.objectStore("tags").add(tag)
      context.transaction.objectStore("itemViews").add(view)
      context.transaction.objectStore("remoteShadows").add({
        version: 2,
        kind: "preference",
        entityKey: `item-view:${local.id}`,
        record: { store: "itemViews", record: remoteView },
      })
      for (const value of [entry, child, assignment])
        context.transaction.objectStore("outbox").add(value)
      context.transaction.objectStore("syncMetadata").add(outcome)
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
  const capture = () =>
    readLocalPlanCategoryResolutionSnapshot(
      database,
      actor,
      entry.operation.operationId
    )
  async function rejected(work = capture) {
    const before = await raw()
    let failed = false
    try {
      await work()
    } catch {
      failed = true
    }
    assert(
      failed && before === (await raw()),
      "Rejected capture changed its evidence or returned a partial result"
    )
  }
  let checks = 0
  async function check(label: string, work: () => Promise<void>) {
    await work()
    checks++
    const row = document.createElement("li")
    row.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(row)
  }
  try {
    await seed()
    const original = await capture()
    await check(
      "Captura consistente de contenido, categoría, asignación y remoto sin escrituras",
      async () => {
        const before = await raw(),
          current = await capture()
        assert(
          current.incident.intentions.length === 2 &&
            current.viewIntentions.length === 1 &&
            current.localTag?.id === tag.id &&
            current.remoteView.revision === 7 &&
            current.localView.primaryTagId === tag.id &&
            current.incident.blockedByRelatedIntentions === false,
          "Joint snapshot lost reviewed graph or current records"
        )
        assert(before === (await raw()), "Readonly capture wrote durable state")
      }
    )
    await check(
      "Actividad de otro plan no invalida la comparación revisada",
      async () => {
        const id = crypto.randomUUID()
        await runLocalTransaction(
          database,
          ["items", "itemViews", "outbox"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("items").add({ ...local, id })
            context.transaction
              .objectStore("itemViews")
              .add({ ...view, itemId: id, primaryTagId: null, revision: 0 })
            context.transaction.objectStore("outbox").add({
              ...assignment,
              entityKey: `item-view:${id}`,
              sequence: 4,
              dependencies: [],
              operation: {
                ...assignment.operation,
                operationId: crypto.randomUUID(),
                command: {
                  type: "item-view.set",
                  itemId: id,
                  primaryTagId: null,
                },
              },
            })
            context.setResult(true)
          }
        )
        const before = await raw()
        assert(
          JSON.stringify(await capture()) === JSON.stringify(original) &&
            before === (await raw()),
          "Independent activity changed compact comparison or capture wrote state"
        )
      }
    )
    await check(
      "Actor ajeno e incidente ausente se rechazan sin resultado parcial",
      async () => {
        await rejected(() =>
          readLocalPlanCategoryResolutionSnapshot(
            database,
            "foreign-owner",
            entry.operation.operationId
          )
        )
        await rejected(() =>
          readLocalPlanCategoryResolutionSnapshot(
            database,
            actor,
            crypto.randomUUID()
          )
        )
      }
    )
    await check(
      "Falta de vista, remoto u outcome no se interpreta como permiso",
      async () => {
        for (const [store, key] of [
          ["itemViews", local.id],
          ["remoteShadows", `item-view:${local.id}`],
          ["syncMetadata", outcome.key],
        ]) {
          await seed()
          await runLocalTransaction(
            database,
            [store],
            "readwrite",
            (context) => {
              context.transaction.objectStore(store).delete(key)
              context.setResult(true)
            }
          )
          await rejected()
        }
      }
    )
    await seed()
    await check(
      "Asignación intentada y dependiente externo conservan toda la cola",
      async () => {
        await runLocalTransaction(
          database,
          ["outbox"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("outbox")
              .put({ ...assignment, attempts: 1 })
            context.setResult(true)
          }
        )
        await rejected()
        await seed()
        const id = crypto.randomUUID()
        await runLocalTransaction(
          database,
          ["outbox"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("outbox").add({
              ...assignment,
              entityKey: `item-view:${id}`,
              sequence: 4,
              dependencies: [assignment.operation.operationId],
              operation: {
                ...assignment.operation,
                operationId: crypto.randomUUID(),
                command: {
                  type: "item-view.set",
                  itemId: id,
                  primaryTagId: null,
                },
              },
            })
            context.setResult(true)
          }
        )
        await rejected()
      }
    )
    await seed()
    await check(
      "Categoría ausente queda explícitamente desconocida",
      async () => {
        await runLocalTransaction(
          database,
          ["tags"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("tags").delete(tag.id)
            context.setResult(true)
          }
        )
        const before = await raw()
        assert(
          (await capture()).localTag === null && before === (await raw()),
          "Missing category was invented or changed its evidence"
        )
      }
    )
    await seed()
    await check(
      "Nueva revisión remota se captura completa y cambia la comparación",
      async () => {
        await runLocalTransaction(
          database,
          ["remoteShadows"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("remoteShadows").put({
              version: 2,
              kind: "preference",
              entityKey: `item-view:${local.id}`,
              record: {
                store: "itemViews",
                record: { ...remoteView, revision: 8 },
              },
            })
            context.setResult(true)
          }
        )
        const current = await capture()
        assert(
          current.remoteView.revision === 8 &&
            JSON.stringify(current) !== JSON.stringify(original),
          "Joint capture reused stale remote view"
        )
      }
    )
    await seed()
    await check(
      "Reapertura conserva captura, UUID, dependencias y outcomes originales",
      async () => {
        const before = await raw()
        database.close()
        database = await openLocalDatabase(actor)
        assert(
          JSON.stringify(await capture()) === JSON.stringify(original) &&
            before === (await raw()),
          "Reopened joint evidence changed"
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
        reject(new Error("Owned joint capture cleanup blocked"))
    })
  }
  status.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
