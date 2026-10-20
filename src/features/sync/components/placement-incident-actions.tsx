"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { PlacementIncidentResolutionDialog } from "@/features/sync/components/placement-incident-resolution-dialog"
import { resolveMixedPlacementIncident } from "@/features/sync/local-mixed-placement-resolution"
import {
  readPlacementIncidentComparison,
  resolvePlacementIncident,
} from "@/features/sync/local-placement-resolution"
import { resolveRecurringPlacementIncident } from "@/features/sync/local-recurring-placement-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableMixedPlacementResolutionChoices } from "@/lib/sync/mixed-placement-decision"
import { availablePlacementResolutionChoices } from "@/lib/sync/placement-decision"
import { availableRecurringPlacementResolutionChoices } from "@/lib/sync/recurring-placement-decision"
import { mixedPlacementResolutionRequestSchema } from "@/schemas/mixed-placement-resolution"
import { placementResolutionRequestSchema } from "@/schemas/placement-resolution"
import { recurringPlacementResolutionRequestSchema } from "@/schemas/recurring-placement-resolution"
import type { MixedPlacementResolutionRequest } from "@/types/mixed-placement-resolution"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"
import type { RecurringPlacementResolutionRequest } from "@/types/recurring-placement-resolution"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"

// The parent keys this component by account, epoch and operation to isolate frozen reviews.
export function PlacementIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PersonalSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [snapshot, setSnapshot] = useState<PlacementResolutionSnapshot | null>(
    null
  )
  const [reviewKind, setReviewKind] = useState<
    "mixed_group" | "recurring_primary" | undefined
  >(undefined)
  const [choice, setChoice] =
    useState<PlacementResolutionRequest["choice"]>("adopt_remote")
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<
      | PlacementResolutionRequest
      | MixedPlacementResolutionRequest
      | RecurringPlacementResolutionRequest
      | null
    >(null),
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
    incident.entry.operation.command.type === "task.move" &&
    !incident.blockedByRelatedIntentions
  async function review() {
    if (!candidate || busy) return
    setBusy(true)
    setNotice("")
    intent.current = null
    try {
      const current = await readPlacementIncidentComparison(
        account,
        incident.entry.operation.operationId
      )
      const simple =
        availablePlacementResolutionChoices(current, account.userId).length > 0
      const mixed =
        availableMixedPlacementResolutionChoices(current, account.userId)
          .length > 0
      const recurring =
        availableRecurringPlacementResolutionChoices(current, account.userId)
          .length > 0
      if (!simple && !mixed && !recurring)
        throw new Error("Plan order comparison has no supported choice")
      if (mounted.current) {
        setReviewKind(
          simple ? undefined : mixed ? "mixed_group" : "recurring_primary"
        )
        setChoice("adopt_remote")
        setSnapshot(current)
      }
    } catch {
      if (mounted.current)
        setNotice(
          "No se puede resolver este orden de planes todavía. Tus cambios se conservan; puede haber otras dependencias o una versión nueva."
        )
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function confirm(resolutionId: string) {
    if (!snapshot) throw new Error("Plan order review is missing")
    intent.current ??= (
      reviewKind === "recurring_primary"
        ? recurringPlacementResolutionRequestSchema
        : reviewKind === "mixed_group"
          ? mixedPlacementResolutionRequestSchema
          : placementResolutionRequestSchema
    ).parse({
      ...(reviewKind ? { reviewKind } : {}),
      userId: account.userId,
      resolutionId,
      operationId: choice === "retry_latest_move" ? crypto.randomUUID() : null,
      choice,
      createdAt: new Date().toISOString(),
      expected: snapshot,
    })
    setBusy(true)
    try {
      if ("reviewKind" in intent.current) {
        if (intent.current.reviewKind === "recurring_primary")
          await resolveRecurringPlacementIncident(account, intent.current)
        else await resolveMixedPlacementIncident(account, intent.current)
      } else await resolvePlacementIncident(account, intent.current)
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
          {busy && !snapshot ? "Revisando…" : "Revisar orden de planes"}
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
        <PlacementIncidentResolutionDialog
          snapshot={snapshot}
          reviewKind={reviewKind}
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
