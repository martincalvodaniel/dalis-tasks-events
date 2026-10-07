"use client"

import { useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { ItemCategorySelect } from "@/features/tags/components/item-category-select"
import { useItemCategory } from "@/features/tags/hooks/use-item-category"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog"
import { TaskCard } from "@/features/tasks/components/task-card"
import { TaskComposer } from "@/features/tasks/components/task-composer"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import { useTaskProgress } from "@/features/tasks/hooks/use-task-progress"
import { deleteLocalTask } from "@/features/tasks/local-tasks"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { Task } from "@/types/calendar-item"

export function TaskList({
  account,
  scheduledDate,
  heading = "Tus tareas",
}: {
  account: LocalAccount
  scheduledDate?: string
  heading?: string
}) {
  const { data, error, isLoading, mutate } = useLocalTasks(account)
  const { refresh } = useLocalAccount()
  const progress = useTaskProgress(account)
  const { data: categories, error: categoryReadError } = useLocalTags(account)
  const category = useItemCategory(account)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const tasks = scheduledDate
    ? data?.tasks.filter(
        (task) => !task.recurrence && task.scheduledDate === scheduledDate
      )
    : data?.tasks
  async function remove(task: Task, operationId: string) {
    setDeleting(true)
    try {
      await deleteLocalTask(account, task, operationId)
      void mutate()
      void refresh()
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }
  return (
    <section
      aria-label={scheduledDate ? "Tareas del día" : "Tareas guardadas"}
      className="mt-8 space-y-4"
    >
      <h2 className="text-xl font-semibold first-letter:uppercase">
        {heading}
      </h2>
      {progress.error ? (
        <ErrorBanner>
          No se pudo cambiar el progreso. Vuelve a intentarlo; si la tarea
          cambió en otra pestaña, comprueba su contenido actualizado.
        </ErrorBanner>
      ) : null}
      {progress.busy ? <p role="status">Guardando progreso…</p> : null}
      {categoryReadError || category.error ? (
        <ErrorBanner>
          No se pudo leer o guardar la categoría. Vuelve a intentarlo; tus
          tareas se conservan.
        </ErrorBanner>
      ) : null}
      {category.busy ? <p role="status">Guardando categoría…</p> : null}
      {pendingDelete ? (
        <DeleteTaskDialog
          task={pendingDelete}
          busy={deleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={(operationId) => remove(pendingDelete, operationId)}
        />
      ) : null}
      {editing ? (
        <TaskComposer
          key={editing.id}
          account={account}
          initialTask={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void refresh()
          }}
        />
      ) : null}
      {error ? (
        <ErrorBanner>
          No se pudieron leer las tareas locales. Vuelve a abrir este espacio;
          tus cambios se conservan.
        </ErrorBanner>
      ) : isLoading ? (
        <p role="status">Cargando tareas…</p>
      ) : tasks?.length ? (
        <ul className="space-y-4">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                onEdit={() => setEditing(task)}
                onDelete={() => setPendingDelete(task)}
                busy={deleting || progress.busy || category.busy}
                categoryControl={
                  categories && !categoryReadError ? (
                    <ItemCategorySelect
                      title={task.title}
                      tags={categories.tags}
                      selectedId={categories.views[task.id] ?? null}
                      busy={deleting || progress.busy || category.busy}
                      onChange={(tagId) => {
                        void category.change({ itemId: task.id, tagId })
                      }}
                    />
                  ) : undefined
                }
                onStatusChange={
                  task.recurrence
                    ? undefined
                    : (status) => {
                        void progress.change({
                          type: "task.set-status",
                          itemId: task.id,
                          occurrenceId: null,
                          status,
                        })
                      }
                }
                onChecklistChange={
                  task.recurrence
                    ? undefined
                    : (entryId, completed) => {
                        void progress.change({
                          type: "task.set-checklist-entry",
                          itemId: task.id,
                          occurrenceId: null,
                          entryId,
                          completed,
                        })
                      }
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {scheduledDate
            ? "No hay tareas para este día. Pulsa + para añadir una."
            : "Pulsa + para añadir tu primera tarea."}
        </p>
      )}
    </section>
  )
}
