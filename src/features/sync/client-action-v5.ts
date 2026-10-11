"use client"

import { startTransition } from "react"
import { pushSyncOperationsV5 } from "@/features/sync/actions-v5"

// A distinct action reference prevents fallback to a captured generation-four dispatcher.
export function dispatchSyncOperationsV5(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await pushSyncOperationsV5(input))
      } catch (error) {
        reject(error)
      }
    })
  })
}
