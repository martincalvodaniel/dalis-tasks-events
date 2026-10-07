"use client"

import { startTransition } from "react"
import { pushSyncOperations } from "@/features/sync/actions"

export function dispatchSyncOperations(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await pushSyncOperations(input))
      } catch (error) {
        reject(error)
      }
    })
  })
}
