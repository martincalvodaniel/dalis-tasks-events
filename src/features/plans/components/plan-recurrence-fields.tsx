"use client"

import { useId, useState } from "react"
import type { RecurrenceRule } from "@/types/calendar-item"

const inputClass =
  "min-h-11 min-w-0 rounded-full border border-zinc-200 bg-zinc-100 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export function PlanRecurrenceFields({
  initialRule,
  disabled,
}: {
  initialRule: RecurrenceRule | null
  disabled: boolean
}) {
  const id = useId()
  const [frequency, setFrequency] = useState(initialRule?.frequency ?? "none")
  const [endType, setEndType] = useState(initialRule?.end.type ?? "never")
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="sr-only">Repetición</legend>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-frequency`} className="text-sm font-medium">
          Repetir
        </label>
        <select
          id={`${id}-frequency`}
          name="frequency"
          value={frequency}
          onChange={(event) =>
            setFrequency(event.target.value as typeof frequency)
          }
          className={inputClass}
        >
          <option value="none">Ninguno</option>
          <option value="daily">Cada día</option>
          <option value="weekly">Cada semana</option>
          <option value="monthly">Cada mes</option>
          <option value="yearly">Cada año</option>
        </select>
      </div>
      <div
        hidden={frequency === "none"}
        className="space-y-2 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/50"
      >
        <label className="flex items-center justify-between gap-3 text-sm">
          Cada cuántos periodos
          <input
            name="interval"
            type="number"
            min={1}
            max={365}
            defaultValue={initialRule?.interval ?? 1}
            className={`${inputClass} w-20`}
          />
        </label>
        <fieldset
          hidden={frequency !== "weekly"}
          className={`${frequency === "weekly" ? "flex" : "hidden"} flex-wrap gap-1`}
        >
          <legend className="sr-only">Días de la semana</legend>
          {weekdays.map((day, index) => (
            <label
              key={day}
              className="flex min-h-11 items-center gap-1 rounded-full px-1 text-xs"
            >
              <input
                name="weekdays"
                type="checkbox"
                value={index}
                defaultChecked={
                  initialRule?.frequency === "weekly"
                    ? initialRule.weekdays.includes(index)
                    : index === 1
                }
              />
              {day}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center justify-between gap-3 text-sm">
          Termina
          <select
            name="recurrenceEnd"
            value={endType}
            onChange={(event) =>
              setEndType(event.target.value as typeof endType)
            }
            className={inputClass}
          >
            <option value="never">Nunca</option>
            <option value="until">En una fecha</option>
            <option value="count">Tras varias veces</option>
          </select>
        </label>
        <label
          hidden={endType !== "until"}
          className={`${endType === "until" ? "flex" : "hidden"} items-center justify-between gap-3 text-sm`}
        >
          Última fecha
          <input
            name="untilDate"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            defaultValue={
              initialRule?.end.type === "until" ? initialRule.end.date : ""
            }
            className={inputClass}
          />
        </label>
        <label
          hidden={endType !== "count"}
          className={`${endType === "count" ? "flex" : "hidden"} items-center justify-between gap-3 text-sm`}
        >
          Veces
          <input
            name="count"
            type="number"
            min={1}
            max={100000}
            defaultValue={
              initialRule?.end.type === "count" ? initialRule.end.count : 1
            }
            className={`${inputClass} w-24`}
          />
        </label>
      </div>
    </fieldset>
  )
}
