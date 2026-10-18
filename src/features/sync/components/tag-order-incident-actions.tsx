"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { TagOrderIncidentResolutionDialog } from "@/features/sync/components/tag-order-incident-resolution-dialog"
import {
  readTagOrderIncidentComparison,
  resolveTagOrderIncident,
} from "@/features/sync/local-tag-order-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableTagOrderResolutionChoices } from "@/lib/sync/tag-order-decision"
import { tagOrderResolutionRequestSchema } from "@/schemas/tag-order-resolution"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"
import type {
  TagOrderResolutionRequest,
  TagOrderResolutionSnapshot,
} from "@/types/tag-order-resolution"

// The parent keys this component by account, epoch and operation to isolate frozen reviews.
export function TagOrderIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PersonalSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [snapshot, setSnapshot] = useState<TagOrderResolutionSnapshot | null>(
    null
  )
  const [choice, setChoice] =
    useState<TagOrderResolutionRequest["choice"]>("adopt_remote")
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<TagOrderResolutionRequest | null>(null),
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
    incident.entry.operation.command.type === "tag.move" &&
    !incident.blockedByRelatedIntentions
  async function review() {
    if (!candidate || busy) return
    setBusy(true)
    setNotice("")
    intent.current = null
    try {
      const current = await readTagOrderIncidentComparison(
        account,
        incident.entry.operation.operationId
      )
      if (!availableTagOrderResolutionChoices(current, account.userId).length)
        throw new Error("Category order comparison has no supported choice")
      if (mounted.current) {
        setChoice("adopt_remote")
        setSnapshot(current)
      }
    } catch {
      if (mounted.current)
        setNotice(
          "No se puede resolver este orden todavía. Tus cambios se conservan; puede haber otras dependencias o una versión nueva."
        )
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function confirm(resolutionId: string) {
    if (!snapshot) throw new Error("Category order review is missing")
    intent.current ??= tagOrderResolutionRequestSchema.parse({
      userId: account.userId,
      resolutionId,
      operationId: choice === "retry_latest_move" ? crypto.randomUUID() : null,
      choice,
      createdAt: new Date().toISOString(),
      expected: snapshot,
    })
    setBusy(true)
    try {
      await resolveTagOrderIncident(account, intent.current)
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
          {busy && !snapshot ? "Revisando…" : "Revisar orden"}
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
        <TagOrderIncidentResolutionDialog
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
