import type { ReactNode } from "react"
import type { Tag } from "@/types/preferences"

export function TagCard({
  tag,
  busy,
  onEdit,
  onDelete,
  orderControl,
}: {
  tag: Tag
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  orderControl?: ReactNode
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <details className="group">
        <summary
          aria-label={`Opciones de categoría ${tag.name}`}
          className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"
        >
          <h3 className="flex min-w-0 items-center gap-2 wrap-anywhere text-sm font-semibold">
            <span
              aria-hidden="true"
              style={{ backgroundColor: tag.color }}
              className="h-4 w-4 shrink-0 rounded-full border border-zinc-400"
            />
            {tag.name}
          </h3>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-4 shrink-0 group-open:rotate-180"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          {orderControl}
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            aria-label={`Editar categoría ${tag.name}`}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label={`Eliminar categoría ${tag.name}`}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Eliminar
          </button>
        </div>
      </details>
    </article>
  )
}
