import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SyncIncidentPanel } from "@/features/sync/components/sync-incident-panel"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { projectSyncIncidentOverview } from "@/lib/sync/incident-snapshot"
import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { decodeLocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import {
  projectPlanOccurrenceSyncIncidents,
  projectRecurringSyncIncidentOverview,
} from "@/lib/sync/recurring-incident-snapshot"
import {
  localPlanOccurrenceOutcomeSchema,
  planOccurrenceEntityKey,
} from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import type { OutboxEntry } from "@/types/local-sync"

const timestamp = "2026-10-11T13:00:00.000Z"
function fixture() {
  const userId = "recurring-incident-owner",
    id = crypto.randomUUID()
  const series = planSchema.parse({
    kind: "plan",
    variant: "task",
    id,
    ownerId: userId,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const entry = outboxEntrySchema.parse({
    userId,
    entityKey: `item:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        expectedOccurrenceRevision: 0,
        status: "in_progress",
      },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: timestamp,
  })
  const local = applyPlanOccurrenceCommand(
    series,
    null,
    {
      type: "plan.set-occurrence-status",
      itemId: id,
      occurrenceId: `${id}:2026-10-11`,
      status: "in_progress",
    },
    userId,
    timestamp
  )
  const remote = {
    ...local,
    revision: 2,
    status: "completed" as const,
    completedAt: timestamp,
  }
  const outcome = localPlanOccurrenceOutcomeSchema.parse({
    version: 2,
    kind: "plan-occurrence",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "plan-occurrence",
      userId,
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        series,
        current: remote,
      },
    },
    local,
    base: null,
    series,
  })
  return {
    userId,
    series,
    entry,
    local,
    remote,
    outcome,
    input: {
      userId,
      items: [series],
      occurrences: [local],
      entries: [entry],
      shadows: [] as unknown[],
      outcomes: [outcome] as unknown[],
    },
  }
}
test("appearance conflict compares current occurrence instead of parent and retains frozen observation", () => {
  const value = fixture(),
    newer = {
      ...value.local,
      content: { title: "Later local", description: "" },
    }
  const input = { ...value.input, occurrences: [newer] },
    before = structuredClone(input)
  const [incident] = projectPlanOccurrenceSyncIncidents(input)
  expect(incident).toMatchObject({
    reason: "conflict",
    local: newer,
    localAtOutcome: value.local,
    shadowAtOutcome: null,
    remote: value.remote,
    series: value.series,
    seriesAtOutcome: value.series,
    intentions: [value.entry],
    blockedByRelatedIntentions: false,
  })
  expect(input).toEqual(before)
  expect(decodeLocalRecurringOutcome(value.outcome, value.userId)).toEqual(
    value.outcome
  )
  expect(() =>
    decodeLocalOperationOutcome(value.outcome, value.userId)
  ).toThrow()
})
test("late replay bases and current remote revisions are observations, with equal-revision contradictions rejected", () => {
  const value = fixture(),
    later = {
      ...value.remote,
      revision: 7,
      cancelled: true,
      deletedAt: timestamp,
    }
  const outcome = { ...value.outcome, base: later }
  expect(
    projectPlanOccurrenceSyncIncidents({
      ...value.input,
      outcomes: [outcome],
    })[0].remote
  ).toEqual(later)
  const shadow = {
    version: 2,
    kind: "plan-occurrence",
    userId: value.userId,
    entityKey: planOccurrenceEntityKey(later.id),
    seriesRevision: 8,
    record: later,
  }
  expect(
    projectPlanOccurrenceSyncIncidents({
      ...value.input,
      outcomes: [outcome],
      shadows: [shadow],
    })[0].remote
  ).toEqual(later)
  expect(() =>
    projectPlanOccurrenceSyncIncidents({
      ...value.input,
      outcomes: [outcome],
      shadows: [{ ...shadow, record: value.remote }],
    })
  ).toThrow("regresses")
  expect(() =>
    projectPlanOccurrenceSyncIncidents({
      ...value.input,
      shadows: [{ ...shadow, record: { ...value.remote, cancelled: true } }],
    })
  ).toThrow("contradictory")
})
test("materialized absence, rejected outcomes and parent tombstones remain explicit", () => {
  const value = fixture()
  if (value.outcome.result.outcome.status !== "conflict")
    throw new Error("Conflict fixture is missing")
  const outcome = {
    ...value.outcome,
    local: null,
    result: {
      ...value.outcome.result,
      outcome: { ...value.outcome.result.outcome, current: null },
    },
  }
  const [absent] = projectPlanOccurrenceSyncIncidents({
    ...value.input,
    occurrences: [],
    outcomes: [outcome],
  })
  expect(absent.local).toBeNull()
  expect(absent.localAtOutcome).toBeNull()
  expect(absent.remote).toBeNull()
  const rejected = {
    ...value.outcome,
    result: {
      ...value.outcome.result,
      outcome: {
        status: "unavailable",
        operationId: value.entry.operation.operationId,
      },
    },
  }
  const deleted = { ...value.series, revision: 4, deletedAt: timestamp }
  const [incident] = projectPlanOccurrenceSyncIncidents({
    ...value.input,
    items: [deleted],
    entries: [{ ...value.entry, state: "rejected" }],
    outcomes: [rejected],
  })
  expect(incident.reason).toBe("unavailable")
  expect(incident.series).toEqual(deleted)
  expect(incident.local).toEqual(value.local)
})
test("related slots, parent intentions and cross-entity dependencies stay visible and blocked", () => {
  const value = fixture()
  const next = outboxEntrySchema.parse({
    ...value.entry,
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [value.entry.operation.operationId],
    operation: {
      ...value.entry.operation,
      operationId: crypto.randomUUID(),
      command: {
        ...value.entry.operation.command,
        occurrenceId: `${value.series.id}:2026-10-12`,
      },
    },
  })
  const parent = outboxEntrySchema.parse({
    ...next,
    sequence: 3,
    operation: {
      ...next.operation,
      operationId: crypto.randomUUID(),
      command: { type: "item.delete", itemId: value.series.id },
    },
  })
  const entries = [value.entry, next, parent]
  const [incident] = projectPlanOccurrenceSyncIncidents({
    ...value.input,
    entries,
  })
  expect(incident.intentions).toEqual(entries)
  expect(incident.blockedByRelatedIntentions).toBe(true)
  expect(entries[1].state).toBe("pending")
  expect(entries[1].operation).toEqual(next.operation)
})
test("full malformed snapshot, foreign evidence, wrong frozen states and missing parent are never filtered", () => {
  const value = fixture()
  for (const input of [
    { ...value.input, items: [] },
    { ...value.input, items: [{ ...value.series, ownerId: "foreign" }] },
    { ...value.input, entries: [{ ...value.entry, userId: "foreign" }] },
    { ...value.input, entries: [value.entry, value.entry] },
    {
      ...value.input,
      entries: [{ ...value.entry, dependencies: [crypto.randomUUID()] }],
    },
    { ...value.input, entries: [{ ...value.entry, state: "rejected" }] },
    {
      ...value.input,
      entries: [
        {
          ...value.entry,
          operation: { ...value.entry.operation, baseRevision: 2 },
        },
      ],
    },
    { ...value.input, occurrences: [value.local, value.local] },
    { ...value.input, outcomes: [] },
    { ...value.input, outcomes: [value.outcome, value.outcome] },
    {
      ...value.input,
      outcomes: [
        {
          ...value.outcome,
          result: { ...value.outcome.result, userId: "foreign" },
        },
      ],
    },
    { ...value.input, shadows: [{ kind: "plan-occurrence", version: 3 }] },
  ])
    expect(() => projectPlanOccurrenceSyncIncidents(input)).toThrow()
})
test("legacy evidence remains readable, historic missing revision stays unsupported and no incident is invented", () => {
  const value = fixture(),
    operation = {
      ...value.entry.operation,
      command: { type: "item.delete", itemId: value.series.id },
    }
  const entry = outboxEntrySchema.parse({
    ...value.entry,
    state: "rejected",
    operation,
  })
  const legacy = {
    key: `operation-outcome:${operation.operationId}`,
    operation,
    result: { status: "unavailable", operationId: operation.operationId },
    local: value.series,
    base: null,
  }
  expect(decodeLocalRecurringOutcome(legacy, value.userId)).toMatchObject({
    kind: "item",
    version: 2,
  })
  expect(
    projectPlanOccurrenceSyncIncidents({
      ...value.input,
      entries: [entry],
      outcomes: [legacy],
    })
  ).toEqual([])
  const historic: OutboxEntry = structuredClone(value.entry)
  if (!("expectedOccurrenceRevision" in historic.operation.command))
    throw new Error("Appearance fixture is missing")
  delete historic.operation.command.expectedOccurrenceRevision
  historic.state = "pending"
  expect(
    projectPlanOccurrenceSyncIncidents({
      ...value.input,
      entries: [historic],
      outcomes: [],
    })
  ).toEqual([])
})

test("complete recurring overview retains appearance and root conflicts without treating the parent as occurrence", () => {
  const value = fixture()
  const operation = {
    operationId: crypto.randomUUID(),
    protocolVersion: 1 as const,
    baseRevision: 3,
    command: { type: "item.delete" as const, itemId: value.series.id },
  }
  const entry = outboxEntrySchema.parse({
    ...value.entry,
    operation,
    sequence: 2,
  })
  const remote = { ...value.series, revision: 4 }
  const outcome = {
    version: 2,
    kind: "item",
    key: `operation-outcome:${operation.operationId}`,
    operation,
    result: {
      kind: "item",
      outcome: {
        status: "conflict",
        operationId: operation.operationId,
        current: remote,
      },
    },
    local: value.series,
    base: null,
  }
  const input = {
    ...value.input,
    tags: [],
    itemViews: [],
    taskPlacements: [],
    entries: [value.entry, entry],
    outcomes: [value.outcome, outcome],
  }
  const before = structuredClone(input)
  const overview = projectRecurringSyncIncidentOverview(input)
  expect(overview.map((row) => row.kind)).toEqual(["plan-occurrence", "item"])
  expect(overview[0]?.incident.local).toEqual(value.local)
  expect(overview[1]?.incident.local).toEqual(value.series)
  expect(input).toEqual(before)
  const { occurrences: _occurrences, ...legacy } = input
  expect(() => projectSyncIncidentOverview(legacy)).toThrow()
  expect(() =>
    projectRecurringSyncIncidentOverview({
      ...input,
      occurrences: [{ ...value.local, seriesId: crypto.randomUUID() }],
    })
  ).toThrow()
  expect(() =>
    projectRecurringSyncIncidentOverview({
      ...input,
      outcomes: [...input.outcomes, outcome],
    })
  ).toThrow()
  expect(() =>
    projectRecurringSyncIncidentOverview({ ...input, userId: "foreign-owner" })
  ).toThrow()
  expect(() =>
    projectRecurringSyncIncidentOverview({
      ...input,
      items: Array(10001).fill(value.series),
    })
  ).toThrow()
  const html = renderToStaticMarkup(
    createElement(SyncIncidentPanel, { incidents: overview, error: false })
  )
  expect(html).toContain("Conflicto de aparición")
  expect(html).toContain("Tu estado actual")
  expect(html).toContain("Estado local al recibir el resultado")
  expect(html).toContain("Sin excepción guardada")
  expect(html).toContain(
    "La resolución desde esta pantalla aún no está disponible"
  )
  expect(html).not.toContain("Confirmar elección")
})
