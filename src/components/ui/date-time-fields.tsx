"use client"

import { useId } from "react"
import { CivilDateInput } from "@/components/ui/civil-date-input"

export function DateTimeFields({
  name,
  label,
  initialValue,
  disabled,
  hideTime = false,
  maxDate = "9999-12-31",
  dateValue,
  onDateChange,
  showDayControls = false,
}: {
  name: string
  label: string
  initialValue: string
  disabled: boolean
  hideTime?: boolean
  dateValue?: string
  onDateChange?: (value: string) => void
  showDayControls?: boolean
  maxDate?: string
}) {
  const id = useId()
  const inputClass =
    "min-h-11 min-w-0 w-full rounded-full border border-zinc-200 bg-zinc-100 px-3 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
  return (
    <fieldset
      className={`grid min-w-0 ${showDayControls ? "grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)]" : hideTime ? "grid-cols-[4rem_minmax(0,1fr)]" : "grid-cols-[4rem_minmax(0,1fr)_minmax(0,0.7fr)]"} ${showDayControls && !hideTime ? "sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,0.6fr)]" : ""} items-center gap-2`}
    >
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-sm font-medium">
        {label}
      </span>
      <label htmlFor={`${id}-date`} className="sr-only">
        Fecha de {label.toLowerCase()}
      </label>
      <CivilDateInput
        label={`Fecha de ${label.toLowerCase()}`}
        value={dateValue}
        onChange={onDateChange}
        showDayControls={showDayControls}
        id={`${id}-date`}
        name={`${name}Date`}
        initialValue={initialValue.slice(0, 10)}
        maxDate={maxDate}
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
        className={`${inputClass} ${showDayControls ? "col-start-2 max-w-32 justify-self-end sm:col-auto sm:max-w-none" : ""}`}
      />
    </fieldset>
  )
}
