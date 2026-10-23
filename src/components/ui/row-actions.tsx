"use client"

export function RowActions({
  onEdit,
  onDelete,
  busy = false,
  editLabel,
  deleteLabel,
}: {
  onEdit?: () => void
  onDelete?: () => void
  busy?: boolean
  editLabel: string
  deleteLabel: string
}) {
  return onEdit || onDelete ? (
    <div className="flex shrink-0">
      {onEdit ? (
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          aria-label={editLabel}
          title={editLabel}
          className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m16 3 5 5M4 20l4-1L21 6a2 2 0 0 0-4-4L4 15z" />
          </svg>
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="flex size-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50 dark:text-red-400 dark:hover:bg-zinc-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="size-4"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  ) : null
}
