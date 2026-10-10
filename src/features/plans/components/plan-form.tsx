"use client"

import { type FormEvent, useId, useState } from "react"
import { DateTimeFields } from "@/components/ui/date-time-fields"
import { ErrorBanner } from "@/components/ui/error-banner"
import { ItemEditorHeader } from "@/components/ui/item-editor-header"
import { PlanRecurrenceFields } from "@/features/plans/components/plan-recurrence-fields"
import { PlanVariantSelector } from "@/features/plans/components/plan-variant-selector"
import { parsePlanForm } from "@/features/plans/plan-form-input"
import { ChecklistFields } from "@/features/tasks/components/checklist-fields"
import { addCivilDays } from "@/lib/calendar/civil-date"
import type { ChecklistEntry } from "@/types/calendar-item"
import type { PlanDraft } from "@/types/plan-item"
import type { Tag } from "@/types/preferences"

const inputClass =
  "min-h-11 min-w-0 rounded-full border border-zinc-200 bg-zinc-100 px-3 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"

export function PlanForm({
  scheduledDate,
  timeZone,
  initialPlan,
  initialTagId = null,
  tags,
  onSave,
  onCancel,
}: {
  scheduledDate: string
  timeZone: string
  initialPlan?: PlanDraft
  initialTagId?: string | null
  tags: Pick<Tag, "id" | "name" | "color">[]
  onSave: (draft: {
    input: PlanDraft
    primaryTagId: string | null
  }) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const schedule = initialPlan?.schedule
  const [variant, setVariant] = useState(initialPlan?.variant ?? "task")
  const [allDay, setAllDay] = useState(schedule?.mode !== "timed")
  const [primaryTagId, setPrimaryTagId] = useState(initialTagId)
  const [checklist, setChecklist] = useState<ChecklistEntry[]>(
    initialPlan?.checklist ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [zoneOpen, setZoneOpen] = useState(
    Boolean(schedule?.mode === "timed" && schedule.timeZone !== timeZone)
  )
  const selectedTag = tags.find((tag) => tag.id === primaryTagId)
  const startDate =
    schedule?.mode === "all_day"
      ? schedule.startDate
      : (schedule?.localStart.slice(0, 10) ?? scheduledDate)
  const lastDate =
    schedule?.mode === "all_day"
      ? addCivilDays(schedule.endDateExclusive, -1)
      : (schedule?.localEnd?.slice(0, 10) ?? startDate)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const parsed = parsePlanForm(new FormData(event.currentTarget), checklist)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const field = issue?.path[0]
      const reason = issue?.code === "custom" ? issue.params?.timeReason : null
      if (issue?.path.includes("timeZone")) setZoneOpen(true)
      setError(
        reason === "ambiguous"
          ? "Esa hora se repite por el cambio de horario. Elige otra hora de inicio o fin."
          : reason === "nonexistent"
            ? "Esa hora no existe por el cambio de horario. Elige otra hora de inicio o fin."
            : field === "title"
              ? "Escribe un título de hasta 160 caracteres."
              : field === "description"
                ? "La descripción admite hasta 10.000 caracteres."
                : field === "checklist"
                  ? "Completa o elimina los pasos vacíos del checklist."
                  : field === "recurrence"
                    ? "Revisa la repetición: elige días, un intervalo y un final válidos."
                    : issue?.path.includes("timeZone")
                      ? "Escribe una zona horaria válida, por ejemplo Europe/Madrid."
                      : allDay
                        ? "Revisa las fechas: el fin debe ser igual o posterior al inicio y anterior al 31/12/9999."
                        : "Revisa fecha y hora. El fin es opcional y debe ser posterior al inicio."
      )
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSave({ input: parsed.data, primaryTagId })
    } catch {
      setError(
        "No se pudo guardar el plan. Tus datos siguen en el formulario. Si cambió en otra pestaña, cancela y ábrelo de nuevo."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-3">
      <ItemEditorHeader
        title={initialPlan ? "Editar plan" : "Nuevo plan"}
        saving={saving}
        onCancel={onCancel}
      />
      <PlanVariantSelector
        value={variant}
        onChange={setVariant}
        disabled={saving}
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div>
        <label htmlFor={`${id}-title`} className="sr-only">
          Título
        </label>
        <input
          id={`${id}-title`}
          name="title"
          defaultValue={initialPlan?.title ?? ""}
          maxLength={160}
          required
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
          defaultValue={initialPlan?.description ?? ""}
          rows={3}
          maxLength={10000}
          disabled={saving}
          placeholder="Descripción"
          className="w-full resize-y bg-transparent px-1 py-2 text-sm"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-category`} className="text-sm font-medium">
          Categoría
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: selectedTag?.color ?? "#71717a" }}
          />
          <select
            id={`${id}-category`}
            name="primaryTagId"
            value={primaryTagId ?? ""}
            onChange={(event) => setPrimaryTagId(event.target.value || null)}
            disabled={saving}
            className={`${inputClass} max-w-48`}
          >
            <option value="">Sin categoría</option>
            {primaryTagId && !selectedTag ? (
              <option value={primaryTagId}>Categoría no disponible</option>
            ) : null}
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
        Todo el día
        <input
          name="allDay"
          type="checkbox"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          disabled={saving}
          className="size-5 accent-amber-500"
        />
      </label>
      <div className="space-y-2">
        <DateTimeFields
          name="localStart"
          label="Inicio"
          initialValue={
            schedule?.mode === "timed"
              ? schedule.localStart
              : `${startDate}T09:00`
          }
          disabled={saving}
          hideTime={allDay}
          maxDate={allDay ? "9999-12-30" : "9999-12-31"}
        />
        <DateTimeFields
          name="localEnd"
          label="Fin"
          initialValue={
            schedule?.mode === "timed" ? (schedule.localEnd ?? "") : lastDate
          }
          disabled={saving}
          hideTime={allDay}
          maxDate={allDay ? "9999-12-30" : "9999-12-31"}
        />
      </div>
      <p className="text-xs text-zinc-500">
        El fin es opcional. En todo el día, la fecha final está incluida.
      </p>
      <PlanRecurrenceFields
        initialRule={initialPlan?.recurrence ?? null}
        disabled={saving}
      />
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-status`} className="text-sm font-medium">
          Estado
        </label>
        <select
          id={`${id}-status`}
          name="status"
          defaultValue={initialPlan?.status ?? "not_started"}
          disabled={saving}
          className={inputClass}
        >
          <option value="not_started">Sin empezar</option>
          <option value="in_progress">En proceso</option>
          <option value="completed">Completado</option>
        </select>
      </div>
      <ChecklistFields
        entries={checklist}
        onChange={setChecklist}
        disabled={saving}
      />
      <details
        open={zoneOpen}
        onToggle={(event) => setZoneOpen(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer py-3 text-xs text-zinc-500">
          Zona horaria
        </summary>
        <label className="flex items-center justify-between gap-3 text-sm">
          Zona horaria
          <input
            name="timeZone"
            defaultValue={
              schedule?.mode === "timed"
                ? schedule.timeZone
                : (initialPlan?.recurrence?.timeZone ?? timeZone)
            }
            disabled={saving}
            className={`${inputClass} max-w-48`}
          />
        </label>
      </details>
    </form>
  )
}
