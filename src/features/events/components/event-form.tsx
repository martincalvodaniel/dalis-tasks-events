"use client"

import { type FormEvent, useId, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { parseEventForm } from "@/features/events/event-form-input"
import type { EventDraft } from "@/features/events/local-events"

const inputClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"

export function EventForm({
  scheduledDate,
  timeZone,
  onSave,
  onCancel,
}: {
  scheduledDate: string
  timeZone: string
  onSave: (draft: EventDraft) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [allDay, setAllDay] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
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
      if (field === "description" || field === "timeZone") setExtrasOpen(true)
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
            `[name="${field}"]`
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
        "No se pudo guardar el evento. Tus datos siguen en el formulario; vuelve a intentarlo."
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div>
        <label htmlFor={`${id}-title`} className="font-semibold">
          Título
        </label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={160}
          disabled={saving}
          className={inputClass}
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
        <div>
          <label htmlFor={`${id}-start`} className="text-sm font-semibold">
            Inicio
          </label>
          <input
            id={`${id}-start`}
            name="localStart"
            type="datetime-local"
            defaultValue={`${scheduledDate}T09:00`}
            min="0001-01-01T00:00"
            max="9999-12-31T23:59"
            disabled={saving}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="text-sm font-semibold">
            Fin (opcional)
          </label>
          <input
            id={`${id}-end`}
            name="localEnd"
            type="datetime-local"
            min="0001-01-01T00:00"
            max="9999-12-31T23:59"
            disabled={saving}
            className={inputClass}
          />
        </div>
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
            defaultValue={scheduledDate}
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
            defaultValue={scheduledDate}
            min="0001-01-01"
            max="9999-12-30"
            disabled={saving}
            className={inputClass}
          />
        </div>
      </div>
      <details
        open={extrasOpen}
        onToggle={(event) => setExtrasOpen(event.currentTarget.open)}
        className="rounded-lg border border-zinc-200 dark:border-zinc-800"
      >
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
          Descripción y zona horaria
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <div>
            <label
              htmlFor={`${id}-description`}
              className="text-sm font-semibold"
            >
              Descripción
            </label>
            <textarea
              id={`${id}-description`}
              name="description"
              defaultValue=""
              rows={2}
              maxLength={10000}
              disabled={saving}
              className={`${inputClass} p-2`}
            />
          </div>
          <div hidden={allDay}>
            <label htmlFor={`${id}-zone`} className="text-sm font-semibold">
              Zona horaria
            </label>
            <input
              id={`${id}-zone`}
              name="timeZone"
              defaultValue={timeZone}
              disabled={saving}
              className={inputClass}
            />
          </div>
        </div>
      </details>
      <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar evento"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
