"use client"

import { useContext } from "react"
import { workspaceDestinations } from "@/config/navigation"
import { SyncContext } from "@/features/sync/sync-context"

export function SyncIssueNotice() {
  const state = useContext(SyncContext)
  if (!state) return null
  const count = (state.summary?.conflicts ?? 0) + (state.summary?.rejected ?? 0)
  const status = state.result?.status
  const paused =
    status === "unauthorized" ||
    status === "account_changed" ||
    status === "recovery_required"
  if (count === 0 && !paused) return null
  const settings = workspaceDestinations.find(
    (destination) => destination.id === "settings"
  )
  return (
    <p
      role="status"
      className="mt-3 text-sm text-amber-800 dark:text-amber-300"
    >
      {count > 0
        ? `${count} ${count === 1 ? "cambio necesita" : "cambios necesitan"} revisión.`
        : "Sincronización pausada."}{" "}
      <a
        href={settings?.href}
        className="inline-flex min-h-11 items-center underline underline-offset-2"
      >
        Revisar en Ajustes
      </a>
    </p>
  )
}
