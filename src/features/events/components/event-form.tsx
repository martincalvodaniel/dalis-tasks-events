"use client"

import { type FormEvent, type ReactNode, useId, useState } from "react"
import { DateTimeFields } from "@/components/ui/date-time-fields"
import { ErrorBanner } from "@/components/ui/error-banner"
import { ItemEditorHeader } from "@/components/ui/item-editor-header"
import { parseEventForm } from "@/features/events/event-form-input"
import type { EventDraft } from "@/features/events/local-events"
import { addCivilDays } from "@/lib/calendar/civil-date"
import type { CalendarEvent } from "@/types/calendar-item"

const inputClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"

export function EventForm({
  scheduledDate,
  timeZone,
  initialEvent,
  onSave,
  onCancel,
  typeControl,
}: {
  scheduledDate: string
  timeZone: string
  initialEvent?: CalendarEvent
  onSave: (draft: EventDraft) => Promise<void>
  onCancel: () => void
  typeControl?: ReactNode
}) {
  const id = useId()
  const schedule = initialEvent?.schedule
  const [allDay, setAllDay] = useState(schedule?.mode === "all_day")
  const [extrasOpen, setExtrasOpen] = useState(
    Boolean(schedule?.mode === "timed" && schedule.timeZone !== timeZone)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const form = event.currentTarget
    const parsed = parseEventForm(new FormData(form))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const reason = issue?.code === "custom" ? issue.params?.timeReason : null
      const path = issue?.path.join(".") ?? ""
      const field = path.includes("timeZone")
        ? "timeZone"
        : path === "title"
          ? "title"
          : path === "description"
            ? "description"
            : allDay
              ? path.includes("startDate")
                ? "startDate"
                : "lastDate"
              : path.includes("localEnd")
                ? "localEnd"
                : "localStart"
      if (field === "timeZone") setExtrasOpen(true)
      setError(
        reason === "ambiguous"
          ? "Esa hora se repite por el cambio de horario. Elige otra hora de inicio o fin."
          : reason === "nonexistent"
            ? "Esa hora no existe por el cambio de horario. Elige otra hora de inicio o fin."
            : field === "title"
              ? "Escribe un título de hasta 160 caracteres."
              : field === "timeZone"
                ? "Escribe una zona horaria válida, por ejemplo Europe/Madrid."
                : field === "description"
                  ? "La descripción admite hasta 10.000 caracteres."
                  : allDay
                    ? "Revisa las fechas: la última debe ser igual o posterior a la primera y anterior al 31/12/9999."
                    : "Revisa la fecha y hora. El fin debe ser posterior al inicio; puedes dejarlo vacío."
      )
      // Optional fields become visible on the next render; focus after disclosure.
      requestAnimationFrame(() =>
        form
          .querySelector<HTMLInputElement | HTMLTextAreaElement>(
            `[name="${field === "localStart" || field === "localEnd" ? `${field}Date` : field}"]`
          )
          ?.focus()
      )
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSave(parsed.data)
    } catch {
      setError(
        "No se pudo guardar el evento. Tus datos siguen en el formulario. Si cambió en otra pestaña, cancela y ábrelo de nuevo."
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-3">
      <ItemEditorHeader
        title={initialEvent ? "Editar evento" : "Nuevo plan"}
        saving={saving}
        onCancel={onCancel}
      />
      {typeControl}
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div>
        <label htmlFor={`${id}-title`} className="sr-only">
          Título
        </label>
        <input
          id={`${id}-title`}
          name="title"
          defaultValue={initialEvent?.title ?? ""}
          required
          maxLength={160}
          disabled={saving}
          placeholder="Escribe un título…"
          className="min-h-11 w-full border-b border-zinc-200 bg-transparent px-1 text-xl dark:border-zinc-700"
        />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className="sr-only">
          Descripción
        </label>
        <textarea
          id={`${id}-description`}
          name="description"
          placeholder="Descripción"
          defaultValue={initialEvent?.description ?? ""}
          rows={3}
          maxLength={10000}
          disabled={saving}
          className={`${inputClass} p-2`}
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          name="allDay"
          type="checkbox"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          disabled={saving}
          className="h-5 w-5"
        />
        Todo el día
      </label>
      <div hidden={allDay} className="space-y-3">
        <DateTimeFields
          name="localStart"
          label="Inicio"
          initialValue={
            schedule?.mode === "timed"
              ? schedule.localStart
              : `${scheduledDate}T09:00`
          }
          disabled={saving}
        />
        <DateTimeFields
          name="localEnd"
          label="Fin"
          initialValue={
            schedule?.mode === "timed" ? (schedule.localEnd ?? "") : ""
          }
          disabled={saving}
        />
        <p className="text-xs text-zinc-500">El fin es opcional.</p>
      </div>
      <div hidden={!allDay} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-date`} className="text-sm font-semibold">
            Desde
          </label>
          <input
            id={`${id}-date`}
            name="startDate"
            type="date"
            defaultValue={
              schedule?.mode === "all_day" ? schedule.startDate : scheduledDate
            }
            min="0001-01-01"
            max="9999-12-30"
            disabled={saving}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-last`} className="text-sm font-semibold">
            Hasta (incluido)
          </label>
          <input
            id={`${id}-last`}
            name="lastDate"
            type="date"
            defaultValue={
              schedule?.mode === "all_day"
                ? addCivilDays(schedule.endDateExclusive, -1)
                : scheduledDate
            }
            min="0001-01-01"
            max="9999-12-30"
            disabled={saving}
            className={inputClass}
          />
        </div>
      </div>
      <details
        hidden={allDay}
        open={extrasOpen}
        onToggle={(event) => setExtrasOpen(event.currentTarget.open)}
        className="rounded-lg border border-zinc-200 dark:border-zinc-800"
      >
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
          Zona horaria
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <div hidden={allDay}>
            <label htmlFor={`${id}-zone`} className="text-sm font-semibold">
              Zona horaria
            </label>
            <input
              id={`${id}-zone`}
              name="timeZone"
              defaultValue={
                schedule?.mode === "timed" ? schedule.timeZone : timeZone
              }
              disabled={saving}
              className={inputClass}
            />
          </div>
        </div>
      </details>
    </form>
  )
}
