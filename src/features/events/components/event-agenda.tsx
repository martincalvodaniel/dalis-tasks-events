"use client"

import { useMemo } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { useAccountDay } from "@/features/calendar/hooks/use-account-day"
import { createEventCalendarIndex } from "@/features/events/calendar-events"
import { EventList } from "@/features/events/components/event-list"
import { useLocalEvents } from "@/features/events/hooks/use-local-events"
import type { LocalAccount } from "@/features/workspace/local-account"
import { addCivilDays } from "@/lib/calendar/civil-date"

export function EventAgenda({ account }: { account: LocalAccount }) {
  const { data, error } = useLocalEvents(account)
  const today = useAccountDay(data?.timeZone)
  const selection = useMemo(() => {
    if (!data || !today) return null
    let endDate = "9999-12-31"
    try {
      endDate = addCivilDays(today, 13)
    } catch {
      /* Clamp the supported civil range. */
    }
    return createEventCalendarIndex(data.events, data.timeZone).select({
      startDate: today,
      endDate,
    })
  }, [data, today])
  if (error)
    return (
      <ErrorBanner>
        No se pudieron leer los eventos locales. Tus cambios se conservan.
      </ErrorBanner>
    )
  if (!data || !selection) return null
  return (
    <EventList
      account={account}
      events={selection.events}
      issues={selection.issues}
      timeZone={data.timeZone}
      heading="Eventos · próximas dos semanas"
      hideEmpty
    />
  )
}
