"use client"

import { ErrorBanner } from "@/components/ui/error-banner"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { TaskList } from "@/features/tasks/components/task-list"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"
import { civilDateToUtc, todayInTimeZone } from "@/lib/calendar/civil-date"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "full",
  timeZone: "UTC",
})

export function CalendarBoard({ account }: { account: LocalAccount }) {
  const { data, error, isLoading } = useLocalTasks(account)
  const requestedDate = useCalendarDate()
  if (error)
    return (
      <ErrorBanner>
        No se pudo leer el calendario local. Tus cambios se conservan; vuelve a
        intentarlo.
      </ErrorBanner>
    )
  if (isLoading || !data) return <p role="status">Cargando calendario…</p>
  const today = todayInTimeZone(data.timeZone)
  const selected = requestedDate ?? today
  const counts = new Map<string, number>()
  for (const task of data.tasks) {
    if (!task.recurrence)
      counts.set(task.scheduledDate, (counts.get(task.scheduledDate) ?? 0) + 1)
  }
  return (
    <>
      <MonthGrid selectedDate={selected} today={today} counts={counts} />
      <TaskList
        account={account}
        scheduledDate={selected}
        heading={dayFormatter.format(civilDateToUtc(selected))}
      />
    </>
  )
}
