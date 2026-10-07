"use client"

import { TaskAgenda } from "@/features/tasks/components/task-agenda"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"

export function WorkspaceOverview() {
  const { account } = useLocalAccount()
  if (!account) return <DeviceSettings />
  return <TaskAgenda key={account.epoch} account={account} />
}
