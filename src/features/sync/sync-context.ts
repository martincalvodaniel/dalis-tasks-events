"use client"

import { createContext } from "react"
import type { usePlacementSyncEngine } from "@/features/sync/hooks/use-placement-sync-engine"

export const SyncContext = createContext<ReturnType<
  typeof usePlacementSyncEngine
> | null>(null)
