"use client"

export function ItemEditorHeader({
  title,
  saving,
  onCancel,
}: {
  title: string
  saving: boolean
  onCancel: () => void
}) {
  return (
    <header className="sticky top-0 z-10 -mx-3 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 bg-white px-3 py-1 dark:bg-zinc-900">
      <button
        type="button"
        aria-label="Cancelar"
        title="Cancelar"
        disabled={saving}
        onClick={onCancel}
        className="flex size-11 items-center justify-center rounded-full disabled:opacity-50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-6"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <p className="text-center text-sm font-medium">{title}</p>
      <button
        type="submit"
        aria-label={saving ? "Guardando…" : "Guardar"}
        title={saving ? "Guardando…" : "Guardar"}
        disabled={saving}
        className="flex size-11 items-center justify-center rounded-full text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-6"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </button>
      {saving ? (
        <span role="status" className="sr-only">
          Guardando…
        </span>
      ) : null}
    </header>
  )
}
