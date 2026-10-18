import { compareRank } from "@/lib/ordering/rank"
import type { Tag } from "@/types/preferences"

export function TagOrderResolutionVersion({
  label,
  tags,
  primaryId,
}: {
  label: string
  tags: readonly Tag[]
  primaryId: string
}) {
  const active = tags.filter((tag) => !tag.deletedAt).toSorted(compareRank),
    deleted = tags.filter((tag) => tag.deletedAt).toSorted(compareRank)
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800"
    >
      <h3 className="font-semibold">{label}</h3>
      <ol
        className="mt-1 max-h-48 space-y-1 overflow-y-auto"
        aria-label={label}
      >
        {[...active, ...deleted].map((tag) => (
          <li
            key={tag.id}
            className={`flex min-w-0 flex-wrap items-center gap-x-1.5 rounded px-1 py-0.5 break-words [overflow-wrap:anywhere] ${tag.id === primaryId ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full border border-zinc-400"
              style={{ backgroundColor: tag.color }}
            />
            <span className={tag.deletedAt ? "line-through" : ""}>
              {tag.name}
            </span>
            {tag.deletedAt ? <span>Eliminada</span> : null}
            {tag.id === primaryId ? (
              <span className="font-medium">· En revisión</span>
            ) : null}
            <span className="text-zinc-500">· revisión {tag.revision}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
