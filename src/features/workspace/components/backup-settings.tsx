"use client"

import { useState } from "react"
import { downloadAccountBackup } from "@/features/workspace/download-backup"
import type { LocalAccount } from "@/features/workspace/local-account"

export function BackupSettings({
  account,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [requested, setRequested] = useState(false)
  async function download() {
    if (busy) return
    setBusy(true)
    setError(false)
    setRequested(false)
    try {
      await downloadAccountBackup(account)
      setRequested(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="mt-3 rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-800">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        Copia de seguridad
      </summary>
      <div className="space-y-2 pb-3">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Descarga los datos de este dispositivo y sus cambios pendientes,
          también sin conexión. La restauración desde archivo todavía no está
          disponible.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={download}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 font-medium dark:border-zinc-700"
        >
          {busy ? "Preparando copia…" : "Descargar copia JSON"}
        </button>
        {error ? (
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">
            No se pudo generar la copia. Comprueba que sigues en esta cuenta y
            vuelve a intentarlo. Tus datos se conservan; los formatos
            incompatibles o demasiado grandes requieren revisión.
          </p>
        ) : null}
        {requested ? (
          <p role="status" className="text-xs">
            Descarga solicitada. Guarda el archivo desde tu navegador; tus datos
            locales se conservan.
          </p>
        ) : null}
      </div>
    </details>
  )
}
