import { recurringMovementCatalog } from "@/lib/preferences/recurring-movement-catalog"
import { categoryPlacementReviewFixture } from "@/lib/sync/category-placement-review-fixture"
import { captureCategoryPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { categoryPlacementResolutionRequestSchema } from "@/schemas/category-placement-resolution"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"

export function categoryPlacementResolutionFixture(
  primary: "simple" | "moved" | "implicit" = "simple",
  scope: "day" | "overdue" = "day",
  knownPositions = true,
  actorInput?: string
) {
  const f = categoryPlacementReviewFixture(
      primary,
      scope,
      "note",
      "none",
      actorInput
    ),
    local = structuredClone(f.input.local),
    observed = structuredClone(f.input.observed)
  if (knownPositions) {
    const visible = recurringMovementCatalog(
        observed.items,
        observed.occurrences,
        f.actor,
        f.input.operation.command
      ),
      sample = observed.placements[0]
    for (const [index, member] of visible.entries())
      if (
        !observed.placements.some((record) => record.occurrenceId === member.id)
      ) {
        const view = observed.views.find(
          (view) => view.itemId === member.parent.id
        )
        if (!view) throw new Error("Fixture visible assignment missing")
        const record = {
          ...sample,
          occurrenceId: member.id,
          position: 1024 * (index + 5),
          tagId: view.primaryTagId,
          revision: 1,
        }
        observed.placements.push(record)
        local.placements.push(structuredClone(record))
      }
  }
  const key = taskPlacementEntityKey(
      f.targetId,
      scope,
      f.input.operation.command.date
    ),
    known = observed.placements.find(
      (record) => record.occurrenceId === f.targetId
    ),
    current = local.placements.find(
      (record) => record.occurrenceId === f.targetId
    )
  if (!known || !current)
    throw new Error("Category resolution fixture primary missing")
  const entry = outboxEntrySchema.parse({
      ...f.f.entry,
      entityKey: key,
      operation: { ...f.input.operation, baseRevision: known.revision - 1 },
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
          ...f.input.operation.command,
          beforeId: f.destinationPeerId,
          afterId: null,
        },
      },
    })
  const outcome = localPreferenceOutcomeV2Schema.parse({
    ...f.f.outcome,
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
      { entityKey: key, record: { store: "taskPlacements", record: current } },
    ],
    base: [
      {
        entityKey: key,
        record: {
          store: "taskPlacements",
          record: { ...known, revision: known.revision - 1 },
        },
      },
    ],
  })
  const input = {
    userId: f.actor,
    items: local.items,
    occurrences: local.occurrences,
    tags: local.tags,
    settings: [],
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
  }
  const projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Category fixture incident missing")
  const capture = {
      userId: f.actor,
      incident: projected.incident,
      entries: input.entries,
      local,
      observed,
    },
    snapshot = captureCategoryPlacementResolutionSnapshot(capture),
    request = categoryPlacementResolutionRequestSchema.parse({
      reviewKind: "category_movement",
      userId: f.actor,
      resolutionId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      choice: "retry_latest_move",
      createdAt: f.now,
      expected: snapshot,
    })
  return {
    ...f,
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
