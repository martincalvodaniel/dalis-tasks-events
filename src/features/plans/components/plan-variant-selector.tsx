"use client"

import type { PlanVariant } from "@/types/plan-item"

const variants = [
  { value: "task", label: "Tarea", path: "M5 5h14v14H5z" },
  {
    value: "event",
    label: "Evento",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  },
  {
    value: "appointment",
    label: "Cita",
    path: "M5 5h14v15H5zM8 2v6m8-6v6M5 10h14",
  },
  {
    value: "note",
    label: "Nota",
    path: "M5 3h14v14l-4 4H5zM9 8h6m-6 4h6m0 9v-4h4",
  },
] as const

export function PlanVariantSelector({
  value,
  onChange,
  disabled,
}: {
  value: PlanVariant
  onChange: (value: PlanVariant) => void
  disabled: boolean
}) {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-4 gap-1">
      <legend className="sr-only">Tipo de plan</legend>
      <input type="hidden" name="variant" value={value} />
      {variants.map((variant) => (
        <button
          key={variant.value}
          type="button"
          aria-pressed={value === variant.value}
          onClick={() => onChange(variant.value)}
          className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-xs disabled:opacity-50 ${value === variant.value ? "bg-amber-200 text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="size-4 shrink-0"
          >
            <path d={variant.path} />
          </svg>
          {variant.label}
        </button>
      ))}
    </fieldset>
  )
}
