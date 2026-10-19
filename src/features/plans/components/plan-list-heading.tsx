"use client"

export function PlanListHeading({
  heading,
  contentId,
  expanded,
  count,
  partial = false,
  onToggle,
}: {
  heading: string
  contentId: string
  expanded: boolean
  count: number | null
  partial?: boolean
  onToggle?: () => void
}) {
  if (!onToggle)
    return (
      <h2 className="text-base font-semibold first-letter:uppercase sm:text-xl">
        {heading}
      </h2>
    )
  return (
    <h2 className="text-base font-semibold sm:text-xl">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        className="flex min-h-9 w-full items-center gap-2 rounded py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`size-3.5 shrink-0 text-zinc-500 ${expanded ? "" : "-rotate-90"}`}
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
        <span>{heading}</span>
        {count !== null ? (
          <span
            title={
              partial
                ? "Recuento parcial de planes cargados"
                : "Total de planes"
            }
            className="rounded-full bg-zinc-100 px-1.5 text-xs font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <span aria-hidden="true">
              {count}
              {partial ? "+" : ""}
            </span>
            <span className="sr-only">
              {partial
                ? `Al menos ${count} ${count === 1 ? "plan" : "planes"}; recuento parcial`
                : `${count} ${count === 1 ? "plan" : "planes"}`}
            </span>
          </span>
        ) : null}
      </button>
    </h2>
  )
}
