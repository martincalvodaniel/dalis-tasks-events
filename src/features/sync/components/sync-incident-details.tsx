"use client"

import { useState } from "react"
import { SyncIncidentPanel } from "@/features/sync/components/sync-incident-panel"
import { useSyncIncidents } from "@/features/sync/hooks/use-sync-incidents"
import type { LocalAccount } from "@/features/workspace/local-account"

export function SyncIncidentDetails({
  account,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
}) {
  const [open, setOpen] = useState(false)
  const { data, error } = useSyncIncidents(account, open)
  return (
    <details
      className="mt-2 rounded-xl border border-zinc-200 px-3 text-sm dark:border-zinc-800"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        Ver conflictos y cambios rechazados
      </summary>
      {open ? (
        <SyncIncidentPanel
          incidents={data}
          error={Boolean(error)}
          account={account}
        />
      ) : null}
    </details>
  )
}
