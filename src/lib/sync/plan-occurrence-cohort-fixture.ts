import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import {
  localPlanOccurrenceOutcomeSchema,
  remotePlanOccurrenceShadowSchema,
} from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"

export function planOccurrenceCohortFixture() {
  const userId = "cohort-comparison-owner",
    id = crypto.randomUUID(),
    now = "2026-10-19T16:00:00.000Z"
  const series = planSchema.parse({
    kind: "plan",
    variant: "note",
    id,
    ownerId: userId,
    title: "Reviewed series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-18",
      endDateExclusive: "2026-10-19",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-18",
      timeZone: "Europe/Madrid",
      end: { type: "count", count: 3 },
    },
    revision: 3,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const root = outboxEntrySchema.parse({
    userId,
    entityKey: `item:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-18`,
        expectedOccurrenceRevision: 1,
        status: "in_progress",
      },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: now,
  })
  const second = outboxEntrySchema.parse({
    ...root,
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [root.operation.operationId],
    operation: {
      ...root.operation,
      operationId: crypto.randomUUID(),
      command: {
        ...root.operation.command,
        occurrenceId: `${id}:2026-10-19`,
        expectedOccurrenceRevision: 2,
      },
    },
  })
  const third = outboxEntrySchema.parse({
    ...root,
    state: "pending",
    attempts: 0,
    sequence: 3,
    dependencies: [second.operation.operationId],
    operation: {
      ...root.operation,
      operationId: crypto.randomUUID(),
      command: { ...root.operation.command, status: "completed" },
    },
  })
  const generated = planOccurrencesPage(series, {
    startDate: "2026-10-18",
    endDate: "2026-10-19",
  }).occurrences
  const remote = generated.map((record, index) => ({
    ...record,
    revision: index === 0 ? 9 : 2,
  }))
  const occurrences = [
    applyPlanOccurrenceCommand(
      series,
      remote[0],
      {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: remote[0].id,
        status: "completed",
      },
      userId,
      now
    ),
    applyPlanOccurrenceCommand(
      series,
      remote[1],
      {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: remote[1].id,
        status: "in_progress",
      },
      userId,
      now
    ),
  ]
  const outcome = localPlanOccurrenceOutcomeSchema.parse({
    version: 2,
    kind: "plan-occurrence",
    key: `operation-outcome:${root.operation.operationId}`,
    operation: root.operation,
    result: {
      kind: "plan-occurrence",
      userId,
      outcome: {
        status: "conflict",
        operationId: root.operation.operationId,
        series,
        current: remote[0],
      },
    },
    local: occurrences[0],
    base: null,
    series,
  })
  const shadows = remote.map((record) =>
    remotePlanOccurrenceShadowSchema.parse({
      version: 2,
      kind: "plan-occurrence",
      userId,
      entityKey: `plan-occurrence:${record.id}`,
      seriesRevision: series.revision,
      record,
    })
  )
  return {
    userId,
    operationId: root.operation.operationId,
    series,
    entries: [root, second, third],
    occurrences,
    shadows,
    outcomes: [outcome],
  }
}
