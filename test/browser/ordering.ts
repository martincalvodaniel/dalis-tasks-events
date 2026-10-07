import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { compareRank } from "@/lib/ordering/rank"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { outboxSequenceSchema } from "@/schemas/local-sync"
import { entityIdSchema } from "@/schemas/primitives"
import type { Tag } from "@/types/preferences"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Ordering fixtures require the isolated loopback test server")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-ordering`
const otherUserId = `${userId}-other`
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
  "40000000-0000-4000-8000-000000000004",
]
const otherTagId = "50000000-0000-4000-8000-000000000005"
const itemId = "60000000-0000-4000-8000-000000000006"
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions) throw new Error("Test markup missing")
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Ordering browser assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  results?.append(row)
  row.textContent = label
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
async function metadataSnapshot() {
  const database = await openLocalDatabase(userId)
  try {
    return await runLocalTransaction<unknown[]>(
      database,
      ["syncMetadata"],
      "readonly",
      (context) => {
        const request = context.transaction.objectStore("syncMetadata").getAll()
        request.onsuccess = () => context.setResult(request.result)
      }
    )
  } finally {
    database.close()
  }
}
async function setCounter(value: number) {
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
function move(tagId: string, beforeId: string | null, afterId: string | null) {
  return { type: "tag.move" as const, tagId, beforeId, afterId }
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
  const otherOutbox = await LocalOutbox.open(otherUserId)
  const snapshot = async () =>
    JSON.stringify({
      tags: await repository.list("tags", { includeDeleted: true }),
      item: await repository.get("items", itemId),
      view: await repository.get("itemViews", itemId),
      entries: await outbox.listEntries(),
      metadata: await metadataSnapshot(),
    })
  async function order(expected: string[]) {
    const tags = (await repository.list("tags")).sort(compareRank)
    assert(
      JSON.stringify(tags.map((tag) => tag.id)) === JSON.stringify(expected)
    )
  }
  async function save(
    tagId: string,
    name: string,
    position: number,
    expectedTag?: Tag
  ) {
    return outbox.commitPreferenceCommand(
      {
        type: "tag.save",
        tagId,
        input: { name, color: "#059669", position },
      },
      { expectedTag }
    )
  }
  try {
    if (query.get("mode") !== "inspect") {
      await check(
        "Cola anterior compatible y movimientos de inicio, medio y final",
        async () => {
          for (const [index, id] of ids.entries())
            await save(id, `Category ${index + 1}`, index * 1024)
          await outbox.commitPreferenceCommand({
            type: "tag.delete",
            tagId: ids[3],
          })
          await outbox.commitItemCommand({
            type: "item.create",
            itemId,
            input: taskDraftSchema.parse({
              kind: "task",
              title: "Ordering test task",
              description: "",
              scheduledDate: "2026-10-07",
              status: "in_progress",
              checklist: [],
              recurrence: null,
            }),
          })
          const assigned = await outbox.commitPreferenceCommand({
            type: "item-view.set",
            itemId,
            primaryTagId: ids[0],
          })
          const operationId = crypto.randomUUID()
          const command = move(ids[2], ids[1], ids[0])
          const entry = await outbox.commitPreferenceCommand(command, {
            operationId,
          })
          assert(
            entry.sequence === 8 &&
              entry.dependencies.includes(assigned.operation.operationId)
          )
          const entries = await outbox.listEntries()
          assert(entry.dependencies.includes(entries[2].operation.operationId))
          await order([ids[0], ids[2], ids[1]])
          const before = await snapshot()
          assert(
            (await outbox.commitPreferenceCommand(command, { operationId }))
              .sequence === 8
          )
          assert((await snapshot()) === before)
          await rejects(() =>
            outbox.commitPreferenceCommand(move(ids[2], ids[0], null), {
              operationId,
            })
          )
          const stale = await repository.get("tags", ids[2])
          assert(stale)
          await outbox.commitPreferenceCommand(move(ids[2], ids[0], null))
          await order([ids[2], ids[0], ids[1]])
          await rejects(() => save(stale.id, stale.name, stale.position, stale))
          await outbox.commitPreferenceCommand(move(ids[2], null, ids[1]))
          await order(ids.slice(0, 3))
          assert((await outbox.listEntries()).length === 10)
        }
      )
      await check(
        "Vecinos obsoletos o borrados y datos de otra cuenta no escriben",
        async () => {
          const before = await snapshot()
          for (const command of [
            move(ids[2], null, null),
            move(ids[2], ids[1], null),
            move(ids[2], ids[3], ids[0]),
            move(ids[3], ids[0], null),
            move(ids[2], ids[2], null),
            move(ids[2], ids[0], ids[0]),
          ])
            await rejects(() => outbox.commitPreferenceCommand(command))
          await otherOutbox.commitPreferenceCommand({
            type: "tag.save",
            tagId: otherTagId,
            input: { name: "Other account", color: "#059669", position: 0 },
          })
          await rejects(() =>
            outbox.commitPreferenceCommand(move(otherTagId, ids[0], null))
          )
          await otherOutbox.commitPreferenceCommand(
            move(otherTagId, null, null)
          )
          assert((await otherOutbox.listEntries()).length === 2)
          assert((await snapshot()) === before)
        }
      )
      await check(
        "Dos conexiones con vecinos incompatibles solo confirman una intención",
        async () => {
          const second = await LocalOutbox.open(userId)
          try {
            const outcomes = await Promise.allSettled([
              outbox.commitPreferenceCommand(move(ids[2], ids[0], null)),
              second.commitPreferenceCommand(move(ids[1], ids[0], null)),
            ])
            assert(
              outcomes.filter((result) => result.status === "fulfilled")
                .length === 1
            )
            assert((await outbox.listEntries()).length === 11)
          } finally {
            second.close()
          }
        }
      )
      await check(
        "Compactación y metadatos revierten si falla la escritura de cola",
        async () => {
          for (const [index, position] of [
            1,
            1 + Number.EPSILON,
            20,
          ].entries()) {
            const tag = await repository.get("tags", ids[index])
            assert(tag)
            await repository.put("tags", { ...tag, position })
          }
          const command = move(ids[2], ids[1], ids[0])
          const operationId = crypto.randomUUID()
          await setCounter(0)
          const before = await snapshot()
          await rejects(() =>
            outbox.commitPreferenceCommand(command, { operationId })
          )
          assert((await snapshot()) === before)
          await setCounter(11)
          const original = await repository.list("tags", {
            includeDeleted: true,
          })
          const entry = await outbox.commitPreferenceCommand(command, {
            operationId,
          })
          assert(entry.sequence === 12)
          const updated = await repository.list("tags", {
            includeDeleted: true,
          })
          for (const previous of original) {
            const current = updated.find((tag) => tag.id === previous.id)
            assert(current)
            assert(
              current.name === previous.name &&
                current.color === previous.color &&
                current.revision === previous.revision &&
                current.createdAt === previous.createdAt
            )
            if (previous.deletedAt)
              assert(JSON.stringify(current) === JSON.stringify(previous))
          }
          await order([ids[0], ids[2], ids[1]])
          const after = await snapshot()
          assert(
            (await outbox.commitPreferenceCommand(command, { operationId }))
              .sequence === 12
          )
          assert((await snapshot()) === after)
          const middle = await repository.get("tags", ids[2])
          assert(middle)
          await save(middle.id, "Renamed category", middle.position, middle)
          await order([ids[0], ids[2], ids[1]])
        }
      )
    }
    await check(
      "Recarga conserva orden, tarea, tombstone y trece operaciones consecutivas",
      async () => {
        await order([ids[0], ids[2], ids[1]])
        const tags = await repository.list("tags", { includeDeleted: true })
        assert(
          tags.length === 4 && tags.filter((tag) => tag.deletedAt).length === 1
        )
        const item = await repository.get("items", itemId)
        assert(
          item?.kind === "task" &&
            item.status === "in_progress" &&
            item.scheduledDate === "2026-10-07" &&
            item.revision === 0
        )
        assert(
          (await repository.get("itemViews", itemId))?.primaryTagId === ids[0]
        )
        const entries = await outbox.listEntries()
        assert(
          entries.length === 13 &&
            entries.every((entry, index) => entry.sequence === index + 1)
        )
        assert((await otherOutbox.listEntries()).length === 2)
      }
    )
    if (status) status.textContent = "Orden personal atómico comprobado."
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
    otherOutbox.close()
  }
}
void run().catch((error: unknown) => {
  console.error(error)
  if (status)
    status.textContent = "Una prueba ha fallado. Revisar el caso indicado."
})
