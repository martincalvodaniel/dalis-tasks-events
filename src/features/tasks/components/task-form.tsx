"use client"

import { type FormEvent, type ReactNode, useId, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { ItemEditorHeader } from "@/components/ui/item-editor-header"
import { ChecklistFields } from "@/features/tasks/components/checklist-fields"
import type { TaskDraft } from "@/features/tasks/local-tasks"
import { taskDraftSchema } from "@/schemas/calendar-item"
import type { ChecklistEntry, Task } from "@/types/calendar-item"

export function TaskForm({
  scheduledDate,
  initialTask,
  onSave,
  onCancel,
  typeControl,
}: {
  scheduledDate: string
  initialTask?: Task
  onSave: (draft: TaskDraft) => Promise<void>
  onCancel: () => void
  typeControl?: ReactNode
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
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-3">
      <ItemEditorHeader
        title={initialTask ? "Editar tarea" : "Nuevo plan"}
        saving={saving}
        onCancel={onCancel}
      />
      {typeControl}
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div>
        <label htmlFor={titleId} className="sr-only">
          Título
        </label>
        <input
          id={titleId}
          name="title"
          defaultValue={initialTask?.title ?? ""}
          required
          maxLength={160}
          disabled={saving}
          placeholder="Escribe un título…"
          className="min-h-11 w-full border-b border-zinc-200 bg-transparent px-1 text-xl dark:border-zinc-700"
        />
      </div>
      <div>
        <label htmlFor={descriptionId} className="sr-only">
          Descripción
        </label>
        <textarea
          id={descriptionId}
          name="description"
          placeholder="Descripción"
          defaultValue={initialTask?.description ?? ""}
          rows={3}
          maxLength={10000}
          disabled={saving}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
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
          className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
        />
      </div>
      <ChecklistFields
        entries={checklist}
        onChange={setChecklist}
        disabled={saving}
      />
    </form>
  )
}
