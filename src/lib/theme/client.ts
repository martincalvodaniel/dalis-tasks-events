"use client"
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from "@/config/theme"
import { parseThemePreference, themePreferenceSchema } from "@/schemas/theme"

export function getThemeSnapshot() {
  return parseThemePreference(
    document.documentElement.getAttribute("data-theme")
  )
}
export function getServerThemeSnapshot() {
  return "system" as const
}
export function subscribeTheme(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
    document.documentElement.setAttribute(
      "data-theme",
      parseThemePreference(event.newValue)
    )
    listener()
  }
  window.addEventListener(THEME_CHANGE_EVENT, listener)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, listener)
    window.removeEventListener("storage", onStorage)
  }
}
export function saveThemePreference(value: unknown): boolean {
  const theme = themePreferenceSchema.parse(value)
  document.documentElement.setAttribute("data-theme", theme)
  let persisted = true
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    persisted = false
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  return persisted
}
