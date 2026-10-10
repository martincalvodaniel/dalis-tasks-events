"use client"

import { useEffect, useId, useRef } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { itemEditorDialogClass } from "@/config/item-editor"
import { TaskForm } from "@/features/tasks/components/task-form"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import {
  createLocalTask,
  type TaskDraft,
  updateLocalTask,
} from "@/features/tasks/local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"
import { todayInTimeZone } from "@/lib/calendar/civil-date"
import type { Task } from "@/types/calendar-item"

export function TaskComposer({
  account,
  initialTask,
  initialDate,
  onClose,
  onSaved,
}: {
  account: LocalAccount
  initialTask?: Task
  initialDate?: string
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const intent = useRef<{ itemId: string; operationId: string } | null>(null)
  const headingId = useId()
  const { data, error, mutate } = useLocalTasks(account)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  async function save(draft: TaskDraft) {
    intent.current ??= {
      itemId: initialTask?.id ?? crypto.randomUUID(),
      operationId: crypto.randomUUID(),
    }
    saving.current = true
    try {
      if (initialTask)
        await updateLocalTask(
          account,
          initialTask,
          draft,
          intent.current.operationId
        )
      else
        await createLocalTask(
          account,
          draft,
          intent.current.itemId,
          intent.current.operationId
        )
    } finally {
      saving.current = false
    }
    onSaved()
    void mutate()
    onClose()
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={() => {
        // Ignore a queued cleanup event if Strict Mode has reopened the dialog.
        if (!dialog.current?.open) onClose()
      }}
      onCancel={(event) => {
        if (saving.current) event.preventDefault()
      }}
      className={itemEditorDialogClass}
    >
      <h2 id={headingId} className="sr-only">
        {initialTask ? "Editar tarea" : "Nueva tarea"}
      </h2>
      {error ? (
        <>
          <ErrorBanner>
            No se pudo abrir la cuenta local. Cierra el formulario y vuelve a
            intentarlo.
          </ErrorBanner>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 min-h-11 rounded-lg border px-4"
          >
            Cerrar
          </button>
        </>
      ) : data ? (
        <TaskForm
          scheduledDate={
            initialTask?.scheduledDate ??
            initialDate ??
            todayInTimeZone(data.timeZone)
          }
          initialTask={initialTask}
          onSave={save}
          onCancel={onClose}
        />
      ) : (
        <p role="status">Preparando formulario…</p>
      )}
    </dialog>
  )
}
