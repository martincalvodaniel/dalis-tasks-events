"use client"

import { useSyncExternalStore } from "react"
import { workspaceViewFromSearch } from "@/config/navigation"

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

export function useWorkspaceView() {
  return useSyncExternalStore(
    subscribe,
    () => workspaceViewFromSearch(window.location.search),
    () => "overview" as const
  )
}
