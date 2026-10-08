import type { z } from "zod"
import { supportsRemoteItemCommand } from "@/lib/sync/item-command-support"
import {
  syncQueueSnapshotSchema,
  syncQueueSummarySchema,
} from "@/schemas/sync-queue"

export type SyncQueueSummary = z.infer<typeof syncQueueSummarySchema>
type DependencyState = "ready" | "waiting" | "blocked"

export function summarizeSyncQueue(input: unknown): SyncQueueSummary {
  const { entries, items } = syncQueueSnapshotSchema.parse(input)
  const byId = new Map(
    entries.map((entry) => [entry.operation.operationId, entry])
  )
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const states = new Map<string, DependencyState>()
  const remaining = new Map<string, number>()
  const children = new Map<string, string[]>()
  const unsupported = new Set<string>()
  const summary: SyncQueueSummary = {
    pending: 0,
    ready: 0,
    waiting: 0,
    blocked: 0,
    unsupported: 0,
    sending: 0,
    conflicts: 0,
    rejected: 0,
  }
  for (const entry of entries) {
    const id = entry.operation.operationId
    switch (entry.state) {
      case "acknowledged":
        states.set(id, "ready")
        break
      case "sending":
        summary.sending++
        states.set(id, "waiting")
        break
      case "conflict":
        summary.conflicts++
        states.set(id, "blocked")
        break
      case "rejected":
        summary.rejected++
        states.set(id, "blocked")
        break
      case "superseded":
        states.set(id, "blocked")
        break
      case "pending": {
        summary.pending++
        const command = entry.operation.command
        const current =
          "itemId" in command ? (itemsById.get(command.itemId) ?? null) : null
        if (!supportsRemoteItemCommand(command, current)) {
          summary.unsupported++
          unsupported.add(id)
          states.set(id, "blocked")
        }
        break
      }
    }
  }
  const queue: string[] = []
  for (const entry of entries) {
    const id = entry.operation.operationId
    if (states.has(id)) continue
    let unknown = 0
    for (const dependency of entry.dependencies) {
      if (!byId.has(dependency) || states.has(dependency)) continue
      unknown++
      const dependents = children.get(dependency) ?? []
      dependents.push(id)
      children.set(dependency, dependents)
    }
    remaining.set(id, unknown)
    if (unknown === 0) queue.push(id)
  }
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]
    const entry = byId.get(id)
    if (!entry) throw new Error("Queue dependency identity is missing")
    const blocked = entry.dependencies.some(
      (dependency) =>
        !byId.has(dependency) || states.get(dependency) === "blocked"
    )
    const waiting = entry.dependencies.some(
      (dependency) => byId.get(dependency)?.state !== "acknowledged"
    )
    states.set(id, blocked ? "blocked" : waiting ? "waiting" : "ready")
    for (const child of children.get(id) ?? []) {
      const count = (remaining.get(child) ?? 0) - 1
      remaining.set(child, count)
      if (count === 0) queue.push(child)
    }
  }
  for (const entry of entries) {
    const id = entry.operation.operationId
    if (entry.state !== "pending" || unsupported.has(id)) continue
    summary[states.get(id) ?? "blocked"]++
  }
  return syncQueueSummarySchema.parse(summary)
}
