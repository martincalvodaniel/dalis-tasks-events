"use client"

import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { SettingsIncidentResolutionDialog } from "@/features/sync/components/settings-incident-resolution-dialog"
import { resolveSettingsIncident } from "@/features/sync/local-settings-resolution"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { availableSettingsResolutionChoices } from "@/lib/sync/settings-resolution"
import { settingsResolutionRequestSchema } from "@/schemas/settings-resolution"
import type { SettingsResolutionRequest } from "@/types/settings-resolution"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"

export function SettingsIncidentActions({
  account,
  incident,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  incident: PersonalSyncIncidentSnapshot
}) {
  const { mutate } = useSWRConfig()
  const [selection, setSelection] = useState<{
    choice: SettingsResolutionRequest["choice"]
    incident: PersonalSyncIncidentSnapshot
  } | null>(null)
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("")
  const intent = useRef<SettingsResolutionRequest | null>(null)
  const choices =
    activeProductSyncProtocol === 6
      ? availableSettingsResolutionChoices(incident)
      : []
  function choose(choice: SettingsResolutionRequest["choice"]) {
    intent.current = null
    setNotice("")
    setSelection({ choice, incident })
  }
  async function confirm(resolutionId: string) {
    if (!selection) throw new Error("Settings recovery choice is missing")
    intent.current ??= settingsResolutionRequestSchema.parse({
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
      await resolveSettingsIncident(account, intent.current)
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
            Usar zona remota
          </button>
          {choices.includes("retry_local") ? (
            <button
              type="button"
              onClick={() => choose("retry_local")}
              className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white"
            >
              Enviar mi zona
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Tus cambios de zona se conservan. Este caso necesita otra revisión
          antes de poder elegir.
        </p>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      ) : null}
      {selection ? (
        <SettingsIncidentResolutionDialog
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
