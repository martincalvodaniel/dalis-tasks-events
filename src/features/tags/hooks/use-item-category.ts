"use client"

import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { assignLocalCategory } from "@/features/tags/local-tags"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useItemCategory(account: LocalAccount) {
  const { mutate } = useLocalTags(account)
  return useLocalIntent<{ itemId: string; tagId: string | null }>(
    (command, operationId) =>
      assignLocalCategory(account, command.itemId, command.tagId, operationId),
    () => mutate()
  )
}
