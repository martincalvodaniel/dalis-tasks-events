"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { itemEditorDialogClass } from "@/config/item-editor"
import { EventForm } from "@/features/events/components/event-form"
import { useLocalEvents } from "@/features/events/hooks/use-local-events"
import {
  createLocalEvent,
  type EventDraft,
} from "@/features/events/local-events"
import { TaskForm } from "@/features/tasks/components/task-form"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import { createLocalTask, type TaskDraft } from "@/features/tasks/local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"
import { todayInTimeZone } from "@/lib/calendar/civil-date"

export function CreateItemDialog({
  account,
  initialDate,
  onClose,
  onSaved,
}: {
  account: LocalAccount
  initialDate?: string
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<"task" | "event">("task")
  const intent = useRef<
    Partial<
      Record<
        "task" | "event",
        { itemId: string; operationId: string; serialized: string }
      >
    >
  >({})
  const headingId = useId()
  const tasks = useLocalTasks(account)
  const events = useLocalEvents(account)
  const timeZone = tasks.data?.timeZone
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  useEffect(() => {
    if (timeZone)
      dialog.current
        ?.querySelector<HTMLInputElement>(
          `[data-create-kind="${kind}"] input[name="title"]`
        )
        ?.focus()
  }, [kind, timeZone])
  async function save(draft: TaskDraft | EventDraft) {
    if (saving.current) return
    const serialized = JSON.stringify(draft)
    const previous = intent.current[draft.kind]
    const active =
      previous?.serialized === serialized
        ? previous
        : {
            itemId: previous?.itemId ?? crypto.randomUUID(),
            operationId: crypto.randomUUID(),
            serialized,
          }
    intent.current[draft.kind] = active
    saving.current = true
    setBusy(true)
    try {
      if (draft.kind === "task")
        await createLocalTask(account, draft, active.itemId, active.operationId)
      else
        await createLocalEvent(
          account,
          draft,
          active.itemId,
          active.operationId
        )
    } finally {
      saving.current = false
      setBusy(false)
    }
    onSaved()
    void (draft.kind === "task" ? tasks.mutate() : events.mutate()).catch(
      () => undefined
    )
    onClose()
  }
  const typeControl = (
    <fieldset
      aria-label="Tipo de elemento"
      className="mb-3 flex flex-wrap gap-2"
    >
      {(
        [
          ["task", "Tarea"],
          ["event", "Evento o cita"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={kind === value}
          disabled={busy}
          onClick={() => setKind(value)}
          className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${kind === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          {label}
        </button>
      ))}
    </fieldset>
  )
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={() => {
        if (!dialog.current?.open) onClose()
      }}
      onCancel={(event) => {
        if (saving.current) event.preventDefault()
      }}
      className={itemEditorDialogClass}
    >
      <h2 id={headingId} className="sr-only">
        Crear
      </h2>
      {tasks.error ? (
        <>
          <ErrorBanner>
            No se pudo abrir la cuenta local. Cierra el formulario y vuelve a
            intentarlo.
          </ErrorBanner>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 min-h-11 rounded-lg border px-3"
          >
            Cerrar
          </button>
        </>
      ) : timeZone ? (
        <>
          <div data-create-kind="task" hidden={kind !== "task"}>
            <TaskForm
              scheduledDate={initialDate ?? todayInTimeZone(timeZone)}
              typeControl={typeControl}
              onSave={save}
              onCancel={onClose}
            />
          </div>
          <div data-create-kind="event" hidden={kind !== "event"}>
            <EventForm
              scheduledDate={initialDate ?? todayInTimeZone(timeZone)}
              timeZone={timeZone}
              typeControl={typeControl}
              onSave={save}
              onCancel={onClose}
            />
          </div>
        </>
      ) : (
        <p role="status">Preparando formulario…</p>
      )}
    </dialog>
  )
}
