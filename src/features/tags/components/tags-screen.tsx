"use client"

import { TagManager } from "@/features/tags/components/tag-manager"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"

export function TagsScreen() {
  const { account } = useLocalAccount()
  return account ? (
    <TagManager key={account.epoch} account={account} />
  ) : (
    <DeviceSettings />
  )
}
