import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import { SyncIncidentPanel } from "@/features/sync/components/sync-incident-panel"
import { SyncIncidentResolutionDialog } from "@/features/sync/components/sync-incident-resolution-dialog"
import { projectSyncIncident } from "@/lib/sync/incident-projection"
import { projectSyncIncidentOverview } from "@/lib/sync/incident-snapshot"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import type { Task } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"

test("placement evidence shows its civil scope, rank, category and tombstone compactly", () => {
  const tagId = crypto.randomUUID()
  const occurrenceId = crypto.randomUUID()
  for (const scope of ["day", "overdue"] as const) {
    const date = scope === "day" ? "2026-10-09" : "0001-01-01"
    const timestamp = "2026-10-09T00:00:00.000Z"
    const html = renderToStaticMarkup(
      <PersonalIncidentVersion
        label="Tu estado actual"
        tagNames={{ [tagId]: "Casa" }}
        snapshot={[
          {
            entityKey: taskPlacementEntityKey(occurrenceId, scope, date),
            record: {
              store: "taskPlacements",
              record: {
                userId: "placement-ui-test",
                occurrenceId,
                scope,
                date,
                tagId,
                position: 4096,
                revision: 7,
                createdAt: timestamp,
                updatedAt: timestamp,
                deletedAt: timestamp,
              },
            },
          },
        ]}
      />
    )
    for (const text of [
      "Tu estado actual",
      "posición 4096",
      "Casa",
      "revisión",
      "7",
      "Eliminada",
      "text-xs",
    ])
      expect(html).toContain(text)
    expect(html).toContain(scope === "day" ? date : "Atrasadas")
    expect(html).not.toContain("0001-01-01")
    expect(html).not.toContain("Sin versión observada")
    expect(html).not.toContain("<button")
    expect(html).not.toContain(occurrenceId)
  }
})

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
  const incident = {
    ...projectSyncIncident(input),
    intentions: [input.entry],
    blockedByRelatedIntentions: false,
  }
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
    blockedByRelatedIntentions: false,
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

test("settings offer proven choices while remote tombstones and related chains limit the available actions", () => {
  const input = fixture()
  const incident = {
    ...projectSyncIncident(input),
    intentions: [input.entry],
    blockedByRelatedIntentions: false,
  }
  const account = { userId: input.userId, epoch: crypto.randomUUID() }
  const render = (data: typeof incident) =>
    renderToStaticMarkup(
      <SyncIncidentPanel incidents={[data]} error={false} account={account} />
    )
  expect(render(incident)).toContain("Enviar borrado local")
  expect(render(incident)).toContain("Usar remoto conocido")
  const deletedRemote = {
    ...incident,
    remote: incident.remote
      ? { ...incident.remote, deletedAt: "2026-10-08T00:00:00.000Z" }
      : null,
  }
  expect(render(deletedRemote)).not.toContain("Enviar borrado local")
  const blocked = render({ ...incident, blockedByRelatedIntentions: true })
  expect(blocked).toContain("cambios relacionados fuera")
  expect(blocked).not.toContain("Usar remoto conocido")
})

test("copy recovery displays a complete draft and explains the new identity without claiming confirmation", () => {
  const input = fixture()
  const incident = {
    ...projectSyncIncident(input),
    intentions: [input.entry],
    blockedByRelatedIntentions: false,
    local: { ...input.local, deletedAt: null },
    remote: { ...input.remote, deletedAt: input.local.updatedAt },
  }
  const html = renderToStaticMarkup(
    <SyncIncidentPanel
      incidents={[incident]}
      error={false}
      account={{ userId: input.userId, epoch: crypto.randomUUID() }}
    />
  )
  expect(html).toContain("Crear copia de mi borrador")
  expect(html).not.toContain("Enviar mi borrador")
  const dialog = renderToStaticMarkup(
    <SyncIncidentResolutionDialog
      incident={incident}
      choice="copy_local"
      busy={false}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
  for (const text of [
    "¿Crear una copia",
    "Local draft",
    "original seguirá eliminado",
    "sin copiar categoría ni orden",
    "pendiente de confirmación",
    "historial",
  ])
    expect(dialog).toContain(text)
})

test("personal comparisons stay compact, preserve all observed versions and offer no resolution choices", () => {
  const item = fixture()
  const tagId = crypto.randomUUID()
  const entry: OutboxEntry = {
    ...item.entry,
    entityKey: `tag:${tagId}`,
    operation: {
      ...item.entry.operation,
      command: {
        type: "tag.save",
        tagId,
        input: { name: "Local category", color: "#123456", position: 4096 },
      },
    },
  }
  const tag = {
    id: tagId,
    userId: item.userId,
    name: "Local category",
    normalizedName: "local category",
    color: "#123456",
    position: 4096,
    revision: 0,
    createdAt: item.local.createdAt,
    updatedAt: item.local.updatedAt,
    deletedAt: null,
  }
  const remote = {
    ...tag,
    name: "Remote category",
    normalizedName: "remote category",
    position: 1024,
    revision: 2,
    deletedAt: item.local.updatedAt,
  }
  const incidents = projectSyncIncidentOverview({
    userId: item.userId,
    entries: [entry],
    items: [],
    tags: [tag],
    itemViews: [],
    taskPlacements: [],
    shadows: [
      {
        version: 2,
        kind: "preference",
        entityKey: entry.entityKey,
        record: { store: "tags", record: remote },
      },
    ],
    outcomes: [
      {
        version: 2,
        kind: "preference",
        key: `operation-outcome:${entry.operation.operationId}`,
        operation: entry.operation,
        result: {
          kind: "preference",
          outcome: {
            status: "conflict",
            operationId: entry.operation.operationId,
            current: { store: "tags", record: remote },
          },
        },
        local: [
          {
            entityKey: entry.entityKey,
            record: { store: "tags", record: tag },
          },
        ],
        base: [
          {
            entityKey: entry.entityKey,
            record: { store: "tags", record: remote },
          },
        ],
      },
    ],
  })
  const html = renderToStaticMarkup(
    <SyncIncidentPanel
      incidents={incidents}
      error={false}
      account={{ userId: item.userId, epoch: crypto.randomUUID() }}
    />
  )
  for (const text of [
    "Local category",
    "Remote category",
    "Conflicto de preferencias",
    "Tu estado actual",
    "Eliminada",
    "revisión 0",
    "posición 4096",
    "Estado local al recibir",
    "Remoto observado al recibir",
    "1 intención personal sin confirmar",
    "resolución de preferencias todavía no está disponible",
  ])
    expect(html).toContain(text)
  expect(html).toContain("text-sm")
  expect(html).toContain("min-h-11")
  expect(html).not.toContain("<button")
  expect(html).not.toContain("Usar remoto conocido")
  expect(html).not.toContain(entry.operation.operationId)
})
