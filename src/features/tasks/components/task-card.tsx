"use client"

import type { ReactNode } from "react"
import { TaskChecklist } from "@/features/tasks/components/task-checklist"
import { TaskCompletionButton } from "@/features/tasks/components/task-completion-button"
import { TaskStatusControls } from "@/features/tasks/components/task-status-controls"
import { civilDateToUtc } from "@/lib/calendar/civil-date"
import type { Task } from "@/types/calendar-item"

const statusLabels = {
  not_started: "Sin empezar",
  in_progress: "En curso",
  completed: "Completada",
} as const
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onChecklistChange,
  categoryControl,
  orderControl,
  expanded = false,
  onExpandedChange,
  busy = false,
}: {
  task: Task
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange?: (status: Task["status"]) => void
  onChecklistChange?: (entryId: string, completed: boolean) => void
  categoryControl?: ReactNode
  orderControl?: ReactNode
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  busy?: boolean
}) {
  return (
    <article className="relative min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {onStatusChange ? (
        <TaskCompletionButton
          task={task}
          busy={busy}
          onChange={onStatusChange}
        />
      ) : null}
      <details
        open={expanded}
        onToggle={(event) => onExpandedChange?.(event.currentTarget.open)}
      >
        <summary
          aria-label={`Detalles de ${task.title}`}
          className={`relative flex min-h-16 cursor-pointer list-none flex-col justify-center gap-0.5 rounded-xl py-2 pr-10 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden ${onStatusChange ? "pl-12" : "pl-3"}`}
        >
          <h4 className="wrap-anywhere text-sm font-semibold sm:text-base">
            {task.title}
          </h4>
          <p className="wrap-anywhere text-xs text-zinc-500 dark:text-zinc-400">
            <time dateTime={task.scheduledDate}>
              {dateFormatter.format(civilDateToUtc(task.scheduledDate))}
            </time>{" "}
            · {statusLabels[task.status]}
            {task.checklist.length
              ? ` · ${task.checklist.filter((entry) => entry.completed).length}/${task.checklist.length}`
              : ""}
          </p>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`absolute top-5 right-3 size-4 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="border-t border-zinc-200 px-3 pb-3 dark:border-zinc-800">
          {task.description ? (
            <p className="mt-3 text-sm whitespace-pre-wrap wrap-anywhere text-zinc-600 dark:text-zinc-300">
              {task.description}
            </p>
          ) : null}
          {categoryControl}
          {onStatusChange ? (
            <TaskStatusControls
              task={task}
              busy={busy}
              onChange={onStatusChange}
            />
          ) : null}
          {onEdit || onDelete ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {onEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onEdit}
                  aria-label={`Editar ${task.title}`}
                  className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
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
                  className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
                >
                  Eliminar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
      {orderControl}
      <div className="px-3">
        {task.checklist.length ? (
          <TaskChecklist
            entries={task.checklist}
            busy={busy}
            onChange={onChecklistChange}
          />
        ) : null}
      </div>
    </article>
  )
}
