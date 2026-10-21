"use client"

import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { PlanOccurrenceCohortIncidentActions } from "@/features/sync/components/plan-occurrence-cohort-incident-actions"
import { PlanOccurrenceCopyActions } from "@/features/sync/components/plan-occurrence-copy-actions"
import { PlanOccurrenceResolutionDialog } from "@/features/sync/components/plan-occurrence-resolution-dialog"
import { resolvePlanOccurrenceIncident } from "@/features/sync/local-plan-occurrence-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { canReviewPlanOccurrenceCohort } from "@/lib/sync/plan-occurrence-cohort-review"
import {
  availablePlanOccurrenceResolutionChoices,
  planOccurrenceRetryOperationCount,
} from "@/lib/sync/plan-occurrence-resolution"
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
  const [selection, setSelection] = useState<{
    choice: PlanOccurrenceResolutionRequest["choice"]
    incident: PlanOccurrenceSyncIncidentSnapshot
  } | null>(null)
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<PlanOccurrenceResolutionRequest | null>(null)
  const choices =
    incident.entry.userId === account.userId && activeProductSyncProtocol === 6
      ? availablePlanOccurrenceResolutionChoices(incident)
      : []
  function choose(choice: PlanOccurrenceResolutionRequest["choice"]) {
    intent.current = null
    setNotice("")
    setSelection({ choice, incident })
  }
  async function confirm(resolutionId: string) {
    if (!selection) throw new Error("Appearance recovery choice is missing")
    if (!intent.current) {
      const count =
        selection.choice === "retry_local"
          ? planOccurrenceRetryOperationCount(selection.incident)
          : 0
      intent.current = planOccurrenceResolutionRequestSchema.parse({
        userId: account.userId,
        resolutionId,
        operationId: count ? crypto.randomUUID() : null,
        ...(count
          ? {
              dependentOperationIds: Array.from({ length: count - 1 }, () =>
                crypto.randomUUID()
              ),
            }
          : {}),
        choice: selection.choice,
        createdAt: new Date().toISOString(),
        expected: selection.incident,
      })
    }
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
  if (
    activeProductSyncProtocol === 6 &&
    canReviewPlanOccurrenceCohort(incident, account.userId)
  )
    return (
      <PlanOccurrenceCohortIncidentActions
        key={`${account.userId}:${account.epoch}:${incident.entry.operation.operationId}`}
        account={account}
        operationId={incident.entry.operation.operationId}
      />
    )
  return (
    <div>
      {choices.length ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700"
            onClick={() => choose("adopt_remote")}
          >
            Usar aparición remota
          </button>
          {choices.includes("retry_local") ? (
            <button
              type="button"
              className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white"
              onClick={() => choose("retry_local")}
            >
              Enviar mi aparición
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Tus cambios se conservan. Este caso necesita otra revisión antes de
          poder elegir.
        </p>
      )}
      <PlanOccurrenceCopyActions
        key={`${account.userId}:${account.epoch}:${incident.entry.operation.operationId}`}
        account={account}
        incident={incident}
      />
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {selection ? (
        <PlanOccurrenceResolutionDialog
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
