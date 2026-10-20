import { civilDateToUtc } from "@/lib/calendar/civil-date"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import {
  reviewPlacementGroup,
  reviewRecurringPlacementGroup,
} from "@/lib/sync/placement-group-review"
import type { PlacementResolutionSnapshot } from "@/types/placement-resolution"
import type { TaskPlacement } from "@/types/preferences"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeZone: "UTC",
})
export function MixedPlacementResolutionVersion({
  label,
  snapshot,
  placements,
  reviewKind = "mixed_group",
}: {
  label: string
  snapshot: PlacementResolutionSnapshot
  placements: readonly TaskPlacement[]
  reviewKind?: "mixed_group" | "recurring_primary"
}) {
  const operation = snapshot.incident.entry.operation,
    command = operation.command
  if (command.type !== "task.move") return null
  const review = (
    reviewKind === "recurring_primary"
      ? reviewRecurringPlacementGroup
      : reviewPlacementGroup
  )({
    userId: snapshot.incident.entry.userId,
    operation,
    local: snapshot.local,
    observed: snapshot.observed,
  })
  const members = new Set(review.members.map((member) => member.id)),
    scoped = placements.filter(
      (record) =>
        record.scope === review.scope && record.date === review.placementDate
    ),
    positions = new Map(
      scoped
        .filter((record) => record.tagId === review.tagId)
        .map((record) => [record.occurrenceId, record])
    ),
    exceptions = new Map(
      snapshot.observed.occurrences.map((record) => [record.id, record])
    ),
    ordered = orderPlacedTasks(
      recurringMovementCatalog(
        snapshot.observed.items,
        snapshot.observed.occurrences,
        review.userId,
        command
      ).filter((member) => members.has(member.id)),
      scoped,
      review.tagId,
      compareRecurringMovementItems
    )
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800"
    >
      <h3 className="font-semibold">{label}</h3>
      <ol
        aria-label={label}
        className="mt-1 max-h-48 list-inside list-decimal space-y-1 overflow-y-auto"
      >
        {ordered.map((member) => {
          const originalSlot = member.parent.recurrence
              ? member.id.slice(member.parent.id.length + 1)
              : null,
            position = positions.get(member.id),
            title =
              exceptions.get(member.id)?.content?.title ?? member.parent.title
          return (
            <li
              key={member.id}
              className={`rounded px-1 py-0.5 break-words [overflow-wrap:anywhere] ${member.id === (command.occurrenceId ?? command.itemId) ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
            >
              <span>{title}</span>
              <span>
                {" "}
                · {dayFormatter.format(civilDateToUtc(member.scheduledDate))}
                {member.start.includes("T")
                  ? ` · ${member.start.slice(11, 16)}`
                  : ""}
              </span>
              {originalSlot ? (
                <span>
                  {" "}
                  · Repetición
                  {originalSlot !== member.start
                    ? ` del ${dayFormatter.format(civilDateToUtc(originalSlot.slice(0, 10)))}${originalSlot.includes("T") ? ` · ${originalSlot.slice(11, 16)}` : ""}`
                    : ""}
                </span>
              ) : null}
              {!position || position.deletedAt ? (
                <span> · Sin posición manual</span>
              ) : null}
              {member.id === (command.occurrenceId ?? command.itemId) ? (
                <span className="font-medium"> · En revisión</span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
