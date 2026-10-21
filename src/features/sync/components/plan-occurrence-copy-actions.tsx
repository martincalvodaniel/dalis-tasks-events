"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { PlanOccurrenceCopyDialog } from "@/features/sync/components/plan-occurrence-copy-dialog"
import {
  readPlanOccurrenceCopyComparison,
  resolvePlanOccurrenceCopy,
} from "@/features/sync/local-plan-occurrence-copy"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import {
  canCopyPlanOccurrenceIncident,
  planOccurrenceCopy,
} from "@/lib/sync/plan-occurrence-copy"
import { planOccurrenceCopyRequestSchema } from "@/schemas/plan-occurrence-copy"
import type { PlanOccurrenceCopyRequest } from "@/types/plan-occurrence-copy"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

export function PlanOccurrenceCopyActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PlanOccurrenceSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig(),
    mounted = useRef(false),
    [selection, setSelection] = useState<{
      request: PlanOccurrenceCopyRequest
      epoch: string
    } | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const available =
    activeProductSyncProtocol === 6 &&
    account.userId === incident.entry.userId &&
    canCopyPlanOccurrenceIncident(incident, account.userId)
  async function choose() {
    setBusy(true)
    setNotice("")
    try {
      const expected = await readPlanOccurrenceCopyComparison(
          account,
          incident.entry.operation.operationId
        ),
        request = planOccurrenceCopyRequestSchema.parse({
          reviewKind: "occurrence_copy",
          choice: "copy_local",
          userId: account.userId,
          resolutionId: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
          copyItemId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          expected,
        })
      planOccurrenceCopy(request, expected)
      if (mounted.current) setSelection({ request, epoch: account.epoch })
    } catch {
      if (mounted.current)
        setNotice(
          "No se pudo revisar la aparición. Tus cambios se conservan; vuelve a intentarlo."
        )
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function confirm() {
    if (
      !selection ||
      selection.epoch !== account.epoch ||
      selection.request.userId !== account.userId
    )
      throw new Error("Appearance copy review belongs to another account epoch")
    setBusy(true)
    try {
      await resolvePlanOccurrenceCopy(account, selection.request)
      if (!mounted.current) return
      setSelection(null)
      try {
        await requireActiveAccount(account)
        if (mounted.current)
          await mutate((key) =>
            isAccountSyncCacheKey(key, account.userId, account.epoch)
          )
      } catch {
        if (mounted.current)
          setNotice("Copia guardada. Recarga para actualizar la vista.")
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  if (!available && !selection) return null
  return (
    <div className="mt-2">
      {available ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void choose()}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 disabled:opacity-50 dark:border-zinc-700"
        >
          {busy && !selection ? "Revisando…" : "Crear copia de este día"}
        </button>
      ) : null}
      {notice ? (
        <p role="status" className="mt-1 text-xs">
          {notice}
        </p>
      ) : null}
      {selection &&
      selection.epoch === account.epoch &&
      selection.request.userId === account.userId ? (
        <PlanOccurrenceCopyDialog
          request={selection.request}
          actor={account.userId}
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
