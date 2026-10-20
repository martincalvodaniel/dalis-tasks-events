import { placementGroupReviewFixture } from "@/lib/sync/placement-group-review-fixture"
import { captureMixedPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { mixedPlacementResolutionRequestSchema } from "@/schemas/mixed-placement-resolution"

export function mixedPlacementDecisionFixture(
  actor = "mixed-placement-owner",
  scope: "day" | "overdue" = "day"
) {
  const f = placementGroupReviewFixture(scope, "task", actor)
  const local = {
    ...f.input.local,
    placements: f.input.local.placements.map((record) =>
      record.occurrenceId === f.simple.items[0].id
        ? { ...record, position: 2560 }
        : record
    ),
  }
  const child = {
    ...f.simple.child,
    operation: {
      ...f.simple.child.operation,
      command: {
        ...f.simple.child.operation.command,
        beforeId: f.moved.id,
        afterId: f.simple.items[2].id,
      },
    },
  }
  const input = {
    ...f.simple.input,
    items: local.items,
    occurrences: local.occurrences,
    itemViews: local.views,
    taskPlacements: local.placements,
    entries: [f.simple.entry, child],
  }
  const found = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (found.kind !== "preference")
    throw new Error("Mixed placement fixture incident missing")
  const capture = {
    userId: actor,
    incident: found.incident,
    entries: input.entries,
    local,
    observed: f.input.observed,
  }
  const snapshot = captureMixedPlacementResolutionSnapshot(capture)
  const request = mixedPlacementResolutionRequestSchema.parse({
    reviewKind: "mixed_group",
    userId: actor,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    choice: "retry_latest_move",
    createdAt: f.simple.now,
    expected: snapshot,
  })
  return { ...f, child, input, capture, snapshot, request }
}
