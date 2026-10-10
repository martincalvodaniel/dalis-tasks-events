"use client"

import { ItemCompletionIcon } from "@/components/ui/item-completion-icon"
import type { Task } from "@/types/calendar-item"

export function TaskCompletionButton({
  task,
  busy,
  onChange,
  categoryColor,
}: {
  task: Task
  busy: boolean
  onChange: (status: Task["status"]) => void
  categoryColor?: string | null
}) {
  const completed = task.status === "completed"
  return (
    <button
      type="button"
      aria-pressed={completed}
      disabled={busy}
      aria-label={`${completed ? "Reabrir" : "Completar"} ${task.title}`}
      onClick={() => onChange(completed ? "not_started" : "completed")}
      className="absolute top-2 left-1 z-10 flex size-11 items-center justify-center rounded-lg text-zinc-600 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-zinc-300"
    >
      <ItemCompletionIcon
        variant="task"
        completed={completed}
        color={categoryColor}
      />
    </button>
  )
}
