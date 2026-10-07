import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { outboxSequenceSchema } from "@/schemas/local-sync"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error(
    "Preference fixtures require the isolated loopback test server"
  )
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-preferences`
const otherUserId = `${userId}-other`
const itemId = "b092cffa-f8b3-41c2-b3fb-cfa69e420347"
const tagId = "1ae653fe-dd85-499e-afba-86f154e0dc7e"
const replacementId = "8873f5d6-cd3b-4cee-a768-36b6b8c51d14"
const recoveryId = "b650a0a6-b4f7-427c-804f-60fe1c64de82"
const createTagId = "864782a0-c181-41bf-8f77-efcc06cb0469"
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions) throw new Error("Test markup missing")
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Preference browser assertion failed")
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
  const tagCommand = {
    type: "tag.save" as const,
    tagId,
    input: { name: "Work", color: "#059669", position: 0 },
  }
  try {
    if (query.get("mode") !== "inspect") {
      await check(
        "Categoría y asignación guardadas junto con sus dependencias",
        async () => {
          const itemEntry = await outbox.commitItemCommand({
            type: "item.create",
            itemId,
            input: taskDraftSchema.parse({
              kind: "task",
              title: "Test task",
              description: "",
              scheduledDate: "2026-10-07",
              status: "in_progress",
              checklist: [],
              recurrence: null,
            }),
          })
          const category = await outbox.commitPreferenceCommand(tagCommand, {
            operationId: createTagId,
          })
          const assigned = await outbox.commitPreferenceCommand({
            type: "item-view.set",
            itemId,
            primaryTagId: tagId,
          })
          assert(
            assigned.dependencies.includes(itemEntry.operation.operationId) &&
              assigned.dependencies.includes(category.operation.operationId)
          )
          assert(
            (await outbox.claim(
              assigned.operation.operationId,
              crypto.randomUUID()
            )) === null
          )
          assert(
            (await repository.get("itemViews", itemId))?.primaryTagId === tagId
          )
          const original = await repository.get("tags", tagId)
          assert(original)
          await outbox.commitPreferenceCommand(
            { ...tagCommand, input: { ...tagCommand.input, name: "Focus" } },
            { expectedTag: original }
          )
          await rejects(() =>
            outbox.commitPreferenceCommand(
              {
                ...tagCommand,
                input: { ...tagCommand.input, name: "Stale edit" },
              },
              { expectedTag: original }
            )
          )
          assert((await outbox.listEntries()).length === 4)
          const replay = await outbox.commitPreferenceCommand(tagCommand, {
            operationId: createTagId,
          })
          assert(
            replay.operation.operationId === createTagId &&
              (await outbox.listEntries()).length === 4
          )
          await rejects(() =>
            outbox.commitPreferenceCommand(
              {
                ...tagCommand,
                input: { ...tagCommand.input, name: "Different payload" },
              },
              { operationId: createTagId }
            )
          )
        }
      )
      await check(
        "Borrar categoría conserva tarea y permite repetir nombre con otra identidad",
        async () => {
          const before = await repository.get("items", itemId)
          await outbox.commitPreferenceCommand({
            type: "item-view.set",
            itemId,
            primaryTagId: null,
          })
          assert(
            (await repository.get("itemViews", itemId))?.primaryTagId === null
          )
          const assignment = await outbox.commitPreferenceCommand({
            type: "item-view.set",
            itemId,
            primaryTagId: tagId,
          })
          const deleted = await outbox.commitPreferenceCommand({
            type: "tag.delete",
            tagId,
          })
          assert(
            deleted.dependencies.includes(assignment.operation.operationId)
          )
          assert(
            JSON.stringify(await repository.get("items", itemId)) ===
              JSON.stringify(before)
          )
          assert((await repository.get("tags", tagId))?.deletedAt)
          assert(
            !(await repository.list("tags")).some((tag) => tag.id === tagId)
          )
          await rejects(() =>
            outbox.commitPreferenceCommand({
              type: "item-view.set",
              itemId,
              primaryTagId: tagId,
            })
          )
          await rejects(() => outbox.commitPreferenceCommand(tagCommand))
          await outbox.commitPreferenceCommand({
            ...tagCommand,
            tagId: replacementId,
            input: { ...tagCommand.input, name: "Focus" },
          })
          await outbox.commitPreferenceCommand({
            type: "item-view.set",
            itemId,
            primaryTagId: replacementId,
          })
          assert((await outbox.listEntries()).length === 9)
        }
      )
      await check(
        "Dos escrituras concurrentes no crean nombres duplicados ni cruzan cuentas",
        async () => {
          const second = await LocalOutbox.open(userId)
          try {
            const outcomes = await Promise.allSettled([
              outbox.commitPreferenceCommand({
                ...tagCommand,
                tagId: crypto.randomUUID(),
                input: { ...tagCommand.input, name: "Home" },
              }),
              second.commitPreferenceCommand({
                ...tagCommand,
                tagId: crypto.randomUUID(),
                input: { ...tagCommand.input, name: " ＨＯＭＥ " },
              }),
            ])
            assert(
              outcomes.filter((result) => result.status === "fulfilled")
                .length === 1
            )
            assert(
              (await repository.list("tags")).filter(
                (tag) => tag.normalizedName === "home"
              ).length === 1
            )
            await otherOutbox.commitPreferenceCommand(tagCommand)
            assert(
              (await otherOutbox.listEntries()).length === 1 &&
                (await outbox.listEntries()).length === 10
            )
            await rejects(() =>
              outbox.commitPreferenceCommand({
                type: "item-view.set",
                itemId: crypto.randomUUID(),
                primaryTagId: replacementId,
              })
            )
          } finally {
            second.close()
          }
        }
      )
      await check(
        "Fallo después de escribir revierte categoría, cola y metadatos",
        async () => {
          await setCounter(0)
          await rejects(() =>
            outbox.commitPreferenceCommand({
              ...tagCommand,
              tagId: recoveryId,
              input: { ...tagCommand.input, name: "Recovery" },
            })
          )
          assert((await repository.get("tags", recoveryId)) === null)
          assert((await outbox.listEntries()).length === 10)
          await setCounter(10)
          const recovered = await outbox.commitPreferenceCommand({
            ...tagCommand,
            tagId: recoveryId,
            input: { ...tagCommand.input, name: "Recovery" },
          })
          assert(recovered.sequence === 11)
          await outbox.commitPreferenceCommand({
            type: "tag.delete",
            tagId: recoveryId,
          })
        }
      )
    }
    await check(
      "Reapertura conserva preferencias, tombstones y doce operaciones",
      async () => {
        const current = await repository.get("items", itemId)
        assert(current?.kind === "task" && current.status === "in_progress")
        assert(
          (await repository.get("itemViews", itemId))?.primaryTagId ===
            replacementId
        )
        assert((await repository.list("tags")).length === 2)
        assert(
          (await repository.list("tags", { includeDeleted: true })).length === 4
        )
        const entries = await outbox.listEntries()
        assert(
          entries.length === 12 &&
            entries.every((entry, index) => entry.sequence === index + 1)
        )
      }
    )
    if (status)
      status.textContent = "Preferencias e intenciones atómicas comprobadas."
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
run().catch(() => {
  if (status)
    status.textContent = "Una prueba ha fallado. Revisar el caso indicado."
})
