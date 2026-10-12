"use client"
import { useState } from "react"
import { adjacentFormDate } from "@/lib/calendar/form-date"
export function CivilDateInput({
  id,
  name,
  label,
  initialValue,
  value,
  onChange,
  disabled = false,
  minDate = "0001-01-01",
  maxDate = "9999-12-31",
  showDayControls = false,
  className = "",
}: {
  id: string
  name: string
  label: string
  initialValue: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  minDate?: string
  maxDate?: string
  showDayControls?: boolean
  className?: string
}) {
  const [localValue, setLocalValue] = useState(initialValue)
  const current = value ?? localValue
  const previous = adjacentFormDate(current, -1, minDate, maxDate),
    next = adjacentFormDate(current, 1, minDate, maxDate)
  function change(nextValue: string) {
    if (value === undefined) setLocalValue(nextValue)
    onChange?.(nextValue)
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      {showDayControls ? (
        <button
          type="button"
          aria-label={`Restar un día: ${label}`}
          title="Día anterior"
          disabled={disabled || previous === null}
          onClick={() => {
            if (previous) change(previous)
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-4"
          >
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
      ) : null}
      <input
        id={id}
        name={name}
        type="date"
        value={current}
        onChange={(event) => change(event.target.value)}
        min={minDate}
        max={maxDate}
        disabled={disabled}
        className={`${className} min-w-0 flex-1`}
      />
      {showDayControls ? (
        <button
          type="button"
          aria-label={`Sumar un día: ${label}`}
          title="Día siguiente"
          disabled={disabled || next === null}
          onClick={() => {
            if (next) change(next)
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-4"
          >
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
