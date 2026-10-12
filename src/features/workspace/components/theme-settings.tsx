"use client"
import { useId, useState, useSyncExternalStore } from "react"
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  saveThemePreference,
  subscribeTheme,
} from "@/lib/theme/client"

export function ThemeSettings() {
  const id = useId()
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  )
  const [notSaved, setNotSaved] = useState(false)
  return (
    <section className="mb-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-medium">
          Tema
        </label>
        <select
          id={id}
          value={theme}
          onChange={(event) =>
            setNotSaved(!saveThemePreference(event.target.value))
          }
          className="min-h-11 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
        >
          <option value="system">Sistema</option>
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </select>
      </div>
      {notSaved ? (
        <p
          role="status"
          className="mt-2 text-xs text-zinc-600 dark:text-zinc-400"
        >
          Tema aplicado. No se pudo guardar en este navegador; tendrás que
          elegirlo al volver a abrir la app.
        </p>
      ) : null}
    </section>
  )
}
