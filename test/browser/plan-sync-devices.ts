import type { z } from "zod"
import type { SyncPassResultV2 } from "@/features/sync/coordinator-v2"
import type { PlanSaveRequest } from "@/schemas/plan-save"
import {
  planSyncBrowserCommandSchema,
  planSyncBrowserRemoteSchema,
  planSyncBrowserSnapshotSchema,
} from "@/schemas/plan-sync-browser-test"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
if (location.origin !== fixture.origins[0])
  throw new Error("Plan controller requires its own loopback origin")
const status = document.getElementById("status")
const results = document.getElementById("results")
const actions = document.getElementById("actions")
if (!status || !results || !actions)
  throw new Error("Plan fixture markup is missing")
const statusElement = status
const resultsElement = results
const frames = fixture.origins.map(() => document.createElement("iframe"))
const loaded = [false, false]
const options = {
  headers: { "x-sync-test-run": fixture.runId },
  cache: "no-store" as const,
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Plan device proof failed: ${message}`)
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
      reject(new Error("Plan device readiness timed out"))
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
      loaded[index] = true
      resolve()
    }
    window.addEventListener("message", listener)
  })
  frame.src = `${fixture.origins[index]}/device?run=${fixture.runId}&reload=${crypto.randomUUID()}`
  frame.title = `Dispositivo de planes ${index + 1}`
  frame.hidden = true
  if (!frame.isConnected) document.body.append(frame)
  await ready
  await call(index, { type: "prepare" })
}
async function call(
  index: number,
  command: z.infer<typeof planSyncBrowserCommandSchema>
): Promise<unknown> {
  const input = planSyncBrowserCommandSchema.parse(command)
  const channel = new MessageChannel()
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Plan device command timed out")),
        60000
      )
      channel.port1.onmessage = (event) => {
        clearTimeout(timer)
        if (event.data?.ok === true) resolve(event.data.value)
        else
          reject(
            new Error(
              `Plan device ${index + 1} ${input.type} failed: ${event.data?.reason ?? "unknown"}`
            )
          )
      }
      frames[index].contentWindow?.postMessage(
        { runId: fixture.runId, command: input },
        fixture.origins[index],
        [channel.port2]
      )
    })
  } finally {
    channel.port1.close()
  }
}
async function snapshot(index: number) {
  return planSyncBrowserSnapshotSchema.parse(
    await call(index, { type: "snapshot" })
  )
}
async function remote() {
  const response = await fetch("/fixture-records", options)
  assert(response.ok, "remote projection request")
  return planSyncBrowserRemoteSchema.parse(await response.json())
}
async function run(index: number, expected = "settled") {
  let result = (await call(index, { type: "run" })) as SyncPassResultV2
  for (
    let pass = 1;
    expected === "settled" && result.status === "more_work" && pass < 10;
    pass++
  )
    result = (await call(index, { type: "run" })) as SyncPassResultV2
  assert(
    result.status === expected,
    `${expected} pass, received ${result.status}`
  )
  return result
}
function ordered(records: readonly unknown[]) {
  const key = (input: unknown) => {
    const record = input as {
      id?: string
      itemId?: string
      occurrenceId?: string
      scope?: string
      date?: string
    }
    return (
      record.id ??
      record.itemId ??
      `${record.occurrenceId}:${record.scope}:${record.date}`
    )
  }
  return JSON.stringify(
    [...records].sort((left, right) => key(left).localeCompare(key(right)))
  )
}
async function equalDevices(expectedReceipts: number) {
  const authoritative = await remote()
  const ids = new Set<string>()
  for (let index = 0; index < frames.length; index++) {
    const local = await snapshot(index)
    assert(
      local.entries.every((entry) => entry.state === "acknowledged"),
      "every local intention has a real remote ACK"
    )
    for (const entry of local.entries) ids.add(entry.operation.operationId)
    for (const store of ["items", "tags", "views", "placements"] as const)
      assert(
        ordered(local[store]) === ordered(authoritative[store]),
        `device ${index + 1} ${store} exactly match MongoDB`
      )
    assert(
      local.cursor.after === authoritative.page.through &&
        local.cursor.through === null,
      "mixed cursor reached the authoritative journal checkpoint"
    )
  }
  assert(
    authoritative.receiptCount === expectedReceipts &&
      ids.size === expectedReceipts,
    "one receipt for each acknowledged UUID"
  )
  for (const operationId of ids)
    assert(
      authoritative.page.changes.filter(
        (change) => change.operationId === operationId
      ).length === 1,
      "each acknowledged UUID journals exactly once"
    )
  return authoritative
}

const tagId = crypto.randomUUID()
const now = new Date().toISOString()
const date = "2026-10-10"
const requests: PlanSaveRequest[] = (
  ["task", "event", "appointment", "note"] as const
).map((variant) => ({
  mode: "create",
  itemId: crypto.randomUUID(),
  contentOperationId: crypto.randomUUID(),
  viewOperationId: crypto.randomUUID(),
  now,
  primaryTagId: tagId,
  input: {
    kind: "plan",
    variant,
    title: `Plan ${variant}`,
    description: "Contenido retenido",
    status: "not_started",
    checklist: [
      { id: crypto.randomUUID(), text: "Paso visible", completed: false },
    ],
    recurrence: null,
    schedule: {
      mode: "all_day",
      startDate: date,
      endDateExclusive: "2026-10-11",
    },
  },
}))
const button = document.createElement("button")
button.textContent = "Ejecutar prueba de planes integrada"
actions.append(button)
statusElement.textContent =
  "Dos dispositivos aislados; prueba de planes pendiente"
button.onclick = async () => {
  button.disabled = true
  let passed = false
  try {
    await load(0)
    await load(1)
    await check(
      "Categoría propia preparada y descargada con el transporte 4 real",
      async () => {
        await call(0, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId,
            input: { name: "Planes comunes", color: "#123abc", position: 1024 },
          },
        })
        await run(0)
        await run(1)
        await equalDevices(1)
      }
    )
    await check(
      "Cuatro variantes y sus categorías se guardan offline sin efectos remotos",
      async () => {
        await call(0, { type: "network", online: false })
        for (const request of requests) await call(0, { type: "save", request })
        const original = await snapshot(0)
        assert(
          original.items.length === 4 &&
            original.views.length === 4 &&
            original.entries.length === 9,
          "four common items, category views and paired intentions are durable"
        )
        await call(0, { type: "save", request: requests[0] })
        assert(
          JSON.stringify(await snapshot(0)) === JSON.stringify(original),
          "atomic producer replay preserves exact offline snapshot"
        )
        await run(0, "retry_later")
        assert(
          (await remote()).receiptCount === 1 &&
            (await remote()).items.length === 0,
          "offline runtime created no remote effects"
        )
        assert(
          (await snapshot(0)).entries.filter(
            (entry) => entry.state === "pending"
          ).length === 8,
          "offline pass never acknowledges a plan"
        )
      }
    )
    await check(
      "Respuesta perdida tras crear un plan: mismo UUID, ACK único y convergencia exacta",
      async () => {
        await call(0, { type: "network", online: true })
        const before = await snapshot(0)
        const original = before.entries.find(
          (entry) =>
            entry.operation.operationId === requests[0].contentOperationId
        )
        assert(original, "original common plan intention exists")
        await call(0, { type: "drop-response" })
        const lost = await run(0, "retry_later")
        assert(lost.uploaded === 0, "lost response cannot count an ACK")
        const afterLoss = await remote()
        assert(
          afterLoss.receiptCount === 2 &&
            afterLoss.items.length === 1 &&
            afterLoss.items[0].kind === "plan",
          "real common item commit survived response loss"
        )
        const retained = (await snapshot(0)).entries.find(
          (entry) =>
            entry.operation.operationId === original.operation.operationId
        )
        assert(
          retained?.state === "pending" &&
            retained.attempts === 1 &&
            retained.lease === null &&
            JSON.stringify(retained.operation) ===
              JSON.stringify(original.operation),
          "lost response preserves exact UUID and payload without ACK"
        )
        await run(0)
        await run(1)
        const authoritative = await equalDevices(9)
        assert(
          authoritative.items.length === 4 && authoritative.views.length === 4,
          "four common plan/category pairs converged"
        )
        const confirmed = (await snapshot(0)).entries.find(
          (entry) =>
            entry.operation.operationId === original.operation.operationId
        )
        assert(
          confirmed?.attempts === 2 &&
            confirmed.state === "acknowledged" &&
            JSON.stringify(confirmed.operation) ===
              JSON.stringify(original.operation),
          "same common creation intention receives its only real ACK"
        )
      }
    )
    await check(
      "Nota reordenada, progreso y checklist común, borrado con tombstone en ambos dispositivos",
      async () => {
        const [task, event, , note] = requests
        await call(1, {
          type: "commit",
          command: {
            type: "task.move",
            itemId: note.itemId,
            occurrenceId: null,
            scope: "day",
            date,
            tagId,
            beforeId: task.itemId,
            afterId: null,
          },
        })
        await call(1, {
          type: "commit",
          command: {
            type: "plan.set-status",
            itemId: note.itemId,
            status: "completed",
          },
        })
        await call(1, {
          type: "commit",
          command: {
            type: "plan.set-checklist-entry",
            itemId: task.itemId,
            entryId: task.input.checklist[0].id,
            completed: true,
          },
        })
        await call(1, {
          type: "commit",
          command: { type: "item.delete", itemId: event.itemId },
        })
        await run(1)
        await run(0)
        const authoritative = await equalDevices(13)
        const completed = authoritative.items.find(
          (item) => item.id === note.itemId
        )
        const checklist = authoritative.items.find(
          (item) => item.id === task.itemId
        )
        assert(
          completed?.kind === "plan" &&
            completed.status === "completed" &&
            completed.completedAt !== null,
          "note has common completed status"
        )
        assert(
          checklist?.kind === "plan" && checklist.checklist[0].completed,
          "task checklist is synchronized"
        )
        assert(
          authoritative.items.find((item) => item.id === event.itemId)
            ?.deletedAt,
          "event tombstone is retained"
        )
        const placement = authoritative.placements.find(
          (record) => record.occurrenceId === note.itemId && !record.deletedAt
        )
        assert(
          placement &&
            authoritative.placements.some(
              (record) =>
                record.occurrenceId === task.itemId &&
                record.position > placement.position
            ),
          "note placement precedes task placement"
        )
      }
    )
    await check(
      "Recarga y pase vacío conservan datos, intenciones y recibos exactos",
      async () => {
        const before = await remote()
        await load(0)
        await load(1)
        assert(
          (await run(0)).uploaded === 0 && (await run(1)).uploaded === 0,
          "reopened runtime uploads no settled intention"
        )
        await equalDevices(13)
        assert(
          JSON.stringify(await remote()) === JSON.stringify(before),
          "idle reload creates no receipts, revisions or journal events"
        )
      }
    )
    passed = true
    statusElement.textContent =
      "Cinco escenarios de planes correctos; limpiando recursos propios"
  } catch (error) {
    statusElement.textContent = `Prueba fallida: ${error instanceof Error ? error.message : "error"}`
  } finally {
    for (let index = 0; index < frames.length; index++) {
      if (loaded[index])
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
