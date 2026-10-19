"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { TagDeletionIncidentResolutionDialog } from "@/features/sync/components/tag-delete-incident-resolution-dialog"
import {
  readTagDeletionIncidentComparison,
  resolveTagDeletionIncident,
} from "@/features/sync/local-tag-delete-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableTagDeletionResolutionChoices } from "@/lib/sync/tag-delete-decision"
import { tagDeletionResolutionRequestSchema } from "@/schemas/tag-delete-resolution"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"
import type {
  TagDeletionResolutionRequest,
  TagDeletionResolutionSnapshot,
} from "@/types/tag-delete-resolution"

// The parent keys this component by account, epoch and operation to isolate frozen reviews.
export function TagDeletionIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PersonalSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [snapshot, setSnapshot] =
    useState<TagDeletionResolutionSnapshot | null>(null)
  const [choice, setChoice] =
    useState<TagDeletionResolutionRequest["choice"]>("adopt_remote")
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<TagDeletionResolutionRequest | null>(null),
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
    incident.entry.operation.command.type === "tag.delete" &&
    !incident.blockedByRelatedIntentions
  async function review() {
    if (!candidate || busy) return
    setBusy(true)
    setNotice("")
    intent.current = null
    try {
      const current = await readTagDeletionIncidentComparison(
        account,
        incident.entry.operation.operationId
      )
      if (
        !availableTagDeletionResolutionChoices(current, account.userId).length
      )
        throw new Error("Category deletion comparison has no supported choice")
      if (mounted.current) {
        setChoice("adopt_remote")
        setSnapshot(current)
      }
    } catch {
      if (mounted.current)
        setNotice(
          "No se puede resolver este borrado todavía. Tus cambios se conservan; puede haber otras dependencias o una versión nueva."
        )
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function confirm(resolutionId: string) {
    if (!snapshot) throw new Error("Category deletion review is missing")
    intent.current ??= tagDeletionResolutionRequestSchema.parse({
      userId: account.userId,
      resolutionId,
      operationId: choice === "retry_delete" ? crypto.randomUUID() : null,
      choice,
      createdAt: new Date().toISOString(),
      expected: snapshot,
    })
    setBusy(true)
    try {
      await resolveTagDeletionIncident(account, intent.current)
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
          {busy && !snapshot ? "Revisando…" : "Revisar eliminación"}
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
        <TagDeletionIncidentResolutionDialog
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
