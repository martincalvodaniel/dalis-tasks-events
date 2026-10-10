"use client"

import { commonPlanReleaseEnabled } from "@/config/common-plan-release"
import { CalendarBoard } from "@/features/calendar/components/calendar-board"
import { PlanCalendarBoard } from "@/features/plans/components/plan-calendar-board"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"

export function CalendarScreen() {
  const Board = commonPlanReleaseEnabled ? PlanCalendarBoard : CalendarBoard
  const { account } = useLocalAccount()
  return account ? (
    <Board key={account.epoch} account={account} />
  ) : (
    <DeviceSettings />
  )
}
