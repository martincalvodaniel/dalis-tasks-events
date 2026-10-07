import { civilDateToUtc } from "@/lib/calendar/civil-date"
import type { Task } from "@/types/calendar-item"

const statusLabels = {
  not_started: "Sin empezar",
  in_progress: "En curso",
  completed: "Completada",
} as const
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
  timeZone: "UTC",
})

export function TaskCard({
  task,
  onEdit,
  onDelete,
  busy = false,
}: {
  task: Task
  onEdit?: () => void
  onDelete?: () => void
  busy?: boolean
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <time dateTime={task.scheduledDate}>
          {dateFormatter.format(civilDateToUtc(task.scheduledDate))}
        </time>{" "}
        · {statusLabels[task.status]}
      </p>
      <h3 className="mt-2 wrap-anywhere text-lg font-semibold">{task.title}</h3>
      {task.description ? (
        <p className="mt-3 whitespace-pre-wrap wrap-anywhere text-zinc-600 dark:text-zinc-300">
          {task.description}
        </p>
      ) : null}
      {task.checklist.length ? (
        <ul aria-label="Checklist" className="mt-4 space-y-2 text-sm">
          {task.checklist.map((entry) => (
            <li key={entry.id} className="wrap-anywhere">
              {entry.completed ? "✓ " : "○ "}
              {entry.text}
            </li>
          ))}
        </ul>
      ) : null}
      {onEdit || onDelete ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {onEdit ? (
            <button
              type="button"
              disabled={busy}
              onClick={onEdit}
              aria-label={`Editar ${task.title}`}
              className="min-h-12 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
            >
              Editar
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              aria-label={`Eliminar ${task.title}`}
              className="min-h-12 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
            >
              Eliminar
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
