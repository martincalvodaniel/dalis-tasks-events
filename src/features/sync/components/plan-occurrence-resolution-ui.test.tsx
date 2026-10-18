import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanOccurrenceIncidentCard } from "@/features/sync/components/plan-occurrence-incident-card"
import { PlanOccurrenceResolutionDialog } from "@/features/sync/components/plan-occurrence-resolution-dialog"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import type { PlanOccurrenceResolutionRequest } from "@/types/plan-occurrence-resolution"

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
function comparison() {
  const value = fixture()
  const child = outboxEntrySchema.parse({
    ...value.entry,
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [value.entry.operation.operationId],
    operation: { ...value.entry.operation, operationId: crypto.randomUUID() },
  })
  const input = { ...value.input, entries: [value.entry, child] }
  const current = projectPlanOccurrenceSyncIncidents(input)[0]
  const request: PlanOccurrenceResolutionRequest = {
    userId: value.userId,
    resolutionId: crypto.randomUUID(),
    operationId: null,
    choice: "adopt_remote",
    createdAt: timestamp,
    expected: current,
  }
  return { value, input, current, request }
}

test("appearance choices stay scoped to the account and preserve guarded cases without actions", () => {
  const { current } = comparison(),
    account = { userId: current.entry.userId, epoch: crypto.randomUUID() }
  const html = renderToStaticMarkup(
    <PlanOccurrenceIncidentCard incident={current} account={account} />
  )
  expect(html).toContain("Usar aparición remota")
  expect(html).not.toContain("Enviar mi borrador")
  for (const incident of [
    current,
    { ...current, blockedByRelatedIntentions: true },
    { ...current, remote: null },
  ]) {
    const own = incident !== current
    const html = renderToStaticMarkup(
      <PlanOccurrenceIncidentCard
        incident={incident}
        account={own ? account : { ...account, userId: "another-owner" }}
      />
    )
    expect(html).not.toContain("Usar aparición remota")
    expect(html).toContain("se conservan")
  }
})
test("appearance confirmation shows the whole remote exception and explains the exact local decision", () => {
  const { current } = comparison()
  if (!current.remote) throw new Error("Appearance preview fixture missing")
  const incident = {
    ...current,
    remote: {
      ...current.remote,
      content: {
        title: "Remote appointment",
        description: "Full remote description",
      },
      schedule: {
        mode: "timed" as const,
        localStart: "2026-10-11T19:30",
        localEnd: "2026-10-11T20:45",
        timeZone: "Europe/Madrid",
      },
      cancelled: true,
      deletedAt: timestamp,
    },
  }
  const html = renderToStaticMarkup(
    <PlanOccurrenceResolutionDialog
      incident={incident}
      busy={false}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
  for (const text of [
    "Full remote description",
    "19:30",
    "20:45",
    "Europe/Madrid",
    "Aparición cancelada",
    "Aparición eliminada",
    "2",
    "cambios pendientes",
    "el historial se conserva",
    "No cambia la serie ni otros días",
    "no envía cambios al servidor",
    "última conocida",
    "Cancelar",
  ])
    expect(html).toContain(text)
  const allDay = renderToStaticMarkup(
    <PlanOccurrenceResolutionDialog
      incident={current}
      busy={false}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
  expect(allDay).toContain("2026-10-12")
  expect(allDay).toContain("sin incluir")
})
