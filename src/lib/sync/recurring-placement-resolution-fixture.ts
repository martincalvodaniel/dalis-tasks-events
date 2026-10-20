import { placementGroupReviewFixture } from "@/lib/sync/placement-group-review-fixture"
import { captureRecurringPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { recurringPlacementResolutionRequestSchema } from "@/schemas/recurring-placement-resolution"
import type { PlanVariant } from "@/types/plan-item"

export function recurringPlacementResolutionFixture(
  slot: "moved" | "implicit" = "moved",
  scope: "day" | "overdue" = "day",
  variant: PlanVariant = "appointment",
  actor = "recurring-placement-owner"
) {
  const f = placementGroupReviewFixture(scope, "task", actor),
    series = { ...f.series, variant },
    targetId = slot === "moved" ? f.moved.id : f.implicit.id,
    known =
      slot === "moved"
        ? f.input.observed.placements.find(
            (record) => record.occurrenceId === targetId
          )
        : {
            ...f.input.observed.placements[0],
            occurrenceId: targetId,
            revision: 7,
            position: 4096,
          }
  if (!known) throw new Error("Recurring placement fixture primary missing")
  const observed = {
      ...f.input.observed,
      items: f.input.observed.items.map((item) =>
        item.id === series.id ? series : item
      ),
      placements:
        slot === "moved"
          ? f.input.observed.placements
          : [...f.input.observed.placements, known],
    },
    local = {
      ...observed,
      placements: observed.placements.map((record) =>
        record.occurrenceId === targetId
          ? { ...record, revision: known.revision - 1, position: 1792 }
          : record
      ),
    },
    entityKey = taskPlacementEntityKey(targetId, scope, f.simple.date),
    entry = outboxEntrySchema.parse({
      ...f.simple.entry,
      entityKey,
      operation: {
        ...f.simple.entry.operation,
        baseRevision: known.revision - 1,
        command: {
          ...f.simple.entry.operation.command,
          itemId: series.id,
          occurrenceId: targetId,
        },
      },
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
        command: {
          ...entry.operation.command,
          beforeId: f.simple.items[2].id,
          afterId: f.simple.items[0].id,
        },
      },
    }),
    outcome = localPreferenceOutcomeV2Schema.parse({
      ...f.simple.outcome,
      key: `operation-outcome:${entry.operation.operationId}`,
      operation: entry.operation,
      result: {
        kind: "preference",
        outcome: {
          status: "conflict",
          operationId: entry.operation.operationId,
          current: { store: "taskPlacements", record: known },
        },
      },
      local: [
        {
          entityKey,
          record: {
            store: "taskPlacements",
            record: local.placements.find(
              (record) => record.occurrenceId === targetId
            ),
          },
        },
      ],
      base: [
        {
          entityKey,
          record: {
            store: "taskPlacements",
            record: { ...known, revision: known.revision - 1, position: 8192 },
          },
        },
      ],
    }),
    input = {
      ...f.simple.input,
      items: local.items,
      occurrences: local.occurrences,
      itemViews: local.views,
      taskPlacements: local.placements,
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
    throw new Error("Recurring primary incident missing")
  const capture = {
    userId: actor,
    incident: projected.incident,
    entries: input.entries,
    local,
    observed,
  }
  const snapshot = captureRecurringPlacementResolutionSnapshot(capture),
    request = recurringPlacementResolutionRequestSchema.parse({
      reviewKind: "recurring_primary",
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      choice: "retry_latest_move",
      createdAt: f.simple.now,
      expected: snapshot,
    })
  return {
    ...f,
    series,
    targetId,
    known,
    entry,
    child,
    outcome,
    input,
    capture,
    snapshot,
    request,
  }
}
