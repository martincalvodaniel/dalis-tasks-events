export function EventActions({
  title,
  busy,
  onEdit,
  onDelete,
}: {
  title: string
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        aria-label={`Editar ${title}`}
        className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700"
      >
        Editar
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        aria-label={`Eliminar ${title}`}
        className="min-h-11 rounded-lg border border-red-300 px-3 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
      >
        Eliminar
      </button>
    </div>
  )
}
