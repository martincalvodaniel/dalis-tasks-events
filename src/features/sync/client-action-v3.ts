"use client"

import { startTransition } from "react"
import { pushSyncOperationsV3 } from "@/features/sync/actions-v3"

// A distinct action reference prevents fallback to a captured generation-two dispatcher.
export function dispatchSyncOperationsV3(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await pushSyncOperationsV3(input))
      } catch (error) {
        reject(error)
      }
    })
  })
}
