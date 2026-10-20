import { recurringPlacementResolutionFixture } from "@/lib/sync/recurring-placement-resolution-fixture"
import { tagSchema } from "@/schemas/preferences"
import type { PlacementResolutionCatalog } from "@/types/placement-resolution"
import type { PlanVariant } from "@/types/plan-item"

export function categoryPlacementReviewFixture(
  primary: "simple" | "moved" | "implicit" = "simple",
  scope: "day" | "overdue" = "day",
  variant: PlanVariant = "note",
  uncategorized: "none" | "source" | "destination" = "none"
) {
  const f = recurringPlacementResolutionFixture(
      primary === "implicit" ? "implicit" : "moved",
      scope,
      variant
    ),
    actor = f.simple.actor,
    now = f.simple.now
  const tags = ["Source", "Destination", "Historical"].map((name, index) =>
    tagSchema.parse({
      id: crypto.randomUUID(),
      userId: actor,
      name,
      normalizedName: name.toLowerCase(),
      color: ["#123456", "#abcdef", "#654321"][index],
      position: index * 1024,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  )
  const sourceId = uncategorized === "source" ? null : tags[0].id,
    destinationId = uncategorized === "destination" ? null : tags[1].id,
    parentId = primary === "simple" ? f.simple.items[0].id : f.series.id,
    targetId = primary === "simple" ? parentId : f.targetId,
    destinationPeerId = f.simple.items[2].id
  const originalCommand = f.entry.operation.command
  if (originalCommand.type !== "task.move")
    throw new Error("Category fixture requires a movement")
  const operation = {
    ...f.entry.operation,
    command: {
      ...originalCommand,
      itemId: parentId,
      occurrenceId: primary === "simple" ? null : targetId,
      tagId: destinationId,
      beforeId: destinationPeerId,
      afterId: null,
    },
  }
  if (operation.command.type !== "task.move")
    throw new Error("Category fixture requires a movement")
  const observed: PlacementResolutionCatalog = {
    ...f.capture.observed,
    tags,
    items: f.capture.observed.items.map((item) =>
      item.id === parentId && item.kind === "plan" ? { ...item, variant } : item
    ),
    views: f.capture.observed.views.map((view) => ({
      ...view,
      primaryTagId:
        view.itemId === destinationPeerId ? destinationId : sourceId,
    })),
    placements: f.capture.observed.placements.map((record) => ({
      ...record,
      tagId:
        record.occurrenceId === destinationPeerId ? destinationId : sourceId,
      revision:
        record.occurrenceId === targetId
          ? Math.max(2, record.revision)
          : record.revision,
    })),
  }
  const local: PlacementResolutionCatalog = {
    ...observed,
    views: observed.views.map((view) =>
      view.itemId === parentId ? { ...view, primaryTagId: destinationId } : view
    ),
    placements: observed.placements.map((record) =>
      record.occurrenceId === targetId
        ? {
            ...record,
            revision: record.revision - 1,
            tagId: destinationId,
            position: 8192,
          }
        : record
    ),
  }
  return {
    f,
    actor,
    now,
    tags,
    parentId,
    targetId,
    sourceId,
    destinationId,
    destinationPeerId,
    input: {
      userId: actor,
      operation,
      local: structuredClone(local),
      observed: structuredClone(observed),
    },
  }
}
