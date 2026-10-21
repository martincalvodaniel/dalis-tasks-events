import { civilDateToUtc } from "@/lib/calendar/civil-date"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import type { CategoryPlacementReview } from "@/types/category-placement-review"
import type {
  PlacementResolutionCatalog,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeZone: "UTC",
})
export function CategoryPlacementResolutionVersion({
  label,
  snapshot,
  review,
  catalog,
}: {
  label: string
  snapshot: PlacementResolutionSnapshot
  review: CategoryPlacementReview
  catalog: PlacementResolutionCatalog
}) {
  const command = snapshot.incident.entry.operation.command
  if (command.type !== "task.move") return null
  const visible = recurringMovementCatalog(
      catalog.items,
      catalog.occurrences,
      review.userId,
      command
    ),
    members = new Set(review.members.map((member) => member.id)),
    views = new Map(
      catalog.views.map((view) => [view.itemId, view.primaryTagId])
    ),
    exceptions = new Map(
      catalog.occurrences.map((record) => [record.id, record])
    ),
    scoped = catalog.placements.filter(
      (record) =>
        record.scope === review.scope && record.date === review.placementDate
    )
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800"
    >
      <h3 className="font-semibold">{label}</h3>
      {review.groups.map((group) => {
        const tag = catalog.tags.find((tag) => tag.id === group.tagId),
          ordered = orderPlacedTasks(
            visible.filter(
              (member) =>
                members.has(member.id) &&
                views.get(member.parent.id) === group.tagId
            ),
            scoped,
            group.tagId,
            compareRecurringMovementItems
          )
        const manualPositions = new Set(
          scoped
            .filter(
              (record) => !record.deletedAt && record.tagId === group.tagId
            )
            .map((record) => record.occurrenceId)
        )
        return (
          <div key={group.tagId ?? "uncategorized"} className="mt-2">
            <h4 className="flex items-center gap-1.5 font-medium">
              {tag ? (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              ) : null}
              {tag?.name ?? "Sin categoría"}
            </h4>
            {ordered.length ? (
              <ol
                aria-label={`${label}: ${tag?.name ?? "Sin categoría"}`}
                className="mt-1 max-h-40 list-inside list-decimal space-y-1 overflow-y-auto"
              >
                {ordered.map((member) => {
                  const original = member.parent.recurrence
                    ? member.id.slice(member.parent.id.length + 1)
                    : null
                  return (
                    <li
                      key={member.id}
                      className={`rounded px-1 py-0.5 break-words [overflow-wrap:anywhere] ${member.id === review.primaryId ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
                    >
                      <span>
                        {exceptions.get(member.id)?.content?.title ??
                          member.parent.title}
                      </span>
                      <span>
                        {" "}
                        ·{" "}
                        {dayFormatter.format(
                          civilDateToUtc(member.scheduledDate)
                        )}
                        {member.start.includes("T")
                          ? ` · ${member.start.slice(11, 16)}`
                          : ""}
                      </span>
                      {original ? (
                        <span>
                          {" "}
                          · Repetición
                          {original !== member.start
                            ? ` del ${dayFormatter.format(civilDateToUtc(original.slice(0, 10)))}${original.includes("T") ? ` · ${original.slice(11, 16)}` : ""}`
                            : ""}
                        </span>
                      ) : null}
                      {!manualPositions.has(member.id) ? (
                        <span> · Sin posición manual</span>
                      ) : null}
                      {member.id === review.primaryId ? (
                        <span className="font-medium"> · En revisión</span>
                      ) : member.parent.id === review.parentId ? (
                        <span> · Mismo plan</span>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="mt-1 text-zinc-500">Sin planes en este grupo.</p>
            )}
          </div>
        )
      })}
    </section>
  )
}
