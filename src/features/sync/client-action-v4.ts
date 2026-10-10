"use client"

import { startTransition } from "react"
import { pushSyncOperationsV4 } from "@/features/sync/actions-v4"

// A distinct action reference prevents fallback to a captured generation-three dispatcher.
export function dispatchSyncOperationsV4(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await pushSyncOperationsV4(input))
      } catch (error) {
        reject(error)
      }
    })
  })
}
