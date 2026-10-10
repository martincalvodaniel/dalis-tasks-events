"use client"

import type { ReactNode } from "react"
import { PlanCompletionButton } from "@/features/plans/components/plan-completion-button"
import { PlanStatusControls } from "@/features/plans/components/plan-status-controls"
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
  in_progress: "En proceso",
  completed: "Completado",
}

export function PlanCard({
  plan,
  categoryColor,
  categoryControl,
  orderControl,
  expanded = false,
  onExpandedChange,
  onEdit,
  onDelete,
  onStatusChange,
  onChecklistChange,
  busy = false,
}: {
  plan: Plan
  categoryColor?: string | null
  categoryControl?: ReactNode
  orderControl?: ReactNode
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange?: (status: Plan["status"]) => void
  onChecklistChange?: (entryId: string, completed: boolean) => void
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
      <details
        open={expanded}
        onToggle={(event) => onExpandedChange?.(event.currentTarget.open)}
      >
        <summary
          aria-label={`Detalles de ${plan.title}`}
          className="relative flex min-h-12 cursor-pointer list-none flex-col justify-center gap-0.5 rounded-xl py-1.5 pr-8 pl-11 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"
        >
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`absolute top-4 right-2 size-4 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="border-t border-zinc-200 px-3 pb-2 dark:border-zinc-800">
          {plan.description ? (
            <p className="mt-2 text-sm whitespace-pre-wrap wrap-anywhere text-zinc-600 dark:text-zinc-300">
              {plan.description}
            </p>
          ) : null}
          {categoryControl}
          {onStatusChange && !plan.recurrence ? (
            <PlanStatusControls
              plan={plan}
              busy={busy}
              onChange={onStatusChange}
            />
          ) : null}
          {onEdit || onDelete ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {onEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onEdit}
                  aria-label={`Editar ${plan.title}`}
                  className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                  Editar
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  aria-label={`Eliminar ${plan.title}`}
                  className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                  Eliminar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
      {orderControl}
      {plan.recurrence ? (
        <p className="px-3 pb-2 text-xs text-zinc-500">
          Repetición guardada. Sus apariciones y progreso todavía no están
          disponibles aquí.
        </p>
      ) : null}
      {plan.checklist.length ? (
        <div className="px-3">
          <TaskChecklist
            entries={plan.checklist}
            busy={busy}
            onChange={plan.recurrence ? undefined : onChecklistChange}
          />
        </div>
      ) : null}
    </article>
  )
}
