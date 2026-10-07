"use client"

import { ErrorBanner } from "@/components/ui/error-banner"
import { useAccountDay } from "@/features/calendar/hooks/use-account-day"
import { TaskList } from "@/features/tasks/components/task-list"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"

export function TaskAgenda({ account }: { account: LocalAccount }) {
  const { data, error } = useLocalTasks(account)
  const today = useAccountDay(data?.timeZone)
  if (error)
    return (
      <ErrorBanner>
        No se pudo abrir la agenda local. Tus tareas se conservan.
      </ErrorBanner>
    )
  if (!today)
    return (
      <p role="status" className="mt-6">
        Cargando agenda…
      </p>
    )
  return (
    <>
      <TaskList
        account={account}
        selection={{ kind: "overdue", date: today }}
        heading="Atrasadas"
      />
      <TaskList
        account={account}
        selection={{ kind: "upcoming", date: today }}
        heading="Hoy y próximas"
      />
      <p className="hidden md:block mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Las tareas completadas de días pasados siguen disponibles en el
        calendario.
      </p>
    </>
  )
}
