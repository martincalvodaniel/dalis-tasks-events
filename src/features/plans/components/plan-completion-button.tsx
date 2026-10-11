"use client"

import { ItemCompletionIcon } from "@/components/ui/item-completion-icon"
import type { Plan } from "@/types/plan-item"

export function PlanCompletionButton({
  plan,
  busy,
  onChange,
  categoryColor,
}: {
  plan: Plan
  busy: boolean
  onChange?: (status: Plan["status"]) => void
  categoryColor?: string | null
}) {
  const completed = plan.status === "completed"
  const inProgress = plan.status === "in_progress"
  const nextStatus = completed
    ? "not_started"
    : inProgress
      ? "completed"
      : "in_progress"
  const action = completed ? "Reabrir" : inProgress ? "Completar" : "Empezar"
  const state = completed
    ? "Completado"
    : inProgress
      ? "En progreso"
      : "Sin empezar"
  return (
    <button
      type="button"
      aria-pressed={inProgress ? "mixed" : completed}
      disabled={busy || !onChange || Boolean(plan.recurrence)}
      aria-label={`${action} ${plan.title}; ${state}${plan.recurrence ? "; abre una aparición en el calendario" : ""}`}
      onClick={() => {
        if (!plan.recurrence) onChange?.(nextStatus)
      }}
      className="absolute top-1 left-0 z-10 flex size-11 items-center justify-center rounded-lg text-zinc-600 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-zinc-300"
    >
      <ItemCompletionIcon
        variant={plan.variant}
        status={plan.status}
        color={categoryColor}
      />
    </button>
  )
}
