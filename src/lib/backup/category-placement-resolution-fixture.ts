import { planCategoryPlacementIncidentResolution } from "@/lib/sync/category-placement-decision"
import { categoryPlacementResolutionFixture } from "@/lib/sync/category-placement-resolution-fixture"
import { localRecurringBackupV3Schema } from "@/schemas/local-recurring-backup"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"

export function categoryPlacementResolutionBackupFixture(
  retry = true,
  slot: "simple" | "moved" | "implicit" = "simple",
  scope: "day" | "overdue" = "day"
) {
  const f = categoryPlacementResolutionFixture(slot, scope),
    actor = f.actor
  const request = {
    ...f.request,
    choice: retry ? "retry_latest_move" : "adopt_remote",
    operationId: retry ? f.request.operationId : null,
  }
  const record = planCategoryPlacementIncidentResolution(request, f.snapshot),
    observed = f.snapshot.observed
  const backup = localRecurringBackupV3Schema.parse({
    format: "dalis-local-backup",
    version: 3,
    protocolVersion: 1,
    databaseVersion: 2,
    userId: actor,
    exportedAt: f.now,
    stores: {
      items: structuredClone(observed.items),
      occurrences: structuredClone(observed.occurrences),
      tags: structuredClone(observed.tags),
      itemViews: structuredClone(
        observed.views.map((view) =>
          view.itemId === record.view.itemId ? record.view : view
        )
      ),
      taskPlacements: structuredClone(record.placements),
      settings: [],
      memberships: [],
      invitations: [],
      remoteShadows: [
        ...observed.tags.map((tag) => ({
          version: 2,
          kind: "preference",
          entityKey: `tag:${tag.id}`,
          record: { store: "tags", record: tag },
        })),
        ...observed.items.map((item) => ({
          version: 2,
          kind: "item",
          entityKey: `item:${item.id}`,
          record: item,
        })),
        ...observed.occurrences.map((occurrence) => ({
          version: 2,
          kind: "plan-occurrence",
          userId: actor,
          entityKey: `plan-occurrence:${occurrence.id}`,
          seriesRevision: observed.items.find(
            (item) => item.id === occurrence.seriesId
          )?.revision,
          record: occurrence,
        })),
        ...observed.views.map((view) => ({
          version: 2,
          kind: "preference",
          entityKey: `item-view:${view.itemId}`,
          record: { store: "itemViews", record: view },
        })),
        ...observed.placements.map((placement) => ({
          version: 2,
          kind: "preference",
          entityKey: taskPlacementEntityKey(
            placement.occurrenceId,
            placement.scope,
            placement.date
          ),
          record: { store: "taskPlacements", record: placement },
        })),
      ],
      outbox: [
        ...f.capture.entries.map((entry) => ({
          ...structuredClone(entry),
          state: "superseded",
          lease: null,
        })),
        ...(record.replacement
          ? [
              outboxEntrySchema.parse({
                userId: actor,
                entityKey: f.entry.entityKey,
                operation: record.replacement,
                sequence: 3,
                dependencies: [],
                state: "pending",
                attempts: 0,
                lease: null,
                createdAt: record.createdAt,
              }),
            ]
          : []),
      ],
      syncMetadata: [
        structuredClone(f.outcome),
        record,
        { key: "outbox-sequence", value: retry ? 3 : 2 },
      ],
    },
  })
  return { ...f, record, request, backup }
}
