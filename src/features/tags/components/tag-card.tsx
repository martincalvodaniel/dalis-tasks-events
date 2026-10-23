import type { ReactNode } from "react"
import { RowActions } from "@/components/ui/row-actions"
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
      <div className="flex min-h-12 items-center gap-2 pl-3">
        <h3 className="flex min-w-0 flex-1 items-center gap-2 py-1.5 wrap-anywhere text-sm font-semibold">
          <span
            aria-hidden="true"
            style={{ backgroundColor: tag.color }}
            className="size-4 shrink-0 rounded-full border border-zinc-400"
          />
          <span className="min-w-0 wrap-anywhere">{tag.name}</span>
        </h3>
        <RowActions
          busy={busy}
          onEdit={onEdit}
          onDelete={onDelete}
          editLabel={`Editar categoría ${tag.name}`}
          deleteLabel={`Eliminar categoría ${tag.name}`}
        />
      </div>
      {orderControl}
    </article>
  )
}
