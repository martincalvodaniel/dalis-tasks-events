"use client"
import { useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import { PersonalTimeZoneEditor } from "@/features/workspace/components/personal-time-zone-editor"
import { PersonalTimeZoneInfo } from "@/features/workspace/components/personal-time-zone-info"
import type { LocalAccount } from "@/features/workspace/local-account"
import {
  readLocalPersonalSettings,
  saveLocalPersonalSettings,
} from "@/features/workspace/local-personal-settings"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import type { UserSettings } from "@/types/preferences"

export function PersonalTimeZoneSettings({
  account,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
}) {
  const { mutate } = useSWRConfig()
  const [editing, setEditing] = useState<{
    settings: UserSettings | null
  } | null>(null)
  const [saved, setSaved] = useState(false)
  const { data, error } = useSWR(
    ["dalis:personal-settings", account.userId, account.epoch],
    () => readLocalPersonalSettings(account),
    { shouldRetryOnError: false, keepPreviousData: false }
  )
  async function save(timeZone: string) {
    if (!editing) throw new Error("Personal settings are not loaded")
    const captured = { userId: account.userId, epoch: account.epoch }
    await saveLocalPersonalSettings(
      captured,
      { timeZone, weekStartsOn: 1, locale: "es-ES" },
      editing.settings
    )
    await requireActiveAccount(captured)
    await mutate((key) =>
      isAccountSyncCacheKey(key, captured.userId, captured.epoch)
    )
    await requireActiveAccount(captured)
    setEditing(null)
    setSaved(true)
  }
  return (
    <section aria-label="Zona horaria personal">
      <PersonalTimeZoneInfo
        timeZone={data === undefined ? undefined : (data?.timeZone ?? null)}
        unavailable={Boolean(error)}
      />
      {activeProductSyncProtocol === 6 ? (
        editing ? (
          <PersonalTimeZoneEditor
            key={`${account.userId}:${account.epoch}`}
            timeZone={editing.settings?.timeZone ?? "UTC"}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p role="status" className="text-xs text-zinc-500">
              {saved
                ? "Guardado en este dispositivo; se sincronizará cuando haya conexión."
                : "Se sincroniza con tu cuenta."}
            </p>
            <button
              type="button"
              disabled={data === undefined || Boolean(error)}
              onClick={() => {
                setSaved(false)
                setEditing({ settings: data ?? null })
              }}
              className="min-h-11 px-2 text-sm font-medium"
            >
              Editar zona
            </button>
          </div>
        )
      ) : null}
    </section>
  )
}
