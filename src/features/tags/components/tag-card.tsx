import type { Tag } from "@/types/preferences"

export function TagCard({
  tag,
  busy,
  onEdit,
  onDelete,
}: {
  tag: Tag
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="flex items-center gap-3 wrap-anywhere font-semibold">
        <span
          aria-hidden="true"
          style={{ backgroundColor: tag.color }}
          className="h-4 w-4 shrink-0 rounded-full border border-zinc-400"
        />
        {tag.name}
      </h3>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          aria-label={`Editar categoría ${tag.name}`}
          className="min-h-12 rounded-xl border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-700"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          aria-label={`Eliminar categoría ${tag.name}`}
          className="min-h-12 rounded-xl border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-700"
        >
          Eliminar
        </button>
      </div>
    </article>
  )
}
