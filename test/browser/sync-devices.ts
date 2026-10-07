import type { z } from "zod"
import { calendarItemSchema, taskDraftSchema } from "@/schemas/calendar-item"
import {
  syncBrowserCommandSchema,
  syncBrowserFixtureSchema,
  syncBrowserSnapshotSchema,
} from "@/schemas/sync-browser-test"
import type { CalendarItem } from "@/types/calendar-item"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
const status = document.getElementById("status")
const results = document.getElementById("results")
const actions = document.getElementById("actions")
if (!status || !results || !actions)
  throw new Error("Fixture markup is missing")
const statusElement = status
const resultsElement = results
const frames = fixture.origins.map(() => document.createElement("iframe"))
const options = {
  headers: { "x-sync-test-run": fixture.runId },
  cache: "no-store" as const,
}
function assert(value: unknown, description: string): asserts value {
  if (!value)
    throw new Error(`Integrated sync assertion failed: ${description}`)
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  resultsElement.append(row)
  await work()
  row.textContent = `Correcto: ${label}`
}
async function load(index: number) {
  const frame = frames[index]
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", listener)
      reject(new Error("Fixture device did not become ready"))
    }, 45000)
    function listener(event: MessageEvent) {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== fixture.origins[index] ||
        event.data?.runId !== fixture.runId ||
        event.data?.ready !== true
      )
        return
      clearTimeout(timer)
      window.removeEventListener("message", listener)
      resolve()
    }
    window.addEventListener("message", listener)
  })
  frame.src = `${fixture.origins[index]}/device?run=${fixture.runId}&reload=${crypto.randomUUID()}`
  frame.title = `Dispositivo de prueba ${index + 1}`
  frame.hidden = true
  if (!frame.isConnected) document.body.append(frame)
  await ready
}
async function call(
  index: number,
  command: z.infer<typeof syncBrowserCommandSchema>
): Promise<unknown> {
  const value = syncBrowserCommandSchema.parse(command)
  const channel = new MessageChannel()
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Fixture device command timed out")),
        60000
      )
      channel.port1.onmessage = (event) => {
        clearTimeout(timer)
        if (event.data?.ok === true) resolve(event.data.value)
        else reject(new Error("Fixture device command failed"))
      }
      frames[index].contentWindow?.postMessage(
        { runId: fixture.runId, command: value },
        fixture.origins[index],
        [channel.port2]
      )
    })
  } finally {
    channel.port1.close()
  }
}
async function snapshot(index: number) {
  return syncBrowserSnapshotSchema.parse(
    await call(index, { type: "snapshot" })
  )
}
async function pass(index: number, expected = "settled") {
  const result = (await call(index, { type: "run" })) as { status?: string }
  assert(result.status === expected, `${expected}, received ${result.status}`)
}
async function remote(): Promise<CalendarItem[]> {
  const response = await fetch("/fixture-items", options)
  assert(response.ok, "remote items response")
  return calendarItemSchema.array().parse(await response.json())
}
function ordered(items: CalendarItem[]) {
  return JSON.stringify([...items].sort((a, b) => a.id.localeCompare(b.id)))
}
async function equalDevices() {
  const first = await snapshot(0)
  const second = await snapshot(1)
  const items = await remote()
  assert(
    ordered(first.items) === ordered(items),
    "first projection matches MongoDB"
  )
  assert(
    ordered(second.items) === ordered(items),
    "second projection matches MongoDB"
  )
  assert(first.cursor.after === second.cursor.after, "device cursors match")
}
const itemId = crypto.randomUUID()
const independentId = crypto.randomUUID()
const checklistId = crypto.randomUUID()
const draft = taskDraftSchema.parse({
  kind: "task",
  title: "Tarea de prueba",
  description: "",
  scheduledDate: "2026-10-08",
  status: "not_started",
  checklist: [{ id: checklistId, text: "Primer paso", completed: false }],
  recurrence: null,
})
const button = document.createElement("button")
button.textContent = "Ejecutar prueba integrada"
actions.append(button)
statusElement.textContent = "Entorno aislado preparado; prueba pendiente"
button.onclick = async () => {
  button.disabled = true
  let passed = false
  try {
    await load(0)
    await load(1)
    await check(
      "Creación sin red y cola conservada tras recargar",
      async () => {
        await call(0, { type: "network", online: false })
        await call(0, {
          type: "commit",
          command: { type: "item.create", itemId, input: draft },
        })
        await pass(0, "retry_later")
        assert(
          (await remote()).length === 0,
          "offline write did not reach MongoDB"
        )
        assert(
          (await snapshot(1)).items.length === 0,
          "other origin is independent"
        )
        const before = (await snapshot(0)).entries[0]
        await load(0)
        assert(
          JSON.stringify((await snapshot(0)).entries[0]) ===
            JSON.stringify(before),
          "durable operation after browser reload"
        )
      }
    )
    await check(
      "Subida, bootstrap y convergencia de ambos dispositivos",
      async () => {
        await pass(0)
        await pass(1)
        await equalDevices()
        assert(
          (await snapshot(0)).entries.every(
            (entry) => entry.state === "acknowledged"
          ),
          "create acknowledged"
        )
      }
    )
    await check(
      "Estado y checklist del segundo dispositivo llegan al primero",
      async () => {
        await call(1, {
          type: "commit",
          command: {
            type: "task.set-status",
            itemId,
            occurrenceId: null,
            status: "in_progress",
          },
        })
        await call(1, {
          type: "commit",
          command: {
            type: "task.set-checklist-entry",
            itemId,
            occurrenceId: null,
            entryId: checklistId,
            completed: true,
          },
        })
        await pass(1)
        await pass(0)
        await equalDevices()
        const item = (await remote())[0]
        assert(
          item.kind === "task" &&
            item.revision === 3 &&
            item.status === "in_progress" &&
            item.checklist[0].completed,
          "progress and dependent revision"
        )
      }
    )
    await check(
      "Respuesta perdida tras commit: replay sin duplicados",
      async () => {
        await call(0, {
          type: "commit",
          command: {
            type: "item.update",
            itemId,
            input: {
              ...draft,
              title: "Respuesta perdida",
              status: "in_progress",
              checklist: [{ ...draft.checklist[0], completed: true }],
            },
          },
        })
        await call(0, { type: "drop-response" })
        await pass(0, "retry_later")
        const before = (await snapshot(0)).entries.at(-1)
        assert(
          before?.state === "pending" && before.attempts === 1,
          "retryable entry after committed response loss"
        )
        assert((await remote())[0].revision === 4, "one remote mutation")
        await pass(0)
        await pass(1)
        await equalDevices()
        const after = (await snapshot(0)).entries.at(-1)
        assert(
          JSON.stringify(after?.operation) ===
            JSON.stringify(before.operation) &&
            after?.attempts === 2 &&
            after.state === "acknowledged",
          "same frozen operation replay"
        )
        assert(
          (await remote()).length === 1 &&
            (await remote())[0].revision === 4 &&
            (await snapshot(0)).cursor.after === 4,
          "no duplicate item, revision or journal event"
        )
      }
    )
    await check("Borrado y tombstone convergen tras otra recarga", async () => {
      await call(1, {
        type: "commit",
        command: { type: "item.delete", itemId },
      })
      await pass(1)
      await pass(0)
      await load(1)
      await pass(1)
      await equalDevices()
      assert(
        (await remote())[0].deletedAt !== null &&
          (await remote())[0].revision === 5,
        "durable tombstone"
      )
    })
    await check(
      "Conflicto conserva borrador y permite otra entidad independiente",
      async () => {
        const conflictId = crypto.randomUUID()
        await call(0, {
          type: "commit",
          command: { type: "item.create", itemId: conflictId, input: draft },
        })
        await pass(0)
        await pass(1)
        await call(0, {
          type: "commit",
          command: {
            type: "item.update",
            itemId: conflictId,
            input: { ...draft, title: "Borrador local" },
          },
        })
        await call(1, {
          type: "commit",
          command: {
            type: "item.update",
            itemId: conflictId,
            input: { ...draft, title: "Versión remota" },
          },
        })
        await pass(1)
        await call(0, {
          type: "commit",
          command: {
            type: "item.create",
            itemId: independentId,
            input: { ...draft, title: "Tarea independiente" },
          },
        })
        await pass(0)
        await pass(1)
        const local = await snapshot(0)
        assert(
          local.entries.filter((entry) => entry.state === "conflict").length ===
            1,
          "one durable conflict"
        )
        assert(
          local.items.find((item) => item.id === conflictId)?.title ===
            "Borrador local",
          "local draft preserved"
        )
        assert(
          local.shadows.find(
            (shadow) => shadow.entityKey === `item:${conflictId}`
          )?.record.title === "Versión remota",
          "remote shadow preserved"
        )
        assert(
          (await remote()).find((item) => item.id === independentId)?.title ===
            "Tarea independiente",
          "independent entity uploaded"
        )
        assert(
          ordered((await snapshot(1)).items) === ordered(await remote()),
          "second device reflects authoritative records"
        )
        await load(0)
        assert(
          (await snapshot(0)).entries.some(
            (entry) => entry.state === "conflict"
          ),
          "conflict survives reload"
        )
      }
    )
    passed = true
    statusElement.textContent =
      "Seis escenarios integrados correctos; limpiando recursos propios"
  } catch (error) {
    statusElement.textContent = `Prueba fallida: ${error instanceof Error ? error.message : "error"}`
  } finally {
    for (let index = 0; index < frames.length; index++) {
      try {
        await call(index, { type: "cleanup" })
      } catch {
        passed = false
      }
      frames[index].remove()
    }
    statusElement.textContent += passed
      ? "; bases ficticias eliminadas"
      : "; revisar fallo"
    await fetch(passed ? "/fixture-pass" : "/fixture-fail", {
      ...options,
      method: "POST",
    })
  }
}
