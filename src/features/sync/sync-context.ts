"use client"

import { createContext } from "react"
import type { useMixedSyncEngine } from "@/features/sync/hooks/use-mixed-sync-engine"

export const SyncContext = createContext<ReturnType<
  typeof useMixedSyncEngine
> | null>(null)
