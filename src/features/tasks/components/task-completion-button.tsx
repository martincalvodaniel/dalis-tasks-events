"use client"

import type { Task } from "@/types/calendar-item"

export function TaskCompletionButton({
  task,
  busy,
  onChange,
}: {
  task: Task
  busy: boolean
  onChange: (status: Task["status"]) => void
}) {
  const completed = task.status === "completed"
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`${completed ? "Reabrir" : "Completar"} ${task.title}`}
      onClick={() => onChange(completed ? "not_started" : "completed")}
      className="absolute top-2 left-1 z-10 flex size-11 items-center justify-center rounded-lg text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-emerald-300"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="size-5"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        {completed ? <path d="m7 12 3 3 7-7" /> : null}
      </svg>
    </button>
  )
}
