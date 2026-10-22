"use client"

import type { ReactNode } from "react"
import { PlanCompletionButton } from "@/features/plans/components/plan-completion-button"
import { TaskChecklist } from "@/features/tasks/components/task-checklist"
import { civilDateToUtc } from "@/lib/calendar/civil-date"
import { planDueDate, planStartDate } from "@/lib/calendar/plan-selection"
import type { Plan } from "@/types/plan-item"

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const statusLabels = {
  not_started: "Sin empezar",
  in_progress: "En progreso",
  completed: "Completado",
}

export function PlanCard({
  plan,
  categoryColor,
  orderControl,
  onEdit,
  onDelete,
  onStatusChange,
  onChecklistChange,
  busy = false,
  editLabel = "Editar",
  deleteLabel = "Eliminar",
  contextLabel,
}: {
  plan: Plan
  categoryColor?: string | null
  orderControl?: ReactNode
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange?: (status: Plan["status"]) => void
  onChecklistChange?: (entryId: string, completed: boolean) => void
  editLabel?: string
  deleteLabel?: string
  contextLabel?: string
  busy?: boolean
}) {
  const start = planStartDate(plan)
  const end = planDueDate(plan)
  return (
    <article className="relative min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <PlanCompletionButton
        plan={plan}
        categoryColor={categoryColor}
        busy={busy}
        onChange={onStatusChange}
      />
      <div className="flex min-h-12 items-start pl-11">
        <div data-plan-drag-surface className="min-w-0 flex-1 py-1.5">
          <h4
            className={`wrap-anywhere text-sm font-semibold ${plan.status === "completed" ? "line-through" : ""}`}
          >
            {plan.title}
          </h4>
          <p className="wrap-anywhere text-xs text-zinc-500 dark:text-zinc-400">
            <time dateTime={start}>
              {dateFormatter.format(civilDateToUtc(start))}
            </time>
            {end !== start
              ? ` – ${dateFormatter.format(civilDateToUtc(end))}`
              : ""}
            {plan.schedule.mode === "timed"
              ? ` · ${plan.schedule.localStart.slice(11, 16)}${plan.schedule.localEnd ? `–${plan.schedule.localEnd.slice(11, 16)}` : ""}`
              : ""}{" "}
            · {statusLabels[plan.status]}
          </p>
        </div>
        {onEdit || onDelete ? (
          <div className="flex shrink-0">
            {onEdit ? (
              <button
                type="button"
                disabled={busy}
                onClick={onEdit}
                aria-label={`${editLabel} ${plan.title}`}
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
                aria-label={`${deleteLabel} ${plan.title}`}
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
        ) : null}
      </div>
      {plan.description ? (
        <p className="pr-3 pb-1.5 pl-11 text-xs whitespace-pre-wrap wrap-anywhere text-zinc-600 dark:text-zinc-400">
          {plan.description}
        </p>
      ) : null}
      {contextLabel ? <p className="sr-only">{contextLabel}</p> : null}
      {orderControl}
      {plan.recurrence ? (
        <p className="px-3 pb-2 text-xs text-zinc-500">
          Gestiona el progreso de cada aparición en el calendario.
        </p>
      ) : null}
      {plan.checklist.length ? (
        <div className="px-3">
          <TaskChecklist
            variant={plan.variant}
            categoryColor={categoryColor}
            entries={plan.checklist}
            busy={busy}
            onChange={plan.recurrence ? undefined : onChecklistChange}
          />
        </div>
      ) : null}
    </article>
  )
}
