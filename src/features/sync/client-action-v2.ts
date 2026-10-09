"use client"

import { startTransition } from "react"
import { pushSyncOperationsV2 } from "@/features/sync/actions-v2"

// Prepared dispatcher; the product caller remains on transport 1.
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
