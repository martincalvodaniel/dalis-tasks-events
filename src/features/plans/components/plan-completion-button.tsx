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
  return (
    <button
      type="button"
      disabled={busy || !onChange || Boolean(plan.recurrence)}
      aria-label={`${completed ? "Reabrir" : "Completar"} ${plan.title}${plan.recurrence ? "; repetición pendiente de soporte por aparición" : ""}`}
      onClick={() => {
        if (!plan.recurrence)
          onChange?.(completed ? "not_started" : "completed")
      }}
      className="absolute top-1 left-0 z-10 flex size-11 items-center justify-center rounded-lg text-zinc-600 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-zinc-300"
    >
      <ItemCompletionIcon
        variant={plan.variant}
        completed={completed}
        color={categoryColor}
      />
    </button>
  )
}
