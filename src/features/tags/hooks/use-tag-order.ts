"use client"

import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { changeLocalTagOrder } from "@/features/tags/local-tags"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { LocalPreferenceCommand } from "@/types/local-sync"

export function useTagOrder(account: LocalAccount) {
  const { mutate } = useLocalTags(account)
  return useLocalIntent<Extract<LocalPreferenceCommand, { type: "tag.move" }>>(
    (command, operationId) =>
      changeLocalTagOrder(account, command, operationId),
    () => mutate()
  )
}
