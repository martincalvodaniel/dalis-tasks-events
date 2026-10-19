import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { capturePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { placementDate, taskPlacementEntityKey } from "@/schemas/ordering"
import { planSchema } from "@/schemas/plan-item"
import type { PlanVariant } from "@/types/plan-item"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { TaskPlacement } from "@/types/preferences"

export function placementResolutionFixture(
  actor = "placement-recovery-owner",
  variant: PlanVariant = "task",
  scope: "day" | "overdue" = "day"
) {
  const now = "2026-10-19T01:25:00.000Z",
    date = scope === "day" ? "2026-10-18" : "2026-10-19",
    items = [0, 1, 2].map((index) =>
      planSchema.parse({
        kind: "plan",
        variant,
        id: crypto.randomUUID(),
        ownerId: actor,
        title: `Plan ${index}`,
        description: "Preserved content",
        schedule: {
          mode: "all_day",
          startDate: "2026-10-18",
          endDateExclusive: "2026-10-19",
        },
        status: "in_progress",
        checklist: [],
        completedAt: null,
        recurrence: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
    ),
    views = items.map((item) => ({
      userId: actor,
      itemId: item.id,
      primaryTagId: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })),
    original: TaskPlacement[] = items.map((item, index) => ({
      userId: actor,
      occurrenceId: item.id,
      scope,
      date: placementDate(scope, date),
      tagId: null,
      position: index * 1024,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })),
    command = {
      type: "task.move" as const,
      itemId: items[0].id,
      occurrenceId: null,
      scope,
      date,
      tagId: null,
      beforeId: items[1].id,
      afterId: null,
    },
    key = taskPlacementEntityKey(items[0].id, scope, date),
    entry = outboxEntrySchema.parse({
      userId: actor,
      entityKey: key,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 1,
        command,
      },
      state: "conflict",
      attempts: 1,
      lease: null,
      sequence: 1,
      dependencies: [],
      createdAt: now,
    }),
    child = outboxEntrySchema.parse({
      ...entry,
      state: "pending",
      attempts: 0,
      sequence: 2,
      dependencies: [entry.operation.operationId],
      operation: {
        ...entry.operation,
        operationId: crypto.randomUUID(),
        command: { ...command, beforeId: null, afterId: items[2].id },
      },
    }),
    base = { items, occurrences: [], tags: [], views, placements: original },
    observedPlan = planRemoteRecurringTaskPlacementOperation(
      {
        userId: actor,
        timestamp: now,
        ...base,
        operation: {
          ...entry.operation,
          operationId: crypto.randomUUID(),
          command: { ...command, beforeId: items[2].id, afterId: items[1].id },
        },
      },
      false
    ),
    localPlan = planRemoteRecurringTaskPlacementOperation(
      { userId: actor, timestamp: now, ...base, operation: child.operation },
      false
    )
  if (observedPlan.status !== "changes" || localPlan.status !== "changes")
    throw new Error("Placement fixture planner failed")
  function apply(
    effects: PreferenceEffect[],
    optimistic = false
  ): TaskPlacement[] {
    const changes = new Map<string, TaskPlacement>(
      effects.flatMap((effect) =>
        effect.store === "taskPlacements"
          ? [
              [
                effect.record.occurrenceId,
                {
                  ...effect.record,
                  revision: effect.record.revision - Number(optimistic),
                },
              ] as const,
            ]
          : []
      )
    )
    return original.map((record) => changes.get(record.occurrenceId) ?? record)
  }
  const local = { ...base, placements: apply(localPlan.effects, true) },
    observed = { ...base, placements: apply(observedPlan.effects) },
    outcome = localPreferenceOutcomeV2Schema.parse({
      version: 2,
      kind: "preference",
      key: `operation-outcome:${entry.operation.operationId}`,
      operation: entry.operation,
      result: {
        kind: "preference",
        outcome: {
          status: "conflict",
          operationId: entry.operation.operationId,
          current: { store: "taskPlacements", record: observed.placements[0] },
        },
      },
      local: [
        {
          entityKey: key,
          record: { store: "taskPlacements", record: local.placements[0] },
        },
      ],
      base: [
        {
          entityKey: key,
          record: { store: "taskPlacements", record: original[0] },
        },
      ],
    }),
    input = {
      userId: actor,
      items,
      occurrences: [],
      tags: [],
      itemViews: views,
      taskPlacements: local.placements,
      settings: [],
      entries: [entry, child],
      outcomes: [outcome],
      shadows: observed.placements.map((record) => ({
        version: 2 as const,
        kind: "preference" as const,
        entityKey: taskPlacementEntityKey(
          record.occurrenceId,
          record.scope,
          record.date
        ),
        record: { store: "taskPlacements" as const, record },
      })),
    },
    projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Placement fixture incident is missing")
  const capture = {
      userId: actor,
      incident: projected.incident,
      entries: input.entries,
      local,
      observed,
    },
    snapshot = capturePlacementResolutionSnapshot(capture)
  return {
    actor,
    now,
    date,
    items,
    original,
    entry,
    child,
    outcome,
    input,
    capture,
    snapshot,
    local,
    observed,
  }
}
