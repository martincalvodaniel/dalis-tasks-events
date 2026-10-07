import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { eventDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"

const query = new URLSearchParams(location.search)
const userId = `browser-test-${entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())}-events`
const itemId = "692f7605-e039-460d-96e8-cf38a665d0e1"
const allDayId = "592f7605-e039-460d-96e8-cf38a665d0e1"
const operationId = "492f7605-e039-460d-96e8-cf38a665d0e1"
const input = eventDraftSchema.parse({
  kind: "event",
  title: "Night event",
  description: "",
  recurrence: null,
  schedule: {
    mode: "timed",
    localStart: "2026-10-07T23:30",
    localEnd: "2026-10-08T00:30",
    timeZone: "Europe/Madrid",
  },
})
const results = document.getElementById("results")
const statusNode = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !statusNode || !actions)
  throw new Error("Test fixture markup is missing")
const resultList = results
const status = statusNode
const actionContainer = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Event browser assertion failed")
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
  await work()
  row.textContent = `Correcto: ${label}`
}
async function run() {
  const outbox = await LocalOutbox.open(userId)
  const repository = await LocalRepository.open(userId)
  const database = await openLocalDatabase(userId)
  async function snapshot() {
    return JSON.stringify(
      await Promise.all([
        repository.list("items", { includeDeleted: true }),
        outbox.listEntries(),
        runLocalTransaction(
          database,
          ["syncMetadata"],
          "readonly",
          (context) => {
            const request = context.transaction
              .objectStore("syncMetadata")
              .get("outbox-sequence")
            request.onsuccess = () => context.setResult(request.result)
          }
        ),
      ])
    )
  }
  async function sequence(value: number) {
    await runLocalTransaction(
      database,
      ["syncMetadata"],
      "readwrite",
      (context) => {
        context.transaction
          .objectStore("syncMetadata")
          .put({ key: "outbox-sequence", value })
        context.setResult(true)
      }
    )
  }
  try {
    if (query.get("phase") === "reload") {
      await check(
        "Eventos y cinco intenciones persisten tras recargar",
        async () => {
          const entries = await outbox.listEntries()
          assert(
            entries.length === 5 &&
              entries.every((entry, index) => entry.sequence === index + 1)
          )
          assert((await repository.get("items", itemId))?.deletedAt)
          assert((await repository.get("items", allDayId))?.kind === "event")
        }
      )
    } else {
      await check(
        "Crear eventos temporizados y de día completo conserva su programación",
        async () => {
          await outbox.commitItemCommand(
            { type: "item.create", itemId, input },
            { operationId }
          )
          await outbox.commitItemCommand({
            type: "item.create",
            itemId: allDayId,
            input: {
              ...input,
              title: "All day",
              schedule: {
                mode: "all_day",
                startDate: "2026-10-07",
                endDateExclusive: "2026-10-09",
              },
            },
          })
          const created = await repository.get("items", itemId)
          assert(created?.kind === "event")
          assert(
            JSON.stringify(created.schedule) === JSON.stringify(input.schedule)
          )
        }
      )
      await check(
        "Horas inexistentes o repetidas no escriben datos, cola ni secuencia",
        async () => {
          for (const localStart of ["2026-03-29T02:30", "2026-10-25T02:30"]) {
            const invalid = eventDraftSchema.parse({
              ...input,
              schedule: {
                mode: "timed",
                localStart,
                localEnd: null,
                timeZone: "Europe/Madrid",
              },
            })
            const before = await snapshot()
            await rejects(() =>
              outbox.commitItemCommand({
                type: "item.create",
                itemId: crypto.randomUUID(),
                input: invalid,
              })
            )
            await rejects(() =>
              outbox.commitItemCommand({
                type: "item.update",
                itemId,
                input: invalid,
              })
            )
            assert((await snapshot()) === before)
          }
        }
      )
      await check(
        "Edición CAS, reintento y aislamiento conservan datos y dependencias",
        async () => {
          const original = await repository.get("items", itemId)
          assert(original)
          const edit = await outbox.commitItemCommand(
            {
              type: "item.update",
              itemId,
              input: { ...input, title: "Edited" },
            },
            { expectedItem: original }
          )
          assert(edit.sequence === 3 && edit.dependencies[0] === operationId)
          const before = await snapshot()
          await rejects(() =>
            outbox.commitItemCommand(
              { type: "item.update", itemId, input },
              { expectedItem: original }
            )
          )
          await rejects(() =>
            outbox.commitItemCommand(
              { type: "item.update", itemId, input },
              { expectedItem: { ...original, ownerId: "other" } }
            )
          )
          await outbox.commitItemCommand(
            { type: "item.create", itemId, input },
            { operationId }
          )
          await rejects(() =>
            outbox.commitItemCommand(
              {
                type: "item.create",
                itemId,
                input: { ...input, title: "Collision" },
              },
              { operationId }
            )
          )
          assert((await snapshot()) === before)
        }
      )
      await check(
        "Un fallo de cola revierte todo y permite un guardado posterior",
        async () => {
          await sequence(0)
          const before = await snapshot()
          await rejects(() =>
            outbox.commitItemCommand({
              type: "item.update",
              itemId,
              input: { ...input, title: "Rollback" },
            })
          )
          assert((await snapshot()) === before)
          await sequence(3)
          await outbox.commitItemCommand({
            type: "item.update",
            itemId,
            input: { ...input, title: "Recovered" },
          })
        }
      )
      await check(
        "Registros históricos ambiguos se leen y reintentan sin reinterpretar",
        async () => {
          const current = await repository.get("items", itemId)
          const first = (await outbox.listEntries())[0]
          assert(current)
          const historical = eventDraftSchema.parse({
            ...input,
            schedule: {
              mode: "timed",
              localStart: "2026-10-25T02:30",
              localEnd: null,
              timeZone: "Europe/Madrid",
            },
          })
          const command = syncCommandSchema.parse({
            type: "item.create",
            itemId,
            input: historical,
          })
          await runLocalTransaction(
            database,
            ["items", "outbox"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("items")
                .put({ ...current, revision: 7, schedule: historical.schedule })
              context.transaction
                .objectStore("outbox")
                .put({ ...first, operation: { ...first.operation, command } })
              context.setResult(true)
            }
          )
          const before = await snapshot()
          await outbox.commitItemCommand(
            { type: "item.create", itemId, input: historical },
            { operationId }
          )
          assert((await snapshot()) === before)
          const legacy = await repository.get("items", itemId)
          assert(legacy?.revision === 7)
          const deletion = await outbox.commitItemCommand(
            { type: "item.delete", itemId },
            { expectedItem: legacy }
          )
          assert(
            deletion.sequence === 5 && deletion.operation.baseRevision === 7
          )
          await outbox.commitItemCommand(
            { type: "item.create", itemId, input: historical },
            { operationId }
          )
          assert((await repository.get("items", itemId))?.deletedAt)
        }
      )
      const link = document.createElement("a")
      link.textContent = "Comprobar recarga"
      link.href = `/?run=${query.get("run")}&phase=reload`
      actionContainer.append(link)
    }
    status.textContent = "Todas las pruebas han pasado."
    const button = document.createElement("button")
    button.textContent = "Limpiar bases de prueba"
    button.onclick = async () => {
      outbox.close()
      repository.close()
      database.close()
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(userId))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
      status.textContent = "Base de prueba eliminada."
      button.disabled = true
    }
    actionContainer.append(button)
  } finally {
    outbox.close()
    repository.close()
    database.close()
  }
}
run().catch((error) => {
  status.textContent = "Pruebas fallidas."
  console.error(error)
})
