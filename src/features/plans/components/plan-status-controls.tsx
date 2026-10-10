"use client"

import type { Plan } from "@/types/plan-item"

export function PlanStatusControls({
  plan,
  busy,
  onChange,
}: {
  plan: Plan
  busy: boolean
  onChange: (status: Plan["status"]) => void
}) {
  if (plan.status === "completed") return null
  const inProgress = plan.status === "in_progress"
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(inProgress ? "not_started" : "in_progress")}
      aria-label={`${inProgress ? "Dejar sin empezar" : "Empezar"} ${plan.title}`}
      className="mt-2 min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
    >
      {inProgress ? "Sin empezar" : "Empezar"}
    </button>
  )
}
