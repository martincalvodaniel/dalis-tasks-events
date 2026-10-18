"use client"

import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { PlanOccurrenceResolutionDialog } from "@/features/sync/components/plan-occurrence-resolution-dialog"
import { resolvePlanOccurrenceIncident } from "@/features/sync/local-plan-occurrence-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availablePlanOccurrenceResolutionChoices } from "@/lib/sync/plan-occurrence-resolution"
import { planOccurrenceResolutionRequestSchema } from "@/schemas/plan-occurrence-resolution"
import type { PlanOccurrenceResolutionRequest } from "@/types/plan-occurrence-resolution"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

export function PlanOccurrenceIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PlanOccurrenceSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [selection, setSelection] =
    useState<PlanOccurrenceSyncIncidentSnapshot | null>(null)
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<PlanOccurrenceResolutionRequest | null>(null)
  const available =
    incident.entry.userId === account.userId &&
    activeProductSyncProtocol === 6 &&
    availablePlanOccurrenceResolutionChoices(incident).includes("adopt_remote")
  async function confirm(resolutionId: string) {
    if (!selection) throw new Error("Appearance recovery choice is missing")
    intent.current ??= planOccurrenceResolutionRequestSchema.parse({
      userId: account.userId,
      resolutionId,
      operationId: null,
      choice: "adopt_remote",
      createdAt: new Date().toISOString(),
      expected: selection,
    })
    setBusy(true)
    try {
      await resolvePlanOccurrenceIncident(account, intent.current)
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
      {available ? (
        <button
          type="button"
          className="min-h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700"
          onClick={() => {
            intent.current = null
            setNotice("")
            setSelection(incident)
          }}
        >
          Usar aparición remota
        </button>
      ) : (
        <p className="text-xs text-zinc-500">
          Tus cambios se conservan. Este caso necesita otra revisión antes de
          poder elegir.
        </p>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {selection ? (
        <PlanOccurrenceResolutionDialog
          incident={selection}
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
