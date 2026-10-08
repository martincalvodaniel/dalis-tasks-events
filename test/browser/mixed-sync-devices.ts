import type { z } from "zod"
import { taskDraftSchema } from "@/schemas/calendar-item"
import {
  mixedSyncBrowserCommandSchema,
  mixedSyncBrowserRemoteSchema,
  mixedSyncBrowserSnapshotSchema,
} from "@/schemas/mixed-sync-browser-test"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
const status = document.getElementById("status")
const results = document.getElementById("results")
const actions = document.getElementById("actions")
if (!status || !results || !actions)
  throw new Error("Mixed fixture markup is missing")
const statusElement = status
const resultsElement = results
const frames = fixture.origins.map(() => document.createElement("iframe"))
const options = {
  headers: { "x-sync-test-run": fixture.runId },
  cache: "no-store" as const,
}

function assert(value: unknown, description: string): asserts value {
  if (!value)
    throw new Error(`Integrated mixed sync assertion failed: ${description}`)
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
      reject(new Error("Mixed fixture device did not become ready"))
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
  command: z.infer<typeof mixedSyncBrowserCommandSchema>
): Promise<unknown> {
  const value = mixedSyncBrowserCommandSchema.parse(command)
  const channel = new MessageChannel()
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Mixed fixture command timed out")),
        60000
      )
      channel.port1.onmessage = (event) => {
        clearTimeout(timer)
        if (event.data?.ok === true) resolve(event.data.value)
        else
          reject(
            new Error(`Mixed device ${index + 1} command failed: ${value.type}`)
          )
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
  return mixedSyncBrowserSnapshotSchema.parse(
    await call(index, { type: "snapshot" })
  )
}
async function remote() {
  const response = await fetch("/fixture-records", options)
  assert(response.ok, "remote records response")
  return mixedSyncBrowserRemoteSchema.parse(await response.json())
}
async function send(index: number, expected = "complete") {
  const result = (await call(index, { type: "send" })) as { status?: string }
  assert(
    result.status === expected,
    `${expected} send, received ${result.status}`
  )
  return result
}
async function pull(index: number) {
  const result = (await call(index, { type: "pull" })) as {
    status?: string
    pages?: number
  }
  assert(result.status === "complete", "completed mixed pull")
  return result
}
function ordered(records: readonly unknown[]) {
  const key = (value: unknown) => {
    const record = value as { id?: string; itemId?: string }
    return record.id ?? record.itemId ?? ""
  }
  return JSON.stringify(
    [...records].sort((left, right) => key(left).localeCompare(key(right)))
  )
}
async function equalDevices() {
  const authoritative = await remote()
  for (let index = 0; index < frames.length; index++) {
    const local = await snapshot(index)
    assert(
      local.entries.every((entry) => entry.state === "acknowledged"),
      "all intentions have real ACKs"
    )
    assert(
      ordered(local.items) === ordered(authoritative.items),
      `device ${index + 1} items match MongoDB`
    )
    assert(
      ordered(local.tags) === ordered(authoritative.tags),
      `device ${index + 1} tags match MongoDB`
    )
    assert(
      ordered(local.views) === ordered(authoritative.views),
      `device ${index + 1} views match MongoDB`
    )
    assert(
      local.cursor.after === authoritative.page.through &&
        local.cursor.through === null,
      "final cursor matches mixed journal checkpoint"
    )
  }
}

const itemId = crypto.randomUUID()
const firstTagId = crypto.randomUUID()
const secondTagId = crypto.randomUUID()
const conflictTagId = crypto.randomUUID()
const draft = taskDraftSchema.parse({
  kind: "task",
  title: "Tarea de prueba mixta",
  description: "",
  scheduledDate: "2026-10-09",
  status: "not_started",
  checklist: [],
  recurrence: null,
})
const button = document.createElement("button")
button.textContent = "Ejecutar prueba mixta integrada"
actions.append(button)
statusElement.textContent =
  "Dos dispositivos aislados preparados; prueba pendiente"
