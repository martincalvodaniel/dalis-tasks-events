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

export function TaskCard({ task }: { task: Task }) {
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
    </article>
  )
}
