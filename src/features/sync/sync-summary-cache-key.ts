"use client"

import type { AccountIdentity } from "@/features/sync/mixed-sync-client-core"
import { userIdSchema } from "@/schemas/primitives"
import { accountControlSchema } from "@/schemas/workspace"

// Negotiation generations never share an SWR summary entry; account positions remain stable.
export function mixedSyncSummaryCacheKey(
  account: AccountIdentity,
  protocol: 2 | 3
) {
  if (protocol !== 2 && protocol !== 3)
    throw new Error("Unsupported mixed sync cache generation")
  return [
    "dalis:sync-queue",
    userIdSchema.parse(account.userId),
    accountControlSchema.shape.epoch.parse(account.epoch),
    protocol,
  ] as const
}
