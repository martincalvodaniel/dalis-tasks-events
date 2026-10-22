"use client"

import { useId, useMemo } from "react"
import { DelayedStatus } from "@/components/ui/delayed-status"
import { ErrorBanner } from "@/components/ui/error-banner"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { useAccountDay } from "@/features/calendar/hooks/use-account-day"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { calendarWeeks } from "@/features/calendar/month-view"
import {
  planCalendarSummary,
  readPlanCalendarAppearances,
} from "@/features/plans/calendar-plans"
import { PlanList } from "@/features/plans/components/plan-list"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import type { LocalAccount } from "@/features/workspace/local-account"
import { civilDateToUtc } from "@/lib/calendar/civil-date"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "full",
  timeZone: "UTC",
})

export function PlanCalendarBoard({ account }: { account: LocalAccount }) {
  const dropScope = useId()
  const { data, error } = useLocalPlans(account)
  const requestedDate = useCalendarDate()
  const today = useAccountDay(data?.timeZone)
  const selected = requestedDate ?? today
  const cells = selected
    ? calendarWeeks(selected)
        .flat()
        .flatMap((cell) => (cell.date ? [cell.date] : []))
    : []
  const startDate = cells[0]
  const endDate = cells.at(-1)
  const range = useMemo(
    () => (startDate && endDate ? { startDate, endDate } : null),
    [startDate, endDate]
  )
  const appearances = useMemo(
    () =>
      data && range
        ? readPlanCalendarAppearances(
            data.plans,
            data.occurrences,
            account.userId,
            range
          )
        : { views: [], issues: [], nextCursor: null },
    [data, range, account.userId]
  )
  const summary = useMemo(
    () =>
      data && range
        ? planCalendarSummary(data.plans, appearances.views, range)
        : {
            counts: new Map<string, number>(),
            incompleteDates: new Set<string>(),
          },
    [data, range, appearances.views]
  )
  if (error)
    return (
      <ErrorBanner>
        No se pudo leer el calendario local. Tus planes se conservan.
      </ErrorBanner>
    )
  if (!today || !selected)
    return <DelayedStatus>Cargando calendario…</DelayedStatus>
  return (
    <>
      <MonthGrid
        selectedDate={selected}
        today={today}
        counts={summary.counts}
        incompleteDates={summary.incompleteDates}
        completionKnown={!appearances.nextCursor && !appearances.issues.length}
        dropScope={dropScope}
      />
      {appearances.nextCursor ? (
        <p role="status" className="mt-2 text-xs text-zinc-500">
          Hay demasiadas apariciones para confirmar todo el mes. Consulta un día
          concreto.
        </p>
      ) : null}
      {appearances.issues.length ? (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          Hay apariciones con una hora no válida por el cambio de horario.
          Revisa la fecha y la zona de la serie.
        </p>
      ) : null}
      <PlanList
        account={account}
        calendarDropScope={dropScope}
        selection={{ kind: "day", date: selected }}
        heading={dayFormatter.format(civilDateToUtc(selected))}
      />
    </>
  )
}
