"use client"

import { useId } from "react"

export function DateTimeFields({
  name,
  label,
  initialValue,
  disabled,
  hideTime = false,
  maxDate = "9999-12-31",
}: {
  name: string
  label: string
  initialValue: string
  disabled: boolean
  hideTime?: boolean
  maxDate?: string
}) {
  const id = useId()
  const inputClass =
    "min-h-11 min-w-0 w-full rounded-full border border-zinc-200 bg-zinc-100 px-3 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
  return (
    <fieldset
      className={`grid min-w-0 ${hideTime ? "grid-cols-[4rem_minmax(0,1fr)]" : "grid-cols-[4rem_minmax(0,1fr)_minmax(0,0.7fr)]"} items-center gap-2`}
    >
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-sm font-medium">
        {label}
      </span>
      <label htmlFor={`${id}-date`} className="sr-only">
        Fecha de {label.toLowerCase()}
      </label>
      <input
        id={`${id}-date`}
        name={`${name}Date`}
        type="date"
        defaultValue={initialValue.slice(0, 10)}
        min="0001-01-01"
        max={maxDate}
        disabled={disabled}
        className={inputClass}
      />
      <label htmlFor={`${id}-time`} className="sr-only" hidden={hideTime}>
        Hora de {label.toLowerCase()}
      </label>
      <input
        id={`${id}-time`}
        name={`${name}Time`}
        type="time"
        hidden={hideTime}
        defaultValue={initialValue.slice(11, 16)}
        disabled={disabled}
        className={inputClass}
      />
    </fieldset>
  )
}
