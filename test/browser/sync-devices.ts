import type { z } from "zod"
import {
  commitAccountBackupImport,
  prepareAccountBackupImport,
} from "@/features/workspace/import-backup"
import { readAccountBackup } from "@/features/workspace/local-backup"
import {
  encodeLocalBackup,
  localBackupStoreNames,
} from "@/lib/backup/local-backup"
import { readAccountControl } from "@/lib/local-db/account-control"
import { calendarItemSchema, taskDraftSchema } from "@/schemas/calendar-item"
import {
  syncBrowserCommandSchema,
  syncBrowserFixtureSchema,
  syncBrowserSnapshotSchema,
} from "@/schemas/sync-browser-test"
import type { CalendarItem } from "@/types/calendar-item"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

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
async function importAccount() {
  const control = await readAccountControl()
  assert(control.userId === fixture.userId, "owned import account")
  return { userId: fixture.userId, epoch: control.epoch }
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
    [first.summary, second.summary].every(
      (summary) =>
        summary.pending +
          summary.sending +
          summary.conflicts +
          summary.rejected ===
        0
    ),
    "confirmed operations excluded from pending count"
  )
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
function resolution(
  expected: SyncIncidentSnapshot,
  choice: "adopt_remote" | "retry_local"
) {
  return {
    userId: fixture.userId,
    expected,
    choice,
    resolutionId: crypto.randomUUID(),
    operationId: choice === "retry_local" ? crypto.randomUUID() : null,
    copyItemId: null,
    createdAt: new Date().toISOString(),
  }
}
async function refused(work: () => Promise<unknown>) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed, "unsafe resolution refused")
}
const itemId = crypto.randomUUID()
const independentId = crypto.randomUUID()
const checklistId = crypto.randomUUID()
let archivedSourceJson = ""
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
        assert(
          (await snapshot(0)).summary.ready === 1,
          "offline operation is ready and unconfirmed"
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
        archivedSourceJson = encodeLocalBackup(
          await readAccountBackup(await importAccount()),
          fixture.userId
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
          local.summary.conflicts === 1 && local.summary.pending === 0,
          "conflict visible after independent acknowledgement"
        )
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
    await check(
      "Reintento explícito con cadena, respuesta perdida y recarga converge sin duplicados",
      async () => {
        const firstIncident = (await snapshot(0)).incidents[0]
        assert(firstIncident?.local, "preserved incident before resolution")
        const conflictId = firstIncident.local.id
        await call(0, {
          type: "commit",
          command: {
            type: "task.set-status",
            itemId: conflictId,
            occurrenceId: null,
            status: "in_progress",
          },
        })
        const incident = (await snapshot(0)).incidents[0]
        assert(
          incident.intentions.length === 2 && incident.remote?.revision === 2,
          "complete reviewed chain"
        )
        const request = resolution(incident, "retry_local")
        await call(0, { type: "resolve", request })
        const after = await snapshot(0)
        assert(
          after.entries.filter((entry) => entry.state === "superseded")
            .length === 2 && after.summary.ready === 1,
          "superseded originals with one fresh intent"
        )
        assert(
          after.entries.at(-1)?.operation.baseRevision === 2,
          "new remote CAS base"
        )
        await call(0, { type: "drop-response" })
        await pass(0, "retry_later")
        assert(
          (await remote()).find((item) => item.id === conflictId)?.revision ===
            3,
          "replacement committed once"
        )
        const queueBeforeReplay = JSON.stringify((await snapshot(0)).entries)
        await call(0, { type: "resolve", request })
        assert(
          JSON.stringify((await snapshot(0)).entries) === queueBeforeReplay,
          "resolution replay retains uncertain send"
        )
        await load(0)
        await pass(0)
        await pass(1)
        await equalDevices()
        const item = (await remote()).find((item) => item.id === conflictId)
        assert(
          item?.kind === "task" &&
            item.title === "Borrador local" &&
            item.status === "in_progress" &&
            item.revision === 3,
          "chosen full draft converged once"
        )
        const local = await snapshot(0)
        assert(
          local.entries.find(
            (entry) =>
              entry.operation.operationId ===
              incident.entry.operation.operationId
          )?.state === "superseded",
          "original conflict never acknowledged"
        )
        assert(
          local.entries.find(
            (entry) => entry.operation.operationId === request.operationId
          )?.state === "acknowledged",
          "only replacement acknowledged"
        )
      }
    )
    await check(
      "Elección obsoleta se rechaza; adoptar remoto no escribe servidor y converge",
      async () => {
        const current = (await remote()).find(
          (item) => item.id !== itemId && item.id !== independentId
        )
        assert(current, "conflict item remains")
        await call(0, {
          type: "commit",
          command: {
            type: "item.update",
            itemId: current.id,
            input: { ...draft, title: "Otra edición local" },
          },
        })
        await call(1, {
          type: "commit",
          command: {
            type: "item.update",
            itemId: current.id,
            input: { ...draft, title: "Remoto elegido" },
          },
        })
        await pass(1)
        await pass(0)
        const old = (await snapshot(0)).incidents[0]
        const obsolete = resolution(old, "adopt_remote")
        await call(0, {
          type: "commit",
          command: {
            type: "task.set-status",
            itemId: current.id,
            occurrenceId: null,
            status: "completed",
          },
        })
        const beforeRefusal = JSON.stringify(await snapshot(0))
        await refused(() => call(0, { type: "resolve", request: obsolete }))
        assert(
          JSON.stringify(await snapshot(0)) === beforeRefusal,
          "stale refusal preserves every local record"
        )
        const incident = (await snapshot(0)).incidents[0]
        const remoteBefore = ordered(await remote())
        const cursorBefore = (await snapshot(0)).cursor.after
        await call(0, {
          type: "resolve",
          request: resolution(incident, "adopt_remote"),
        })
        await load(0)
        await pass(0)
        await pass(1)
        await equalDevices()
        assert(
          ordered(await remote()) === remoteBefore &&
            (await snapshot(0)).cursor.after === cursorBefore,
          "adoption creates no remote revision or journal event"
        )
      }
    )
    await check(
      "Tombstone remoto impide resurrección y adopción mantiene ambos dispositivos coherentes",
      async () => {
        const current = (await remote()).find(
          (item) => item.id !== itemId && item.id !== independentId
        )
        assert(current, "test item before deletion")
        await call(0, {
          type: "commit",
          command: {
            type: "item.update",
            itemId: current.id,
            input: { ...draft, title: "Borrador conservado ante borrado" },
          },
        })
        await call(1, {
          type: "commit",
          command: { type: "item.delete", itemId: current.id },
        })
        await pass(1)
        await pass(0)
        const incident = (await snapshot(0)).incidents[0]
        assert(incident.remote?.deletedAt, "known remote tombstone")
        const before = JSON.stringify(await snapshot(0))
        await refused(() =>
          call(0, {
            type: "resolve",
            request: resolution(incident, "retry_local"),
          })
        )
        assert(
          JSON.stringify(await snapshot(0)) === before,
          "no identity resurrection or discarded draft"
        )
        await call(0, {
          type: "resolve",
          request: resolution(incident, "adopt_remote"),
        })
        await pass(0)
        await pass(1)
        await equalDevices()
        assert(
          (await remote()).find((item) => item.id === current.id)?.revision ===
            current.revision + 1,
          "only explicit remote delete increments revision"
        )
      }
    )
    await check(
      "Copia explícita nueva converge sin resucitar original ni duplicarse tras pérdida de respuesta",
      async () => {
        const copySourceId = crypto.randomUUID()
        await call(0, {
          type: "commit",
          command: {
            type: "item.create",
            itemId: copySourceId,
            input: { ...draft, title: "Original para recuperar" },
          },
        })
        await pass(0)
        await pass(1)
        await call(0, {
          type: "commit",
          command: {
            type: "item.update",
            itemId: copySourceId,
            input: {
              ...draft,
              title: "Borrador recuperado como copia",
              status: "in_progress",
            },
          },
        })
        await call(1, {
          type: "commit",
          command: { type: "item.delete", itemId: copySourceId },
        })
        await pass(1)
        await pass(0)
        const incident = (await snapshot(0)).incidents[0]
        assert(incident?.remote?.deletedAt, "copy source remote tombstone")
        const copyItemId = crypto.randomUUID()
        const request = {
          ...resolution(incident, "retry_local"),
          choice: "copy_local" as const,
          copyItemId,
        }
        await call(0, { type: "resolve", request })
        await call(0, { type: "drop-response" })
        await pass(0, "retry_later")
        const queueBefore = JSON.stringify((await snapshot(0)).entries)
        await call(0, { type: "resolve", request })
        assert(
          JSON.stringify((await snapshot(0)).entries) === queueBefore,
          "copy replay preserves uncertain send"
        )
        await load(0)
        await pass(0)
        await pass(1)
        await equalDevices()
        const items = await remote()
        const original = items.find((item) => item.id === copySourceId)
        const copy = items.find((item) => item.id === copyItemId)
        assert(
          original?.deletedAt && original.revision === 2,
          "original tombstone revision unchanged"
        )
        assert(
          copy?.kind === "task" &&
            copy.title === "Borrador recuperado como copia" &&
            copy.status === "in_progress" &&
            copy.revision === 1 &&
            copy.deletedAt === null,
          "new copy confirmed once"
        )
        assert(
          items.filter((item) => item.id === copyItemId).length === 1,
          "one new item"
        )
        const local = await snapshot(0)
        assert(
          local.entries.find(
            (entry) =>
              entry.operation.operationId ===
              incident.entry.operation.operationId
          )?.state === "superseded",
          "original not acknowledged by copying"
        )
        assert(
          local.entries.find(
            (entry) => entry.operation.operationId === request.operationId
          )?.state === "acknowledged",
          "new identity received a real ACK"
        )
      }
    )
    await check(
      "Sesión ausente o caducada conserva cola sin ACK y permite reintento",
      async () => {
        const id = crypto.randomUUID()
        await call(0, {
          type: "commit",
          command: {
            type: "item.create",
            itemId: id,
            input: { ...draft, title: "Recuperar sesión sin perder cambios" },
          },
        })
        const before = await snapshot(0)
        const entry = before.entries.find((e) => e.entityKey === `item:${id}`)
        assert(entry, "new pending entry exists")
        await call(0, { type: "session", active: false, expireOnPush: false })
        await pass(0, "unauthorized")
        assert(
          JSON.stringify((await snapshot(0)).entries) ===
            JSON.stringify(before.entries),
          "absent identity does not alter queue"
        )
        await call(0, { type: "session", active: true, expireOnPush: true })
        await pass(0, "unauthorized")
        const preserved = (await snapshot(0)).entries.find(
          (e) => e.operation.operationId === entry.operation.operationId
        )
        assert(
          preserved?.state === "pending" &&
            preserved.lease === null &&
            preserved.attempts === 1,
          "expired session releases claim without ACK"
        )
        assert(
          JSON.stringify(preserved.operation) ===
            JSON.stringify(entry.operation),
          "frozen operation preserved"
        )
        assert(
          !(await remote()).some((e) => e.id === id),
          "expired session never commits"
        )
        await load(0)
        await pass(0)
        await pass(1)
        await equalDevices()
        assert(
          (await remote()).find((e) => e.id === id)?.revision === 1,
          "retry creates exactly once"
        )
      }
    )
    await check(
      "Cierre tras commit y lease expirada recuperan UUID y convergen tras recarga",
      async () => {
        const id = crypto.randomUUID()
        await call(0, {
          type: "commit",
          command: {
            type: "item.create",
            itemId: id,
            input: { ...draft, title: "Cerrar después del commit" },
          },
        })
        const entry = (await snapshot(0)).entries.find(
          (e) => e.entityKey === `item:${id}`
        )
        assert(entry, "entry to stop exists")
        await call(0, { type: "stop-after-commit" })
        await pass(0, "stopped")
        const stopped = (await snapshot(0)).entries.find(
          (e) => e.operation.operationId === entry.operation.operationId
        )
        assert(
          stopped?.state === "pending" && stopped.lease === null,
          "close preserves pending instead of ACK"
        )
        assert(
          (await remote()).find((e) => e.id === id)?.revision === 1,
          "remote commit succeeded before stop"
        )
        await load(0)
        await call(0, {
          type: "expire-lease",
          operationId: entry.operation.operationId,
        })
        const expired = (await snapshot(0)).entries.find(
          (e) => e.operation.operationId === entry.operation.operationId
        )
        assert(
          expired?.state === "sending" &&
            expired.lease &&
            Date.parse(expired.lease.expiresAt) < Date.now(),
          "expired sending lease is durable"
        )
        await load(0)
        await pass(0)
        await pass(1)
        await equalDevices()
        const ack = (await snapshot(0)).entries.find(
          (e) => e.operation.operationId === entry.operation.operationId
        )
        assert(
          ack?.state === "acknowledged" &&
            JSON.stringify(ack.operation) === JSON.stringify(entry.operation),
          "recovered receipt confirms same UUID and payload"
        )
        assert(
          (await remote()).find((e) => e.id === id)?.revision === 1,
          "replay after close and expired lease does not duplicate"
        )
      }
    )
    await check(
      "Despliegue incompatible pausa sin perder cola y reanuda la misma operación",
      async () => {
        const id = crypto.randomUUID()
        await call(0, {
          type: "commit",
          command: {
            type: "item.create",
            itemId: id,
            input: { ...draft, title: "Actualizar conservando pendientes" },
          },
        })
        const before = await snapshot(0)
        const entry = before.entries.find((e) => e.entityKey === `item:${id}`)
        assert(entry, "pending before deployment mismatch")
        for (const mode of ["missing", "future", "future-pull"] as const) {
          await call(0, { type: "protocol", mode })
          await pass(0, "update_required")
          const after = await snapshot(0)
          assert(
            JSON.stringify(after) === JSON.stringify(before),
            "incompatibility preserves all local data"
          )
        }
        await call(0, { type: "protocol", mode: "future-push" })
        await pass(0, "update_required")
        const entryAfter = (await snapshot(0)).entries.find(
          (e) => e.operation.operationId === entry.operation.operationId
        )
        assert(
          entryAfter?.state === "pending" &&
            entryAfter.lease === null &&
            entryAfter.attempts === 1,
          "push incompatibility releases without ACK"
        )
        assert(
          JSON.stringify(entryAfter.operation) ===
            JSON.stringify(entry.operation),
          "operation and UUID preserved through mismatch"
        )
        assert(
          !(await remote()).some((e) => e.id === id),
          "no remote mutation under mismatch"
        )
        await load(0)
        await pass(0)
        await pass(1)
        await equalDevices()
        assert(
          (await remote()).find((e) => e.id === id)?.revision === 1,
          "compatible reload converges exactly once"
        )
      }
    )
    await check(
      "Importación crea una copia nueva: ACK real, replay y progreso convergen sin restaurar historia",
      async () => {
        // The controller shares device 0's origin and uses its real partition.
        const account = await importAccount()
        const before = await readAccountBackup(account)
        const original = before.stores.items.find((item) => item.id === itemId)
        assert(
          original?.deletedAt && original.revision === 5,
          "source is now a tombstone"
        )
        const plan = await prepareAccountBackupImport(account, {
          sourceJson: archivedSourceJson,
          expected: before,
          sourceItemIds: [itemId],
        })
        const copy = plan.copies[0]
        assert(copy && copy.item.id !== itemId, "new identity selected")
        const result = await commitAccountBackupImport(account, plan)
        assert(result.status === "applied", "import committed locally")
        const imported = await readAccountBackup(account)
        const entry = imported.stores.outbox.find(
          (value) => value.operation.operationId === copy.operation.operationId
        )
        assert(
          entry?.state === "pending" &&
            entry.attempts === 0 &&
            entry.lease === null &&
            entry.operation.command.type === "item.create" &&
            entry.operation.baseRevision === 0 &&
            copy.item.revision === 0,
          "new copy requires a real create ACK"
        )
        for (const store of localBackupStoreNames) {
          const retained = imported.stores[store].filter((record) => {
            if (store === "items")
              return !("id" in record && record.id === copy.item.id)
            if (store === "outbox")
              return !(
                "operation" in record &&
                record.operation.operationId === copy.operation.operationId
              )
            if (store === "syncMetadata")
              return !(
                "key" in record &&
                (record.key === "outbox-sequence" ||
                  record.key === result.record.key)
              )
            return true
          })
          const previous = before.stores[store].filter(
            (record) =>
              !(
                store === "syncMetadata" &&
                "key" in record &&
                record.key === "outbox-sequence"
              )
          )
          assert(
            JSON.stringify(retained) === JSON.stringify(previous),
            `${store} preserves existing records and history`
          )
        }
        assert(
          result.record.sourceJson === archivedSourceJson,
          "source history archived literally"
        )
        assert(
          !(await remote()).some((item) => item.id === copy.item.id),
          "local import does not confer remote authority"
        )
        const secondBefore = await snapshot(1)
        assert(
          !secondBefore.items.some((item) => item.id === copy.item.id),
          "second device has no local copy yet"
        )
        await call(0, { type: "drop-response" })
        await pass(0, "retry_later")
        const lost = await readAccountBackup(account)
        assert(
          lost.stores.outbox.find(
            (value) =>
              value.operation.operationId === copy.operation.operationId
          )?.state === "pending" &&
            (await remote()).find((item) => item.id === copy.item.id)
              ?.revision === 1,
          "remote create committed once while its local receipt is uncertain"
        )
        await load(0)
        assert(
          (await commitAccountBackupImport(account, plan)).status ===
            "replayed",
          "durable import receipt replays after reload"
        )
        assert(
          JSON.stringify((await readAccountBackup(account)).stores) ===
            JSON.stringify(lost.stores),
          "replay preserves uncertain operation and all local stores"
        )
        await pass(0)
        await pass(1)
        await equalDevices()
        const acknowledged = await snapshot(0)
        const ack = acknowledged.entries.find(
          (value) => value.operation.operationId === copy.operation.operationId
        )
        const confirmed = acknowledged.items.find(
          (item) => item.id === copy.item.id
        )
        assert(
          ack?.state === "acknowledged" &&
            ack.attempts === 2 &&
            JSON.stringify(ack.operation) === JSON.stringify(entry.operation) &&
            confirmed?.kind === "task" &&
            confirmed.revision === 1 &&
            confirmed.status === "in_progress" &&
            confirmed.checklist[0].completed,
          "same imported intention receives real ACK and preserves source progress"
        )
        await call(0, {
          type: "commit",
          command: {
            type: "task.set-status",
            itemId: copy.item.id,
            occurrenceId: null,
            status: "completed",
          },
        })
        const edited = await readAccountBackup(account)
        assert(
          (await commitAccountBackupImport(account, plan)).status ===
            "replayed",
          "receipt replay after subsequent edit"
        )
        assert(
          JSON.stringify((await readAccountBackup(account)).stores) ===
            JSON.stringify(edited.stores),
          "replay does not overwrite copy progress or append intentions"
        )
        await pass(0)
        await pass(1)
        await equalDevices()
        const final = await readAccountBackup(account)
        const items = await remote()
        const finalCopy = items.find((item) => item.id === copy.item.id)
        assert(
          finalCopy?.kind === "task" &&
            finalCopy.status === "completed" &&
            finalCopy.revision === 2,
          "later progress reaches both devices once"
        )
        assert(
          items.filter((item) => item.id === copy.item.id).length === 1,
          "exactly one imported identity"
        )
        assert(
          JSON.stringify(items.find((item) => item.id === itemId)) ===
            JSON.stringify(original),
          "original remote tombstone is unchanged"
        )
        assert(
          JSON.stringify(
            final.stores.items.find((item) => item.id === itemId)
          ) === JSON.stringify(original),
          "original local tombstone is unchanged"
        )
        assert(
          JSON.stringify(
            final.stores.syncMetadata.find(
              (record) => record.key === result.record.key
            )
          ) === JSON.stringify(result.record),
          "archived source and import receipt remain intact after ACK and edit"
        )
      }
    )
    passed = true
    statusElement.textContent =
      "Catorce escenarios integrados correctos; limpiando recursos propios"
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
