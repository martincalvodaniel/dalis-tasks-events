"use client"

import { useSyncExternalStore } from "react"
import { calendarDateFromSearch } from "@/features/calendar/month-view"

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

export function useCalendarDate() {
  return useSyncExternalStore(
    subscribe,
    () => calendarDateFromSearch(window.location.search),
    () => null
  )
}
