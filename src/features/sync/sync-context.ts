"use client"

import { createContext } from "react"
import type { useSyncEngine } from "@/features/sync/hooks/use-sync-engine"

export const SyncContext = createContext<ReturnType<
  typeof useSyncEngine
> | null>(null)
