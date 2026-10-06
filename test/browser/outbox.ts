import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { localStoreDefinitions } from "@/lib/local-db/store-config"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskDraftSchema, taskSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-outbox`
const itemId = "d7c2613f-cc43-40e6-a002-5946b55eaa42"
const seedId = "0c01ae25-880c-4f9d-9233-82193bf4941d"
const operationIds = [
  "5b2c36b3-b9ad-4440-b1e3-3c6327347d44",
  "6c74a2d2-9f22-4893-8d34-5fe025ba3a6b",
  "5c09220c-a3f1-45c2-b8ef-d05fece938f0",
  "bc5a1e10-4ea8-43e1-8a4b-83157de55be5",
  "04d55e03-822b-484d-9d91-6de11624e0f1",
]
const draft = taskDraftSchema.parse({
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-06",
  status: "not_started",
  checklist: [],
  recurrence: null,
})
const now = new Date("2026-10-06T10:00:00.000Z")
const seed = taskSchema.parse({
  ...draft,
  id: seedId,
  ownerId: userId,
  revision: 4,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  deletedAt: null,
  completedAt: null,
})
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions)
  throw new Error("Test fixture markup is missing")
const resultList = results
const statusElement = status
const actionContainer = actions

function assert(value: unknown): asserts value {
  if (!value) throw new Error("Outbox browser assertion failed")
}
async function rejects(work: () => Promise<unknown>) {
  let rejected = false
  try {
    await work()
  } catch {
    rejected = true
  }
  assert(rejected)
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  resultList.append(row)
  row.textContent = label
  try {
    await work()
    row.textContent = `Correcto: ${label}`
  } catch (error) {
    row.textContent = `Falló: ${label}`
    throw error
  }
}

async function seedVersionOne() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(localDatabaseName(userId), 1)
    request.onupgradeneeded = () => {
      for (const [name, definition] of Object.entries(localStoreDefinitions)) {
        const store = request.result.createObjectStore(name, {
          keyPath: definition.keyPath,
        })
        for (const index of definition.indexes)
          store.createIndex(index.name, index.keyPath, {
            unique: index.unique ?? false,
          })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    await runLocalTransaction(database, ["items"], "readwrite", (context) => {
      context.transaction.objectStore("items").put(seed)
      context.setResult(true)
    })
  } finally {
    database.close()
  }
}

async function runChecks() {
  if (query.get("phase") !== "reload") await seedVersionOne()
  let outbox = await LocalOutbox.open(userId)
  const repository = await LocalRepository.open(userId)
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Datos, orden, dependencias e IDs sobreviven la recarga",
        async () => {
          const entries = await outbox.listEntries()
          assert(entries.length === 5)
          assert(
            entries.every(
              (entry, index) =>
                entry.operation.operationId === operationIds[index] &&
                entry.sequence === index + 1
            )
          )
          assert(entries[1].dependencies[0] === operationIds[0])
          assert(entries[4].dependencies[0] === operationIds[2])
          assert(entries[0].state === "pending" && entries[0].attempts === 2)
          const item = await repository.get("items", itemId)
          assert(item?.deletedAt === now.toISOString())
          assert(item.kind === "task" && item.status === "in_progress")
          assert((await outbox.getShadow(seedId))?.record.title === seed.title)
        }
      )
      statusElement.textContent =
        "Recarga y cola verificadas. Todas las pruebas han pasado."
      const button = document.createElement("button")
      button.textContent = "Limpiar bases de prueba"
      button.onclick = async () => {
        outbox.close()
        repository.close()
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(localDatabaseName(userId))
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
          request.onblocked = () => reject(new Error("Test cleanup blocked"))
        })
        statusElement.textContent =
          "Base de prueba eliminada. Comprobación terminada."
        button.disabled = true
      }
      actionContainer.append(button)
      return
    }
    await check("Migración 1→2 conserva los registros anteriores", async () => {
      assert((await repository.get("items", seedId))?.revision === 4)
      const database = await openLocalDatabase(userId)
      assert(database.version === 2 && database.objectStoreNames.length === 11)
      database.close()
    })
    await check(
      "Crear guarda dato e intención con el mismo commit local",
      async () => {
        const entry = await outbox.commitItemCommand(
          { type: "item.create", itemId, input: draft },
          { operationId: operationIds[0], now }
        )
        assert(entry.sequence === 1 && entry.dependencies.length === 0)
        assert((await repository.get("items", itemId))?.title === draft.title)
        assert((await outbox.listEntries()).length === 1)
      }
    )
    await check(
      "Editar y cambiar estado mantienen el orden de dependencias",
      async () => {
        const edit = await outbox.commitItemCommand(
          {
            type: "item.update",
            itemId,
            input: { ...draft, title: "Edited test task" },
          },
          { operationId: operationIds[1], now }
        )
        const state = await outbox.commitItemCommand(
          {
            type: "task.set-status",
            itemId,
            occurrenceId: null,
            status: "in_progress",
          },
          { operationId: operationIds[2], now }
        )
        assert(edit.dependencies[0] === operationIds[0])
        assert(state.dependencies[0] === operationIds[1])
        assert(state.sequence === 3 && state.operation.baseRevision === 0)
      }
    )
    await check(
      "Reintentar un ID no duplica ni reaplica una mutación antigua",
      async () => {
        await outbox.commitItemCommand(
          { type: "item.create", itemId, input: draft },
          { operationId: operationIds[0], now }
        )
        assert((await outbox.listEntries()).length === 3)
        assert(
          (await repository.get("items", itemId))?.title === "Edited test task"
        )
        await rejects(() =>
          outbox.commitItemCommand(
            {
              type: "item.create",
              itemId,
              input: { ...draft, title: "Collision" },
            },
            { operationId: operationIds[0], now }
          )
        )
      }
    )
    await check(
      "Un fallo en outbox revierte el dato y no deja otra operación",
      async () => {
        const database = await openLocalDatabase(userId)
        try {
          await runLocalTransaction(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("syncMetadata")
                .put({ key: "outbox-sequence", value: 0 })
              context.setResult(true)
            }
          )
          await rejects(() =>
            outbox.commitItemCommand(
              {
                type: "item.update",
                itemId,
                input: { ...draft, title: "Must roll back" },
              },
              { now }
            )
          )
          assert(
            (await repository.get("items", itemId))?.title ===
              "Edited test task"
          )
          assert((await outbox.listEntries()).length === 3)
          await runLocalTransaction(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("syncMetadata")
                .put({ key: "outbox-sequence", value: 3 })
              context.setResult(true)
            }
          )
        } finally {
          database.close()
        }
      }
    )
    await check(
      "Editar localmente conserva el shadow remoto separado",
      async () => {
        const database = await openLocalDatabase(userId)
        try {
          await runLocalTransaction(
            database,
            ["remoteShadows"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("remoteShadows")
                .put({ entityKey: `item:${seedId}`, record: seed })
              context.setResult(true)
            }
          )
        } finally {
          database.close()
        }
        await outbox.commitItemCommand(
          {
            type: "item.update",
            itemId: seedId,
            input: { ...draft, title: "Local version" },
          },
          { operationId: operationIds[3], now }
        )
        assert((await outbox.getShadow(seedId))?.record.title === seed.title)
        assert(
          (await repository.get("items", seedId))?.title === "Local version"
        )
      }
    )
    await check(
      "Lease exclusivo, dependencias bloqueadas y recuperación tras reinicio",
      async () => {
        const ownerA = crypto.randomUUID()
        const ownerB = crypto.randomUUID()
        const claims = await Promise.all([
          outbox.claim(operationIds[0], ownerA, now),
          outbox.claim(operationIds[0], ownerB, now),
        ])
        assert(claims.filter(Boolean).length === 1)
        assert((await outbox.claim(operationIds[1], ownerA, now)) === null)
        assert(
          (await outbox.recoverExpiredSends(
            new Date(now.getTime() + 29000)
          )) === 0
        )
        outbox.close()
        outbox = await LocalOutbox.open(userId)
        assert(
          (await outbox.recoverExpiredSends(
            new Date(now.getTime() + 30000)
          )) === 1
        )
        const reclaimed = await outbox.claim(
          operationIds[0],
          ownerB,
          new Date(now.getTime() + 30000)
        )
        assert(
          reclaimed?.operation.operationId === operationIds[0] &&
            reclaimed.attempts === 2
        )
        assert(
          (await outbox.recoverExpiredSends(
            new Date(now.getTime() + 60000)
          )) === 1
        )
      }
    )
    await check(
      "Borrar mantiene el estado y depende de la última edición",
      async () => {
        const deletion = await outbox.commitItemCommand(
          { type: "item.delete", itemId },
          { operationId: operationIds[4], now }
        )
        assert(deletion.dependencies[0] === operationIds[2])
        const item = await repository.get("items", itemId)
        assert(
          item?.deletedAt === now.toISOString() &&
            item.kind === "task" &&
            item.status === "in_progress"
        )
      }
    )
    statusElement.textContent =
      "Ocho pruebas correctas. Falta comprobar la recarga."
    const link = document.createElement("a")
    link.textContent = "Verificar tras recarga"
    link.href = `/?phase=reload&run=${runId}`
    actionContainer.append(link)
  } finally {
    outbox.close()
    repository.close()
  }
}
runChecks().catch(() => {
  statusElement.textContent = "Una prueba ha fallado. Revisar el caso indicado."
})
