"use client"

import { useMemo } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { useAccountDay } from "@/features/calendar/hooks/use-account-day"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { calendarWeeks } from "@/features/calendar/month-view"
import { prepareEventCalendar } from "@/features/events/calendar-events"
import { EventList } from "@/features/events/components/event-list"
import { useLocalEvents } from "@/features/events/hooks/use-local-events"
import { TaskList } from "@/features/tasks/components/task-list"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"
import { civilDateToUtc } from "@/lib/calendar/civil-date"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "full",
  timeZone: "UTC",
})

export function CalendarBoard({ account }: { account: LocalAccount }) {
  const tasks = useLocalTasks(account)
  const events = useLocalEvents(account)
  const requestedDate = useCalendarDate()
  const today = useAccountDay(tasks.data?.timeZone ?? events.data?.timeZone)
  const selected = requestedDate ?? today
  const cells = selected
    ? calendarWeeks(selected)
        .flat()
        .flatMap((cell) => (cell.date ? [cell.date] : []))
    : []
  const startDate = cells[0]
  const endDate = cells[cells.length - 1]
  const eventCalendar = useMemo(
    () =>
      events.data && startDate && endDate
        ? prepareEventCalendar(
            events.data.events,
            { startDate, endDate },
            events.data.timeZone
          )
        : null,
    [events.data, startDate, endDate]
  )
  if (tasks.error && events.error)
    return (
      <ErrorBanner>
        No se pudo leer el calendario local. Tus cambios se conservan.
      </ErrorBanner>
    )
  if (!today || !selected) return <p role="status">Cargando calendario…</p>
  const counts = new Map(eventCalendar?.counts)
  for (const task of tasks.data?.tasks ?? []) {
    if (!task.recurrence)
      counts.set(task.scheduledDate, (counts.get(task.scheduledDate) ?? 0) + 1)
  }
  return (
    <>
      <MonthGrid selectedDate={selected} today={today} counts={counts} />
      <h2 className="mt-5 text-base font-semibold first-letter:uppercase">
        {dayFormatter.format(civilDateToUtc(selected))}
      </h2>
      {tasks.error ? (
        <ErrorBanner>
          No se pudieron leer las tareas locales. Tus cambios se conservan.
        </ErrorBanner>
      ) : (
        <TaskList
          account={account}
          selection={{ kind: "day", date: selected }}
          heading="Tareas"
        />
      )}
      {events.error ? (
        <ErrorBanner>
          No se pudieron leer los eventos locales. Tus cambios se conservan.
        </ErrorBanner>
      ) : events.data && eventCalendar ? (
        <EventList
          account={account}
          events={eventCalendar.eventsByDate.get(selected) ?? []}
          issues={eventCalendar.issues}
          timeZone={events.data.timeZone}
          heading="Eventos"
        />
      ) : (
        <p role="status" className="mt-3 text-sm">
          Cargando eventos…
        </p>
      )}
    </>
  )
}
