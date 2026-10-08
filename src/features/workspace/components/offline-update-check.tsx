"use client"

import { useState } from "react"
import { checkOfflineUpdate } from "@/lib/pwa/client"

const messages = {
  waiting:
    "Actualización lista. Guarda lo que tengas abierto, cierra todas las pestañas de Dalis y vuelve a abrir. Tus cambios pendientes se conservan.",
  installing:
    "Preparando la actualización. Puedes seguir trabajando; aparecerá un aviso cuando esté lista.",
  current:
    "No hay otra versión preparada. Si sigue la incompatibilidad, vuelve a comprobar más tarde; tus cambios se conservan.",
  offline:
    "Necesitas conexión para comprobar actualizaciones. Tus cambios se conservan.",
  unavailable:
    "Este dispositivo no tiene una versión offline activa. Guarda lo que tengas abierto y vuelve a abrir con conexión; tus cambios se conservan.",
}

export function OfflineUpdateCheck() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function check() {
    if (busy) return
    setBusy(true)
    try {
      setMessage(messages[await checkOfflineUpdate()])
    } catch {
      setMessage(
        "No se pudo comprobar la actualización. Vuelve a intentarlo con conexión; tus cambios se conservan."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={check}
        className="min-h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700"
      >
        {busy ? "Comprobando…" : "Comprobar actualización"}
      </button>
      {message ? (
        <p role="status" className="mt-1 text-xs">
          {message}
        </p>
      ) : null}
    </div>
  )
}
