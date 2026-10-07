"use client"

import { useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog"
import { TaskCard } from "@/features/tasks/components/task-card"
import { TaskComposer } from "@/features/tasks/components/task-composer"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import { deleteLocalTask } from "@/features/tasks/local-tasks"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { Task } from "@/types/calendar-item"

export function TaskList({ account }: { account: LocalAccount }) {
  const { data, error, isLoading, mutate } = useLocalTasks(account)
  const { refresh } = useLocalAccount()
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
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
    <section aria-label="Tareas guardadas" className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold">Tus tareas</h2>
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
      ) : data?.tasks.length ? (
        <ul className="space-y-4">
          {data.tasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                onEdit={() => setEditing(task)}
                onDelete={() => setPendingDelete(task)}
                busy={deleting}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Pulsa + para añadir tu primera tarea.
        </p>
      )}
    </section>
  )
}
