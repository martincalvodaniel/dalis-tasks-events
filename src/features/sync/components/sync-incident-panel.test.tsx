import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { SyncIncidentPanel } from "@/features/sync/components/sync-incident-panel"
import { projectSyncIncident } from "@/lib/sync/incident-projection"
import type { Task } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"

function fixture() {
  const now = "2026-10-08T00:00:00.000Z"
  const userId = "incident-ui-test"
  const local: Task = {
    id: crypto.randomUUID(),
    ownerId: userId,
    kind: "task",
    title: "Local draft",
    description: "Later notes",
    checklist: [],
    status: "in_progress",
    recurrence: null,
    scheduledDate: "2026-10-08",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: now,
    completedAt: null,
  }
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${local.id}`,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: {
        type: "task.set-status",
        itemId: local.id,
        occurrenceId: null,
        status: "completed",
      },
    },
    sequence: 1,
    dependencies: [],
    state: "conflict",
    attempts: 1,
    lease: null,
    createdAt: now,
  }
  const remote = {
    ...local,
    title: "Remote version",
    revision: 2,
    deletedAt: null,
  }
  const outcome = {
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      status: "conflict",
      operationId: entry.operation.operationId,
      current: remote,
    },
    local,
    base: remote,
  }
  return { userId, local, remote, entry, outcome }
}
test("comparison distinguishes local tombstone, known remote and frozen command without offering premature choices", () => {
  const input = fixture()
  const incident = { ...projectSyncIncident(input), intentions: [input.entry] }
  const html = renderToStaticMarkup(
    <SyncIncidentPanel incidents={[incident]} error={false} />
  )
  for (const label of [
    "Local draft",
    "Remote version",
    "Elemento eliminado",
    "Tu borrador actual",
    "Versión remota conocida",
    "Cambiar estado: Completada",
    "revisión de partida",
    "1 intención sin confirmar",
    "puede haber cambios más recientes",
  ])
    expect(html).toContain(label)
  expect(html).not.toContain("<button")
  expect(html).not.toContain(input.entry.operation.operationId)
})
test("rejection explains unavailable remote data while read errors hide cached comparison", () => {
  const input = fixture()
  const incident = {
    ...projectSyncIncident({
      ...input,
      entry: { ...input.entry, state: "rejected" },
      remote: null,
      outcome: {
        ...input.outcome,
        base: null,
        result: {
          status: "unavailable",
          operationId: input.entry.operation.operationId,
        },
      },
    }),
    intentions: [input.entry],
  }
  const html = renderToStaticMarkup(
    <SyncIncidentPanel incidents={[incident]} error={false} />
  )
  expect(html).toContain("no permite acceder")
  expect(html).toContain("No disponible en este dispositivo")
  const error = renderToStaticMarkup(
    <SyncIncidentPanel incidents={[incident]} error />
  )
  expect(error).toContain('role="alert"')
  expect(error).not.toContain("Local draft")
  expect(
    renderToStaticMarkup(
      <SyncIncidentPanel incidents={undefined} error={false} />
    )
  ).toContain("Leyendo cambios")
  expect(
    renderToStaticMarkup(<SyncIncidentPanel incidents={[]} error={false} />)
  ).toContain("No hay conflictos")
})
