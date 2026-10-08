"use client"

import { useEffect, useState } from "react"
import { observeOfflineUpdates } from "@/lib/pwa/client"

export function UpdateNotice() {
  const [waiting, setWaiting] = useState(false)
  useEffect(() => observeOfflineUpdates(() => setWaiting(true)), [])
  if (!waiting) return null
  return (
    <aside
      className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-semibold">Actualización disponible</p>
      <p className="mt-1">
        Guarda lo que tengas abierto, cierra todas las pestañas de Dalis y
        vuelve a abrir la aplicación. Tus datos y cambios pendientes se
        conservan.
      </p>
    </aside>
  )
}
