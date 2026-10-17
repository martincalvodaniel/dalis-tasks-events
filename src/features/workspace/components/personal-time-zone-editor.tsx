"use client"

import { useId, useState } from "react"
import { userSettingsInputSchema } from "@/schemas/preferences"

export function PersonalTimeZoneEditor({
  timeZone,
  onSave,
  onCancel,
}: {
  timeZone: string
  onSave(timeZone: string): Promise<void>
  onCancel(): void
}) {
  const id = useId()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const input = userSettingsInputSchema.safeParse({
      timeZone: new FormData(event.currentTarget).get("timeZone"),
      weekStartsOn: 1,
      locale: "es-ES",
    })
    if (!input.success) {
      setError("Introduce una zona válida, por ejemplo Europe/Madrid.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await onSave(input.data.timeZone)
    } catch {
      setError(
        "No se pudo guardar. Revisa la cuenta y vuelve a abrir este ajuste."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-2 space-y-2"
      aria-label="Editar zona horaria"
      aria-busy={busy}
    >
      <label htmlFor={id} className="text-xs text-zinc-600 dark:text-zinc-400">
        Zona horaria
      </label>
      <div className="flex min-w-0 gap-2">
        <input
          id={id}
          name="timeZone"
          defaultValue={timeZone}
          placeholder="Europe/Madrid"
          required
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          className="min-h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
        />
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="min-h-11 px-2 text-sm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 px-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
        >
          Guardar
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Ajusta Hoy y Atrasadas. No cambia las fechas ni la zona de tus planes.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  )
}
