import { compareRank } from "@/lib/ordering/rank"
import { placementDate } from "@/schemas/ordering"
import type { PlacementResolutionSnapshot } from "@/types/placement-resolution"
import type { TaskPlacement } from "@/types/preferences"
export function PlacementResolutionVersion({
  label,
  snapshot,
  placements,
}: {
  label: string
  snapshot: PlacementResolutionSnapshot
  placements: readonly TaskPlacement[]
}) {
  const command = snapshot.incident.entry.operation.command
  if (command.type !== "task.move") return null
  const items = new Map(snapshot.observed.items.map((item) => [item.id, item])),
    scoped = placements.filter(
      (record) =>
        record.scope === command.scope &&
        record.date === placementDate(command.scope, command.date) &&
        record.tagId === command.tagId
    ),
    active = scoped
      .filter((record) => !record.deletedAt)
      .toSorted((a, b) =>
        compareRank(
          { id: a.occurrenceId, position: a.position },
          { id: b.occurrenceId, position: b.position }
        )
      ),
    deleted = scoped.filter((record) => record.deletedAt)
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
        {[...active, ...deleted].map((record) => (
          <li
            key={record.occurrenceId}
            className={`rounded px-1 py-0.5 break-words [overflow-wrap:anywhere] ${record.occurrenceId === command.itemId ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
          >
            <span className={record.deletedAt ? "line-through" : ""}>
              {items.get(record.occurrenceId)?.title ??
                "Contenido no disponible"}
            </span>
            {record.deletedAt ? <span> · Posición eliminada</span> : null}
            {record.occurrenceId === command.itemId ? (
              <span className="font-medium"> · En revisión</span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
