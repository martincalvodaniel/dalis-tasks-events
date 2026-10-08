"use client"

import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { SyncIncidentResolutionDialog } from "@/features/sync/components/sync-incident-resolution-dialog"
import { resolveSyncIncident } from "@/features/sync/local-incidents"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableSyncIncidentResolutionChoices } from "@/lib/sync/incident-resolution"
import { syncResolutionRequestSchema } from "@/schemas/sync-resolution"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"
import type { SyncResolutionRequest } from "@/types/sync-resolution"

type Selection = {
  choice: SyncResolutionRequest["choice"]
  incident: SyncIncidentSnapshot
}
export function SyncIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: SyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [selection, setSelection] = useState<Selection | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const intent = useRef<SyncResolutionRequest | null>(null)
  const choices = availableSyncIncidentResolutionChoices(incident)
  function choose(choice: SyncResolutionRequest["choice"]) {
    intent.current = null
    setNotice("")
    setSelection({ choice, incident })
  }
  async function confirm(resolutionId: string) {
    if (!selection) throw new Error("Resolution choice is missing")
    intent.current ??= syncResolutionRequestSchema.parse({
      userId: account.userId,
      expected: selection.incident,
      choice: selection.choice,
      resolutionId,
      operationId:
        selection.choice === "retry_local" ? crypto.randomUUID() : null,
      createdAt: new Date().toISOString(),
    })
    setBusy(true)
    try {
      await resolveSyncIncident(account, intent.current)
      setSelection(null)
      try {
        await requireActiveAccount(account)
        await mutate((key) =>
          isAccountSyncCacheKey(key, account.userId, account.epoch)
        )
      } catch {
        setNotice("Elección guardada. Recarga para actualizar la vista.")
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      {choices.length === 0 ? (
        <p className="text-xs text-zinc-500">
          {incident.blockedByRelatedIntentions
            ? "Hay cambios relacionados fuera de este elemento. Se conservan; su resolución todavía no está disponible."
            : "Tus cambios se conservan. Este caso todavía necesita un flujo de recuperación distinto."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700"
            onClick={() => choose("adopt_remote")}
          >
            Usar remoto conocido
          </button>
          {choices.includes("retry_local") ? (
            <button
              type="button"
              className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white"
              onClick={() => choose("retry_local")}
            >
              {incident.local?.deletedAt
                ? "Enviar borrado local"
                : "Enviar mi borrador"}
            </button>
          ) : null}
        </div>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {selection ? (
        <SyncIncidentResolutionDialog
          incident={selection.incident}
          choice={selection.choice}
          busy={busy}
          onConfirm={confirm}
          onClose={() => {
            if (!busy) setSelection(null)
          }}
        />
      ) : null}
    </div>
  )
}
