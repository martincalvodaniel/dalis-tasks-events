"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { PlanCategoryIncidentResolutionDialog } from "@/features/sync/components/plan-category-incident-resolution-dialog"
import {
  readPlanCategoryIncidentComparison,
  resolvePlanCategoryIncident,
} from "@/features/sync/local-plan-category-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableReviewedPlanCategoryResolutionChoices } from "@/lib/sync/plan-category-resolution"
import { planCategoryResolutionRequestSchema } from "@/schemas/plan-category-resolution"
import type {
  PlanCategoryResolutionRequest,
  PlanCategoryResolutionSnapshot,
} from "@/types/plan-category-resolution"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

// The parent keys this component by account, epoch and operation to isolate frozen reviews.
export function PlanCategoryIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: SyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [snapshot, setSnapshot] =
    useState<PlanCategoryResolutionSnapshot | null>(null)
  const [choice, setChoice] =
    useState<PlanCategoryResolutionRequest["choice"]>("adopt_remote")
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<PlanCategoryResolutionRequest | null>(null),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const candidate =
    activeProductSyncProtocol === 6 &&
    account.userId === incident.entry.userId &&
    incident.reason === "conflict" &&
    incident.blockedByRelatedIntentions &&
    incident.local?.kind === "plan" &&
    incident.remote?.kind === "plan" &&
    incident.local.ownerId === account.userId &&
    incident.remote.ownerId === account.userId &&
    !incident.local.recurrence &&
    !incident.remote.recurrence &&
    !incident.local.deletedAt &&
    !incident.remote.deletedAt
  async function review() {
    if (!candidate || busy) return
    setBusy(true)
    setNotice("")
    intent.current = null
    try {
      const current = await readPlanCategoryIncidentComparison(
        account,
        incident.entry.operation.operationId
      )
      if (
        !availableReviewedPlanCategoryResolutionChoices(current, account.userId)
          .length
      )
        throw new Error("Joint comparison has no supported choice")
      if (mounted.current) {
        setChoice("adopt_remote")
        setSnapshot(current)
      }
    } catch {
      if (mounted.current)
        setNotice(
          "No se puede resolver este grupo todavía. Tus cambios se conservan; puede haber otras dependencias o una versión nueva."
        )
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function confirm(resolutionId: string) {
    if (!snapshot) throw new Error("Joint review is missing")
    intent.current ??= planCategoryResolutionRequestSchema.parse({
      userId: account.userId,
      resolutionId,
      operationId: choice === "retry_local" ? crypto.randomUUID() : null,
      viewOperationId: choice === "retry_local" ? crypto.randomUUID() : null,
      choice,
      createdAt: new Date().toISOString(),
      expected: snapshot,
    })
    setBusy(true)
    try {
      await resolvePlanCategoryIncident(account, intent.current)
      if (mounted.current) setSnapshot(null)
      try {
        await requireActiveAccount(account)
        await mutate((key) =>
          isAccountSyncCacheKey(key, account.userId, account.epoch)
        )
      } catch {
        if (mounted.current)
          setNotice("Elección guardada. Recarga para actualizar la vista.")
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <div>
      {candidate ? (
        <button
          type="button"
          disabled={busy}
          onClick={review}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {busy && !snapshot ? "Revisando…" : "Revisar plan y categoría"}
        </button>
      ) : (
        <p className="text-xs text-zinc-500">
          {incident.blockedByRelatedIntentions
            ? "Hay cambios relacionados fuera de este elemento. Se conservan; su resolución todavía no está disponible."
            : "Tus cambios se conservan. Este caso todavía necesita un flujo de recuperación distinto."}
        </p>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {snapshot ? (
        <PlanCategoryIncidentResolutionDialog
          snapshot={snapshot}
          actor={account.userId}
          choice={choice}
          busy={busy}
          onSelect={(value) => {
            if (!busy) {
              intent.current = null
              setChoice(value)
            }
          }}
          onConfirm={confirm}
          onClose={() => {
            if (!busy) {
              intent.current = null
              setSnapshot(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
