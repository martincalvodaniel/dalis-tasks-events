"use client"

import { CalendarBoard } from "@/features/calendar/components/calendar-board"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"

export function CalendarScreen() {
  const { account } = useLocalAccount()
  return account ? (
    <CalendarBoard key={account.epoch} account={account} />
  ) : (
    <DeviceSettings />
  )
}
