"use client"

import { type FormEvent, useId, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { ChecklistFields } from "@/features/tasks/components/checklist-fields"
import type { TaskDraft } from "@/features/tasks/local-tasks"
import { taskDraftSchema } from "@/schemas/calendar-item"
import type { ChecklistEntry, Task } from "@/types/calendar-item"

export function TaskForm({
  scheduledDate,
  initialTask,
  onSave,
  onCancel,
}: {
  scheduledDate: string
  initialTask?: Task
  onSave: (draft: TaskDraft) => Promise<void>
  onCancel: () => void
}) {
  const titleId = useId()
  const dateId = useId()
  const descriptionId = useId()
  const [checklist, setChecklist] = useState<ChecklistEntry[]>(
    initialTask?.checklist ?? []
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const fields = new FormData(event.currentTarget)
    const parsed = taskDraftSchema.safeParse({
      kind: "task",
      title: fields.get("title"),
      scheduledDate: fields.get("scheduledDate"),
      description: fields.get("description"),
      status: initialTask?.status ?? "not_started",
      checklist,
      recurrence: initialTask?.recurrence ?? null,
    })
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0]
      setError(
        field === "title"
          ? "Escribe un título de hasta 160 caracteres."
          : field === "scheduledDate"
            ? "Elige una fecha válida."
            : field === "checklist"
              ? "Completa o elimina los pasos vacíos del checklist."
              : "Revisa los datos de la tarea."
      )
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSave(parsed.data)
    } catch {
      setError(
        "No se pudo guardar la tarea. Tus datos siguen en el formulario. Si cambió en otra pestaña, cancela y ábrela de nuevo."
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div>
        <label htmlFor={titleId} className="font-semibold">
          Título
        </label>
        <input
          id={titleId}
          name="title"
          defaultValue={initialTask?.title ?? ""}
          required
          maxLength={160}
          disabled={saving}
          className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
        />
      </div>
      <div>
        <label htmlFor={dateId} className="font-semibold">
          Fecha prevista
        </label>
        <input
          id={dateId}
          name="scheduledDate"
          type="date"
          required
          defaultValue={scheduledDate}
          min="0001-01-01"
          max="9999-12-31"
          disabled={saving}
          className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
        />
      </div>
      <div>
        <label htmlFor={descriptionId} className="font-semibold">
          Descripción
        </label>
        <textarea
          id={descriptionId}
          name="description"
          defaultValue={initialTask?.description ?? ""}
          rows={3}
          maxLength={10000}
          disabled={saving}
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"
        />
      </div>
      <ChecklistFields
        entries={checklist}
        onChange={setChecklist}
        disabled={saving}
      />
      <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving
            ? "Guardando…"
            : initialTask
              ? "Guardar cambios"
              : "Guardar tarea"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="min-h-12 rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
