"use client"
import useSWR from "swr"
import { PersonalTimeZoneInfo } from "@/features/workspace/components/personal-time-zone-info"
import type { LocalAccount } from "@/features/workspace/local-account"
import { readLocalPersonalSettings } from "@/features/workspace/local-personal-settings"
export function PersonalTimeZoneSettings({
  account,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
}) {
  const { data, error } = useSWR(
    ["dalis:personal-settings", account.userId, account.epoch],
    () => readLocalPersonalSettings(account),
    { shouldRetryOnError: false, keepPreviousData: false }
  )
  return (
    <PersonalTimeZoneInfo
      timeZone={data === undefined ? undefined : (data?.timeZone ?? null)}
      unavailable={Boolean(error)}
    />
  )
}
