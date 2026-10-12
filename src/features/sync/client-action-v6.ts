"use client"

import { startTransition } from "react"
import { pushSyncOperationsV6 } from "@/features/sync/actions-v6"

// A distinct action reference prevents fallback to a captured generation-five dispatcher.
export function dispatchSyncOperationsV6(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await pushSyncOperationsV6(input))
      } catch (error) {
        reject(error)
      }
    })
  })
}
