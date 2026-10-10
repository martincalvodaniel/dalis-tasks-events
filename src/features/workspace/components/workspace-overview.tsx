"use client"

import { commonPlanReleaseEnabled } from "@/config/common-plan-release"
import { EventAgenda } from "@/features/events/components/event-agenda"
import { PlanAgenda } from "@/features/plans/components/plan-agenda"
import { TaskAgenda } from "@/features/tasks/components/task-agenda"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"

export function WorkspaceOverview() {
  const { account } = useLocalAccount()
  if (!account) return <DeviceSettings />
  if (commonPlanReleaseEnabled)
    return <PlanAgenda key={account.epoch} account={account} />
  return (
    <>
      <TaskAgenda key={`tasks-${account.epoch}`} account={account} />
      <EventAgenda key={`events-${account.epoch}`} account={account} />
    </>
  )
}
