"use client"

import { startTransition } from "react"
import { pushSyncOperationsV2 } from "@/features/sync/actions-v2"

// Dispatch through React so Next handles the compiled action reference.
export function dispatchSyncOperationsV2(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await pushSyncOperationsV2(input))
      } catch (error) {
        reject(error)
      }
    })
  })
}
