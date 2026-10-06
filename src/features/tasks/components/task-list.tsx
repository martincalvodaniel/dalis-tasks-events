"use client"

import { ErrorBanner } from "@/components/ui/error-banner"
import { TaskCard } from "@/features/tasks/components/task-card"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"

export function TaskList({ account }: { account: LocalAccount }) {
  const { data, error, isLoading } = useLocalTasks(account)
  return (
    <section aria-label="Tareas guardadas" className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold">Tus tareas</h2>
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
              <TaskCard task={task} />
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
