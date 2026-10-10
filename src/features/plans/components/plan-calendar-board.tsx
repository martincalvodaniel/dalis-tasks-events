"use client"

import { useMemo } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { useAccountDay } from "@/features/calendar/hooks/use-account-day"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { calendarWeeks } from "@/features/calendar/month-view"
import { planCalendarCounts } from "@/features/plans/calendar-plans"
import { PlanList } from "@/features/plans/components/plan-list"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { usePlanAppearances } from "@/features/plans/hooks/use-plan-appearances"
import type { LocalAccount } from "@/features/workspace/local-account"
import { civilDateToUtc } from "@/lib/calendar/civil-date"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "full",
  timeZone: "UTC",
})

export function PlanCalendarBoard({ account }: { account: LocalAccount }) {
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
  const appearances = usePlanAppearances(
    data,
    account.userId,
    account.epoch,
    range
  )
  const counts = useMemo(
    () =>
      data && range
        ? planCalendarCounts(data.plans, appearances.views, range)
        : new Map<string, number>(),
    [data, range, appearances.views]
  )
  if (error)
    return (
      <ErrorBanner>
        No se pudo leer el calendario local. Tus planes se conservan.
      </ErrorBanner>
    )
  if (!today || !selected)
    return (
      <p role="status" className="mt-4 text-sm">
        Cargando calendario…
      </p>
    )
  return (
    <>
      <MonthGrid selectedDate={selected} today={today} counts={counts} />
      {appearances.nextCursor ? (
        <p role="status" className="mt-2 text-xs text-zinc-500">
          El recuento incluye las apariciones cargadas.
        </p>
      ) : null}
      {appearances.canLoadMore ? (
        <button
          type="button"
          onClick={appearances.loadMore}
          className="min-h-11 rounded-lg border px-3 text-sm"
        >
          Completar recuento del mes
        </button>
      ) : null}
      {appearances.limited ? (
        <p role="status" className="text-xs text-zinc-500">
          Quedan apariciones sin contar; consulta un día concreto.
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
        selection={{ kind: "day", date: selected }}
        heading={dayFormatter.format(civilDateToUtc(selected))}
      />
    </>
  )
}
