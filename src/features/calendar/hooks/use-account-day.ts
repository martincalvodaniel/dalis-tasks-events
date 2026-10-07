"use client"

import { useSyncExternalStore } from "react"
import { todayInTimeZone } from "@/lib/calendar/civil-date"

function subscribe(onChange: () => void) {
  const interval = window.setInterval(onChange, 60000)
  window.addEventListener("focus", onChange)
  document.addEventListener("visibilitychange", onChange)
  return () => {
    window.clearInterval(interval)
    window.removeEventListener("focus", onChange)
    document.removeEventListener("visibilitychange", onChange)
  }
}

export function useAccountDay(timeZone?: string) {
  return useSyncExternalStore(
    subscribe,
    () => (timeZone ? todayInTimeZone(timeZone) : null),
    () => null
  )
}
