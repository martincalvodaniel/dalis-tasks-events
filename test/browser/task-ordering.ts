import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { outboxSequenceSchema } from "@/schemas/local-sync"
import {
  overduePlacementDate,
  taskPlacementEntityKey,
} from "@/schemas/ordering"
import { taskPlacementSchema, userSettingsSchema } from "@/schemas/preferences"
import { entityIdSchema } from "@/schemas/primitives"
import type { LocalPreferenceCommand } from "@/types/local-sync"
import { TaskCategoryFixture } from "./task-category-fixture"

if (
  !["127.0.0.1", "localhost"].includes(location.hostname) ||
  location.port !== "4179"
)
  throw new Error("Task ordering fixtures require an isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-task-ordering`
const otherUserId = `${userId}-other`
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
]
const tagId = "40000000-0000-4000-8000-000000000004"
const homeId = "50000000-0000-4000-8000-000000000005"
const now = new Date("2026-10-06T22:30:00.000Z")
const nextDay = new Date("2026-10-07T22:30:00.000Z")
const metadata = {
  revision: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  deletedAt: null,
}
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions) throw new Error("Test markup missing")
function assert(
  value: unknown,
  message = "Task ordering browser assertion failed"
): asserts value {
  if (!value) throw new Error(message)
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  results?.append(row)
  await work()
  row.textContent = `Correcto: ${label}`
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
function move(
  beforeId: string | null,
  afterId: string | null,
  scope: "day" | "overdue" = "day",
  date = "2026-10-06",
  destination = tagId
): Extract<LocalPreferenceCommand, { type: "task.move" }> {
  return {
    type: "task.move",
    itemId: ids[2],
    occurrenceId: null,
    scope,
    date,
    tagId: destination,
    beforeId,
    afterId,
  }
}
async function counter(value: number) {
  const database = await openLocalDatabase(userId)
  try {
    await runLocalTransaction(
      database,
      ["syncMetadata"],
      "readwrite",
      (context) => {
        context.transaction
          .objectStore("syncMetadata")
          .put(outboxSequenceSchema.parse({ key: "outbox-sequence", value }))
        context.setResult(undefined)
      }
    )
  } finally {
    database.close()
  }
}
async function categorySelectorProof() {
  const actor = `${userId}-category-ui`
  const databaseName = localDatabaseName(actor)
  const markerKey = "dalis:account-change"
  const markerBefore = localStorage.getItem(markerKey)
  assert(
    !(await indexedDB.databases()).some((database) =>
      [databaseName, ACCOUNT_CONTROL_DATABASE].includes(database.name ?? "")
    ) && localStorage.getItem(OFFLINE_ACCOUNT_KEY) === null,
    "Category selector proof requires a fresh origin without an existing account control or partition"
  )
  const repository = await LocalRepository.open(actor)
  const outbox = await LocalOutbox.open(actor)
  const host = document.createElement("div")
  actions?.before(host)
  const root = createRoot(host)
  let ownedEpoch: string | null = null
  let ownedActor: string | null = null
  let markerAfter = markerBefore
  try {
    await repository.put(
      "settings",
      userSettingsSchema.parse({
        ...metadata,
        userId: actor,
        timeZone: "Europe/Madrid",
        weekStartsOn: 1,
        locale: "es-ES",
      })
    )
    await outbox.commitItemCommand(
      {
        type: "item.create",
        itemId: ids[0],
        input: taskDraftSchema.parse({
          kind: "task",
          title: "Prueba de selector de categoría",
          description: "",
          scheduledDate: "2026-10-06",
          status: "not_started",
          checklist: [],
          recurrence: null,
        }),
      },
      { now }
    )
    for (const [id, name] of [
      [tagId, "Trabajo"],
      [homeId, "Casa"],
    ])
      await outbox.commitPreferenceCommand(
        {
          type: "tag.save",
          tagId: id,
          input: { name, color: "#059669", position: 0 },
        },
        { now }
      )
    await outbox.commitPreferenceCommand(
      { type: "item-view.set", itemId: ids[0], primaryTagId: tagId },
      { now }
    )
    await repository.put(
      "taskPlacements",
      taskPlacementSchema.parse({
        ...metadata,
        userId: actor,
        occurrenceId: ids[0],
        scope: "day",
        date: "2026-10-06",
        tagId,
        position: 1024,
      })
    )
    const baseline = {
      items: JSON.stringify(
        await repository.list("items", { includeDeleted: true })
      ),
      placements: JSON.stringify(
        await repository.list("taskPlacements", { includeDeleted: true })
      ),
      entries: await outbox.listEntries(),
    }
    const initial = await readAccountControl()
    ownedEpoch = initial.epoch
    assert(initial.userId === null && !initial.logoutPending)
    const active = await activatePreparedAccount(
      actor,
      now.toISOString(),
      initial.epoch
    )
    ownedEpoch = active.epoch
    ownedActor = actor
    markerAfter = localStorage.getItem(markerKey)
    root.render(
      createElement(TaskCategoryFixture, {
        account: {
          userId: actor,
          epoch: active.epoch,
          itemCount: 1,
          offlineReady: false,
        },
      })
    )
    const selector = () =>
      host.querySelector<HTMLSelectElement>(`select[data-item-id="${ids[0]}"]`)
    const waitFor = async (predicate: () => boolean) => {
      const deadline = Date.now() + 15000
      while (!predicate()) {
        if (Date.now() >= deadline)
          throw new Error("Task category selector did not settle")
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    }
    await waitFor(() => selector()?.value === tagId && !selector()?.disabled)
    const choose = (value: string) => {
      const select = selector()
      assert(select)
      select.value = value
      select.dispatchEvent(new Event("change", { bubbles: true }))
    }
    choose(homeId)
    // The second event arrives before React renders disabled controls; the intent lock must reject it.
    choose(tagId)
    await waitFor(() => selector()?.value === homeId && !selector()?.disabled)
    assert((await repository.get("itemViews", ids[0]))?.primaryTagId === homeId)
    assert((await outbox.listEntries()).length === baseline.entries.length + 1)
    choose("")
    await waitFor(() => selector()?.value === "" && !selector()?.disabled)
    assert((await repository.get("itemViews", ids[0]))?.primaryTagId === null)
    const entries = await outbox.listEntries()
    const added = entries.slice(baseline.entries.length)
    assert(
      added.length === 2 &&
        added.every(
          (entry) =>
            entry.operation.command.type === "item-view.set" &&
            entry.operation.command.itemId === ids[0] &&
            entry.state === "pending" &&
            entry.attempts === 0 &&
            entry.lease === null
        )
    )
    assert(
      added[0].operation.command.type === "item-view.set" &&
        added[0].operation.command.primaryTagId === homeId
    )
    assert(
      added[1].operation.command.type === "item-view.set" &&
        added[1].operation.command.primaryTagId === null
    )
    assert(
      JSON.stringify(entries.slice(0, baseline.entries.length)) ===
        JSON.stringify(baseline.entries)
    )
    assert(
      JSON.stringify(
        await repository.list("items", { includeDeleted: true })
      ) === baseline.items
    )
    assert(
      JSON.stringify(
        await repository.list("taskPlacements", { includeDeleted: true })
      ) === baseline.placements
    )
  } finally {
    root.unmount()
    host.remove()
    repository.close()
    outbox.close()
    if (ownedEpoch) {
      const current = await readAccountControl()
      assert(
        current.epoch === ownedEpoch &&
          current.userId === ownedActor &&
          !current.logoutPending
      )
      await deleteFixtureDatabase(ACCOUNT_CONTROL_DATABASE)
      if (localStorage.getItem(markerKey) === markerAfter) {
        if (markerBefore === null) localStorage.removeItem(markerKey)
        else localStorage.setItem(markerKey, markerBefore)
      }
    }
    await deleteFixtureDatabase(databaseName)
  }
}
async function deleteFixtureDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Fixture cleanup is blocked"))
  })
}
async function run() {
  if (query.get("mode") === "cleanup") {
    for (const actor of [userId, otherUserId])
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(actor))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () =>
          reject(new Error("Fixture cleanup is blocked"))
      })
    if (status) status.textContent = "Particiones ficticias limpiadas."
    return
  }
  const repository = await LocalRepository.open(userId)
  const outbox = await LocalOutbox.open(userId)
  const other = await LocalOutbox.open(otherUserId)
  async function snapshot() {
    const database = await openLocalDatabase(userId)
    try {
      const metadata = await runLocalTransaction<unknown[]>(
        database,
        ["syncMetadata"],
        "readonly",
        (context) => {
          const request = context.transaction
            .objectStore("syncMetadata")
            .getAll()
          request.onsuccess = () => context.setResult(request.result)
        }
      )
      return JSON.stringify({
        metadata,
        items: await repository.list("items", { includeDeleted: true }),
        views: await repository.list("itemViews", { includeDeleted: true }),
        placements: await repository.list("taskPlacements", {
          includeDeleted: true,
        }),
        entries: await outbox.listEntries(),
      })
    } finally {
      database.close()
    }
  }
  async function order(scope: "day" | "overdue", expected: string[]) {
    const items = await repository.list("items", {
      index: "byKind",
      query: "task",
    })
    const tasks = items.filter((item) => item.kind === "task")
    const placements = await repository.list("taskPlacements", {
      index: "byDateAndScope",
      query: [scope === "day" ? "2026-10-06" : overduePlacementDate, scope],
    })
    assert(
      JSON.stringify(
        orderPlacedTasks(tasks, placements, tagId).map((task) => task.id)
      ) === JSON.stringify(expected)
    )
  }
  try {
    if (query.get("mode") !== "inspect") {
      await check(
        "Orden y categoría se guardan juntos sin cambiar la tarea",
        async () => {
          await repository.put(
            "settings",
            userSettingsSchema.parse({
              ...metadata,
              userId,
              timeZone: "Europe/Madrid",
              weekStartsOn: 1,
              locale: "es-ES",
            })
          )
          for (const id of ids)
            await outbox.commitItemCommand(
              {
                type: "item.create",
                itemId: id,
                input: taskDraftSchema.parse({
                  kind: "task",
                  title: "Task ordering fixture",
                  description: "",
                  scheduledDate: "2026-10-06",
                  status: "in_progress",
                  checklist: [],
                  recurrence: null,
                }),
              },
              { now }
            )
          for (const [id, name] of [
            [tagId, "Work"],
            [homeId, "Home"],
          ])
            await outbox.commitPreferenceCommand(
              {
                type: "tag.save",
                tagId: id,
                input: { name, color: "#059669", position: 0 },
              },
              { now }
            )
          for (const id of ids)
            await outbox.commitPreferenceCommand(
              {
                type: "item-view.set",
                itemId: id,
                primaryTagId: id === ids[2] ? homeId : tagId,
              },
              { now }
            )
          const itemsBefore = JSON.stringify(await repository.list("items"))
          const command = move(ids[1], ids[0])
          const operationId = crypto.randomUUID()
          const entry = await outbox.commitPreferenceCommand(command, {
            operationId,
            now,
          })
          const entries = await outbox.listEntries()
          assert(
            entry.sequence === 9 &&
              entry.entityKey ===
                taskPlacementEntityKey(ids[2], "day", "2026-10-06")
          )
          assert(
            entry.dependencies.includes(entries[2].operation.operationId) &&
              entry.dependencies.includes(entries[7].operation.operationId)
          )
          assert(
            (await repository.get("itemViews", ids[2]))?.primaryTagId === tagId
          )
          await order("day", [ids[0], ids[2], ids[1]])
          await outbox.commitPreferenceCommand(move(ids[0], null), { now })
          await order("day", [ids[2], ids[0], ids[1]])
          await outbox.commitPreferenceCommand(move(null, ids[1]), { now })
          await order("day", ids)
          const before = await snapshot()
          assert(
            (
              await outbox.commitPreferenceCommand(command, {
                operationId,
                now: nextDay,
              })
            ).sequence === 9
          )
          await rejects(() =>
            outbox.commitPreferenceCommand(move(ids[0], null), {
              operationId,
              now,
            })
          )
          assert((await snapshot()) === before)
          assert(JSON.stringify(await repository.list("items")) === itemsBefore)
          await other.commitPreferenceCommand({
            type: "tag.save",
            tagId,
            input: { name: "Other account", color: "#059669", position: 0 },
          })
          await rejects(() => other.commitPreferenceCommand(command, { now }))
          assert((await other.listEntries()).length === 1)
        }
      )
      await check(
        "Movimientos concurrentes y vecinos obsoletos conservan consistencia",
        async () => {
          const second = await LocalOutbox.open(userId)
          try {
            const outcomes = await Promise.allSettled([
              outbox.commitPreferenceCommand(move(ids[0], null), { now }),
              second.commitPreferenceCommand(
                { ...move(ids[0], null), itemId: ids[1] },
                { now }
              ),
            ])
            assert(
              outcomes.filter((result) => result.status === "fulfilled")
                .length === 1
            )
          } finally {
            second.close()
          }
          assert((await outbox.listEntries()).length === 12)
          const before = await snapshot()
          for (const command of [
            move(null, null),
            move(null, ids[0], "day", "2026-10-07"),
            { ...move(ids[0], null), occurrenceId: "unsupported:occurrence" },
            move(null, null, "day", "2026-10-06", crypto.randomUUID()),
          ])
            await rejects(() =>
              outbox.commitPreferenceCommand(command, { now })
            )
          assert((await snapshot()) === before)
        }
      )
      await check(
        "Fallo de cola revierte categoría, rango y metadatos; compactación conserva revisiones",
        async () => {
          const history = taskPlacementSchema.parse({
            ...metadata,
            userId,
            occurrenceId: ids[0],
            scope: "day",
            date: "2026-10-05",
            tagId,
            position: 99,
          })
          await repository.put("taskPlacements", history)
          await counter(0)
          const before = await snapshot()
          await rejects(() =>
            outbox.commitPreferenceCommand(
              move(null, null, "day", "2026-10-06", homeId),
              { now }
            )
          )
          assert((await snapshot()) === before)
          await counter(12)
          for (const [index, position] of [
            1,
            1 + Number.EPSILON,
            20,
          ].entries()) {
            const record = await repository.get("taskPlacements", [
              ids[index],
              "day",
              "2026-10-06",
            ])
            assert(record)
            await repository.put("taskPlacements", {
              ...record,
              position,
              revision: index === 2 ? 7 : record.revision,
            })
          }
          const entry = await outbox.commitPreferenceCommand(
            move(ids[1], ids[0]),
            { now }
          )
          assert(entry.sequence === 13 && entry.operation.baseRevision === 7)
          assert(
            (
              await repository.get("taskPlacements", [
                ids[2],
                "day",
                "2026-10-06",
              ])
            )?.revision === 7
          )
          assert(
            JSON.stringify(
              await repository.get("taskPlacements", [
                ids[0],
                "day",
                "2026-10-05",
              ])
            ) === JSON.stringify(history)
          )
          await order("day", [ids[0], ids[2], ids[1]])
        }
      )
      await check(
        "Atrasadas mantiene ancla entre días; completadas y legado no se sobrescriben",
        async () => {
          const entry = await outbox.commitPreferenceCommand(
            move(ids[1], ids[0], "overdue", "2026-10-07"),
            { now }
          )
          assert(entry.sequence === 14)
          const next = await outbox.commitPreferenceCommand(
            move(ids[0], null, "overdue", "2026-10-08"),
            { now: nextDay }
          )
          assert(next.sequence === 15 && next.entityKey === entry.entityKey)
          await order("overdue", [ids[2], ids[0], ids[1]])
          await outbox.commitItemCommand(
            {
              type: "task.set-status",
              itemId: ids[1],
              occurrenceId: null,
              status: "completed",
            },
            { now: nextDay }
          )
          const before = await snapshot()
          await rejects(() =>
            outbox.commitPreferenceCommand(
              {
                ...move(ids[0], null, "overdue", "2026-10-08"),
                itemId: ids[1],
              },
              { now: nextDay }
            )
          )
          await rejects(() =>
            outbox.commitPreferenceCommand(
              move(ids[0], null, "overdue", "2026-10-07"),
              { now: nextDay }
            )
          )
          assert((await snapshot()) === before)
          const legacy = taskPlacementSchema.parse({
            ...metadata,
            userId,
            occurrenceId: ids[0],
            scope: "overdue",
            date: "2026-10-06",
            tagId,
            position: 5,
          })
          await repository.put("taskPlacements", legacy)
          const withLegacy = await snapshot()
          await rejects(() =>
            outbox.commitPreferenceCommand(
              move(ids[0], null, "overdue", "2026-10-08"),
              { now: nextDay }
            )
          )
          assert((await snapshot()) === withLegacy)
        }
      )
    }
    await check(
      "Recarga conserva ocho colocaciones y dieciséis operaciones consecutivas",
      async () => {
        await order("day", [ids[0], ids[2], ids[1]])
        await order("overdue", [ids[2], ids[0], ids[1]])
        assert((await repository.list("taskPlacements")).length === 8)
        const entries = await outbox.listEntries()
        assert(
          entries.length === 16 &&
            entries.every((entry, index) => entry.sequence === index + 1)
        )
        assert(
          (await repository.get("itemViews", ids[2]))?.primaryTagId === tagId
        )
        const task = await repository.get("items", ids[2])
        assert(
          task?.kind === "task" &&
            task.status === "in_progress" &&
            task.scheduledDate === "2026-10-06" &&
            task.revision === 0
        )
        const completed = await repository.get("items", ids[1])
        assert(completed?.kind === "task" && completed.status === "completed")
      }
    )
    await check(
      "Selector real asigna y quita categoría sin mover tareas; la elección rápida no duplica intenciones",
      categorySelectorProof
    )
    if (status)
      status.textContent = "Colocaciones e intenciones atómicas comprobadas."
    for (const [mode, text] of [
      ["inspect", "Comprobar tras recargar"],
      ["cleanup", "Limpiar datos ficticios"],
    ]) {
      const link = document.createElement("a")
      link.href = `/?mode=${mode}&run=${runId}`
      link.textContent = text
      actions?.append(link, document.createElement("br"))
    }
  } finally {
    repository.close()
    outbox.close()
    other.close()
  }
}
void run().catch((error: unknown) => {
  console.error(error)
  if (status)
    status.textContent = "Una prueba ha fallado. Revisar el caso indicado."
})
