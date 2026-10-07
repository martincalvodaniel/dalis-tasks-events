"use client"

import type { Task } from "@/types/calendar-item"

export function TaskStatusControls({
  task,
  busy,
  onChange,
}: {
  task: Task
  busy: boolean
  onChange: (status: Task["status"]) => void
}) {
  const buttonClass =
    "min-h-11 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300"
  return (
    <fieldset className="mt-3 flex flex-wrap gap-2">
      <legend className="sr-only">Estado de la tarea</legend>
      {task.status === "not_started" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange("in_progress")}
          aria-label={`Empezar ${task.title}`}
          className={buttonClass}
        >
          Empezar
        </button>
      ) : null}
      {task.status === "in_progress" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange("not_started")}
          aria-label={`Dejar sin empezar ${task.title}`}
          className={buttonClass}
        >
          Sin empezar
        </button>
      ) : null}
    </fieldset>
  )
}
