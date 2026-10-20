import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import type { PlacementResolutionCatalog } from "@/types/placement-resolution"
import type { PlanVariant } from "@/types/plan-item"

export function placementGroupReviewFixture(
  scope: "day" | "overdue" = "day",
  variant: PlanVariant = "task",
  actor?: string
) {
  const simple = placementResolutionFixture(actor, variant, scope)
  const series = planSchema.parse({
    ...simple.items[1],
    id: crypto.randomUUID(),
    variant: "appointment",
    title: "Recurring peer",
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-17",
      timeZone: "Europe/Madrid",
      end: { type: "count", count: 3 },
    },
    schedule: {
      mode: "all_day",
      startDate: "2026-10-17",
      endDateExclusive: "2026-10-18",
    },
  })
  const generated = planOccurrencesPage(series, {
    startDate: "2026-10-17",
    endDate: "2026-10-18",
  }).occurrences
  const moved = {
    ...generated[0],
    revision: 2,
    schedule: {
      mode: "all_day" as const,
      startDate: "2026-10-18",
      endDateExclusive: "2026-10-19",
    },
  }
  const view = { ...simple.local.views[0], itemId: series.id }
  const placed = {
    ...simple.original[0],
    occurrenceId: moved.id,
    position: 3072,
    revision: 4,
  }
  function extend(
    catalog: PlacementResolutionCatalog
  ): PlacementResolutionCatalog {
    return {
      ...catalog,
      items: [...catalog.items, series],
      views: [...catalog.views, view],
      occurrences: [moved],
      placements: [...catalog.placements, placed],
    }
  }
  return {
    simple,
    series,
    moved,
    implicit: generated[1],
    input: {
      userId: simple.actor,
      operation: simple.entry.operation,
      local: extend(simple.local),
      observed: extend(simple.observed),
    },
  }
}
