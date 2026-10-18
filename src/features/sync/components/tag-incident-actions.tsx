"use client"

import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { TagIncidentResolutionDialog } from "@/features/sync/components/tag-incident-resolution-dialog"
import { resolveTagIncident } from "@/features/sync/local-tag-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableTagResolutionChoices } from "@/lib/sync/tag-resolution"
import { tagResolutionRequestSchema } from "@/schemas/tag-resolution"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"
import type { TagResolutionRequest } from "@/types/tag-resolution"

export function TagIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PersonalSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [selection, setSelection] = useState<{
    choice: TagResolutionRequest["choice"]
    incident: PersonalSyncIncidentSnapshot
  } | null>(null)
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<TagResolutionRequest | null>(null)
  const choices =
    activeProductSyncProtocol === 6 && account.userId === incident.entry.userId
      ? availableTagResolutionChoices(incident)
      : []
  function choose(choice: TagResolutionRequest["choice"]) {
    intent.current = null
    setNotice("")
    setSelection({ choice, incident })
  }
  async function confirm(resolutionId: string) {
    if (!selection) throw new Error("Tag recovery choice is missing")
    intent.current ??= tagResolutionRequestSchema.parse({
      userId: account.userId,
      resolutionId,
      operationId:
        selection.choice === "retry_local" ? crypto.randomUUID() : null,
      choice: selection.choice,
      createdAt: new Date().toISOString(),
      expected: selection.incident,
    })
    setBusy(true)
    try {
      await resolveTagIncident(account, intent.current)
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
      {choices.length ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose("adopt_remote")}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700"
          >
            Usar categoría remota
          </button>
          {choices.includes("retry_local") ? (
            <button
              type="button"
              onClick={() => choose("retry_local")}
              className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white"
            >
              Enviar mi categoría
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Tus cambios de categoría se conservan. Este caso necesita otra
          revisión antes de poder elegir.
        </p>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {selection ? (
        <TagIncidentResolutionDialog
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