button.onclick = async () => {
  button.disabled = true
  let passed = false
  try {
    await load(0)
    await load(1)
    await check(
      "Tarea y categorías sin red conservan su cola tras recargar",
      async () => {
        await call(0, { type: "network", online: false })
        await call(0, {
          type: "commit",
          command: { type: "item.create", itemId, input: draft },
        })
        await call(0, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId: firstTagId,
            input: { name: "Primera", color: "#123456", position: -1e12 },
          },
        })
        await call(0, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId: secondTagId,
            input: { name: "Segunda", color: "#654321", position: -1e12 + 1 },
          },
        })
        await send(0, "offline")
        const before = await snapshot(0)
        assert(
          before.entries.length === 3 &&
            before.entries.every(
              (entry) => entry.state === "pending" && entry.attempts === 0
            ),
          "offline intentions are unconfirmed"
        )
        assert(
          before.entries[2].dependencies.includes(
            before.entries[1].operation.operationId
          ),
          "personal tail dependency is durable"
        )
        const authoritative = await remote()
        assert(
          authoritative.items.length === 0 &&
            authoritative.tags.length === 0 &&
            authoritative.page.changes.length === 0,
          "offline data never reaches MongoDB"
        )
        assert(
          (await snapshot(1)).items.length === 0 &&
            (await snapshot(1)).tags.length === 0,
          "second origin has independent IndexedDB"
        )
        await load(0)
        assert(
          JSON.stringify(await snapshot(0)) === JSON.stringify(before),
          "reload preserves full queue and records"
        )
      }
    )
    await check(
      "ACK real y bootstrap paginado convergen entre ambos orígenes",
      async () => {
        await send(0)
        await pull(0)
        const downloaded = await pull(1)
        assert(
          (downloaded.pages ?? 0) >= 2,
          "mixed bootstrap spans multiple pages"
        )
        await equalDevices()
        const local = await snapshot(0)
        assert(
          local.outcomes.length === 3,
          "one durable outcome per confirmed intention"
        )
        assert(
          (await remote()).page.changes.length === 3,
          "one journal record per remote mutation"
        )
      }
    )
    await check(
      "Asignación y rebalance de categorías aplican todos sus efectos",
      async () => {
        await call(0, {
          type: "commit",
          command: { type: "item-view.set", itemId, primaryTagId: secondTagId },
        })
        await call(0, {
          type: "commit",
          command: {
            type: "tag.move",
            tagId: secondTagId,
            beforeId: firstTagId,
            afterId: null,
          },
        })
        await send(0)
        await pull(0)
        await pull(1)
        await equalDevices()
        const authoritative = await remote()
        const movement = authoritative.page.changes.find(
          (change) =>
            change.kind === "preference" && change.effects.effects.length >= 2
        )
        assert(
          movement?.kind === "preference" &&
            movement.effects.effects.every((effect) => effect.store === "tags"),
          "rank rebalance journals all affected category revisions"
        )
        assert(
          authoritative.views[0]?.primaryTagId === secondTagId,
          "assignment reached both devices"
        )
        const first = authoritative.tags.find((tag) => tag.id === firstTagId)
        const second = authoritative.tags.find((tag) => tag.id === secondTagId)
        assert(
          first && second && second.position < first.position,
          "category order reflects the command"
        )
      }
    )
    await check(
      "Respuesta perdida y replay mantienen UUID, recibos e historia sin duplicados",
      async () => {
        const tag = (await snapshot(0)).tags.find(
          (value) => value.id === firstTagId
        )
        assert(tag, "first category available")
        await call(0, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId: firstTagId,
            input: {
              name: "Respuesta perdida",
              color: tag.color,
              position: tag.position,
            },
          },
        })
        const original = (await snapshot(0)).entries.at(-1)
        assert(original, "frozen category intention")
        await call(0, { type: "drop-response" })
        await send(0, "response_lost")
        const beforeReplay = await remote()
        const pending = (await snapshot(0)).entries.at(-1)
        assert(
          pending?.state === "pending" &&
            pending.attempts === 1 &&
            pending.lease === null,
          "response loss releases claim without ACK"
        )
        await pull(0)
        await load(0)
        await send(0)
        await pull(0)
        await pull(1)
        await equalDevices()
        const afterReplay = await remote()
        assert(
          JSON.stringify(afterReplay) === JSON.stringify(beforeReplay),
          "replay adds no revisions, effects or journal events"
        )
        const after = await snapshot(0)
        const confirmed = after.entries.at(-1)
        assert(
          confirmed?.state === "acknowledged" &&
            confirmed.attempts === 2 &&
            JSON.stringify(confirmed.operation) ===
              JSON.stringify(original.operation),
          "same UUID and payload receive genuine ACK"
        )
        await load(0)
        await send(0)
        assert(
          JSON.stringify((await snapshot(0)).outcomes) ===
            JSON.stringify(after.outcomes),
          "reload and idle replay retain historical outcomes literally"
        )
      }
    )
    await check(
      "Tombstone y desasignación explícita conservan su historia independiente",
      async () => {
        await call(1, {
          type: "commit",
          command: { type: "tag.delete", tagId: secondTagId },
        })
        await send(1)
        await pull(1)
        await pull(0)
        await load(1)
        await equalDevices()
        const authoritative = await remote()
        assert(
          authoritative.tags.find((tag) => tag.id === secondTagId)?.deletedAt,
          "remote category tombstone retained"
        )
        assert(
          authoritative.views[0]?.primaryTagId === secondTagId,
          "category deletion preserves the historical assignment"
        )
        const deletion = authoritative.page.changes.at(-1)
        assert(
          deletion?.kind === "preference" &&
            deletion.effects.effects.some(
              (effect) =>
                effect.store === "tags" && effect.record.deletedAt !== null
            ),
          "category deletion journals its tombstone without inventing cascading effects"
        )
        await call(1, {
          type: "commit",
          command: { type: "item-view.set", itemId, primaryTagId: null },
        })
        await send(1)
        await pull(1)
        await pull(0)
        await equalDevices()
        const cleared = await remote()
        assert(
          cleared.views[0]?.primaryTagId === null,
          "explicit assignment clearing reached both devices"
        )
        const clearing = cleared.page.changes.at(-1)
        assert(
          clearing?.kind === "preference" &&
            clearing.effects.effects.some(
              (effect) =>
                effect.store === "itemViews" &&
                effect.record.primaryTagId === null
            ),
          "explicit clearing has its own genuine ACK and journal event"
        )
      }
    )
    await check(
      "Cambios de tarea y categoría comparten cursor sin mezclar revisiones",
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
            type: "tag.save",
            tagId: conflictTagId,
            input: {
              name: "Categoría compartida",
              color: "#345678",
              position: 2048,
            },
          },
        })
        await send(1)
        await pull(1)
        await pull(0)
        await equalDevices()
        const authoritative = await remote()
        const item = authoritative.items.find((value) => value.id === itemId)
        assert(
          item?.kind === "task" &&
            item.status === "in_progress" &&
            item.revision === 2,
          "item revision is independent from the journal cursor"
        )
        assert(
          authoritative.tags.find((tag) => tag.id === conflictTagId)
            ?.revision === 1,
          "category starts its own independent revision"
        )
      }
    )
    await check(
      "Conflicto personal preserva borrador, dependientes y evidencia tras recargar",
      async () => {
        const tag = (await snapshot(0)).tags.find(
          (value) => value.id === conflictTagId
        )
        assert(tag, "shared category before concurrent edits")
        await call(0, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId: conflictTagId,
            input: {
              name: "Borrador local",
              color: tag.color,
              position: tag.position,
            },
          },
        })
        await call(0, {
          type: "commit",
          command: {
            type: "item-view.set",
            itemId,
            primaryTagId: conflictTagId,
          },
        })
        const before = await snapshot(0)
        const conflict = before.entries.at(-2)
        const dependent = before.entries.at(-1)
        assert(conflict && dependent, "concurrent category intentions exist")
        assert(
          dependent.dependencies.includes(conflict.operation.operationId),
          "dependent assignment waits for category"
        )
        await call(1, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId: conflictTagId,
            input: {
              name: "Versión remota",
              color: tag.color,
              position: tag.position,
            },
          },
        })
        await send(1)
        await pull(1)
        await send(0)
        await pull(0)
        const local = await snapshot(0)
        assert(
          local.entries.find(
            (entry) =>
              entry.operation.operationId === conflict.operation.operationId
          )?.state === "conflict",
          "conflict has no ACK"
        )
        assert(
          JSON.stringify(
            local.entries.find(
              (entry) =>
                entry.operation.operationId === dependent.operation.operationId
            )
          ) === JSON.stringify(dependent),
          "dependent assignment remains completely unattempted"
        )
        assert(
          local.tags.find((value) => value.id === conflictTagId)?.name ===
            "Borrador local" &&
            local.views.find((value) => value.itemId === itemId)
              ?.primaryTagId === conflictTagId,
          "local draft and assignment remain visible"
        )
        const shadow = local.shadows.find(
          (value) =>
            (value as { entityKey?: string }).entityKey ===
            `tag:${conflictTagId}`
        ) as { record?: { record?: { name?: string } } } | undefined
        assert(
          shadow?.record?.record?.name === "Versión remota",
          "authoritative category shadow preserved alongside the local draft"
        )
        assert(
          (await remote()).tags.find((value) => value.id === conflictTagId)
            ?.name === "Versión remota",
          "conflicting draft does not overwrite MongoDB"
        )
        await load(0)
        assert(
          JSON.stringify(await snapshot(0)) === JSON.stringify(local),
          "all conflict history, tombstones and dependent intentions survive reload"
        )
      }
    )
    await check(
      "Movimiento histórico sin executor bloquea su cola sin ACK ni supersesión",
      async () => {
        await call(1, {
          type: "commit",
          command: {
            type: "task.move",
            itemId,
            occurrenceId: null,
            scope: "day",
            date: draft.scheduledDate,
            tagId: null,
            beforeId: null,
            afterId: null,
          },
        })
        const blockedTagId = crypto.randomUUID()
        await call(1, {
          type: "commit",
          command: {
            type: "tag.save",
            tagId: blockedTagId,
            input: {
              name: "Pendiente tras movimiento",
              color: "#567890",
              position: 4096,
            },
          },
        })
        const before = await snapshot(1)
        const movement = before.entries.at(-2)
        const dependent = before.entries.at(-1)
        assert(movement && dependent, "historical movement intentions exist")
        assert(
          movement?.operation.command.type === "task.move" &&
            dependent?.dependencies.includes(movement.operation.operationId),
          "historical movement owns the global personal tail"
        )
        const authoritativeBefore = await remote()
        const response = (await send(1)) as { unsupported?: number }
        assert(
          response.unsupported === 1,
          "real remote executor explicitly returns unsupported"
        )
        await pull(1)
        const after = await snapshot(1)
        const preserved = after.entries.find(
          (entry) =>
            entry.operation.operationId === movement.operation.operationId
        )
        assert(
          preserved?.state === "pending" &&
            preserved.attempts === 1 &&
            preserved.lease === null &&
            JSON.stringify(preserved.operation) ===
              JSON.stringify(movement.operation),
          "unsupported movement retains UUID and payload without ACK"
        )
        assert(
          JSON.stringify(
            after.entries.find(
              (entry) =>
                entry.operation.operationId === dependent.operation.operationId
            )
          ) === JSON.stringify(dependent),
          "dependent category is never attempted or superseded"
        )
        assert(
          ordered(after.tags) === ordered(before.tags) &&
            ordered(after.views) === ordered(before.views) &&
            ordered(after.items) === ordered(before.items),
          "historical blockade preserves local projection"
        )
        assert(
          JSON.stringify(await remote()) ===
            JSON.stringify(authoritativeBefore),
          "unsupported movement and blocked dependent create no remote changes"
        )
        assert(
          after.outcomes.length === before.outcomes.length,
          "no fabricated movement or dependent outcome"
        )
        await load(1)
        assert(
          JSON.stringify(await snapshot(1)) === JSON.stringify(after),
          "blocked chain remains durable after reload"
        )
      }
    )
    passed = true
    statusElement.textContent =
      "Ocho escenarios mixtos integrados correctos; limpiando recursos propios"
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
