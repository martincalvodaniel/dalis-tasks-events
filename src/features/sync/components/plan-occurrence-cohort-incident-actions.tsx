"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { PlanOccurrenceCohortResolutionDialog } from "@/features/sync/components/plan-occurrence-cohort-resolution-dialog"
import {
  readPlanOccurrenceCohortComparison,
  resolvePlanOccurrenceCohort,
} from "@/features/sync/local-plan-occurrence-cohort-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import {
  availablePlanOccurrenceCohortResolutionChoices,
  planOccurrenceCohortRetryOperationCount,
} from "@/lib/sync/plan-occurrence-cohort-resolution"
import { planOccurrenceCohortResolutionRequestSchema } from "@/schemas/plan-occurrence-cohort-resolution"
import type { PlanOccurrenceCohortComparison } from "@/types/plan-occurrence-cohort-comparison"
import type { PlanOccurrenceCohortResolutionRequest } from "@/types/plan-occurrence-cohort-resolution"

// The parent keys this review by account, transition epoch and conflict root.
export function PlanOccurrenceCohortIncidentActions({
  account,
  operationId,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  operationId: string
}) {
  const { mutate } = useSWRConfig()
  const [snapshot, setSnapshot] =
    useState<PlanOccurrenceCohortComparison | null>(null)
  const [choice, setChoice] =
    useState<PlanOccurrenceCohortResolutionRequest["choice"]>("adopt_remote")
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<PlanOccurrenceCohortResolutionRequest | null>(null),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function review() {
    if (busy || snapshot) return
    setBusy(true)
    setNotice("")
    intent.current = null
    try {
      const current = await readPlanOccurrenceCohortComparison(
        account,
        operationId
      )
      if (
        !availablePlanOccurrenceCohortResolutionChoices(current, account.userId)
          .length
      )
        throw new Error("Joint appearance review has no supported choice")
      if (mounted.current) {
        setChoice("adopt_remote")
        setSnapshot(current)
      }
    } catch {
      if (mounted.current)
        setNotice(
          "No se pueden resolver estas fechas todavía. Tus cambios se conservan; puede haber otras dependencias o versiones nuevas."
        )
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function confirm(resolutionId: string) {
    if (!snapshot) throw new Error("Joint appearance review is missing")
    if (!intent.current) {
      const count =
        choice === "retry_local"
          ? planOccurrenceCohortRetryOperationCount(snapshot)
          : 0
      intent.current = planOccurrenceCohortResolutionRequestSchema.parse({
        userId: account.userId,
        resolutionId,
        operationIds: Array.from({ length: count }, () => crypto.randomUUID()),
        choice,
        createdAt: new Date().toISOString(),
        expected: snapshot,
      })
    }
    setBusy(true)
    try {
      await resolvePlanOccurrenceCohort(account, intent.current)
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
      <button
        type="button"
        disabled={busy}
        onClick={review}
        className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
      >
        {busy && !snapshot ? "Revisando…" : "Revisar fechas relacionadas"}
      </button>
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {snapshot ? (
        <PlanOccurrenceCohortResolutionDialog
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
