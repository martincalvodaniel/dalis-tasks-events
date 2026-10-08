import { projectSyncIncident } from "@/lib/sync/incident-projection"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { syncIncidentSnapshotInputSchema } from "@/schemas/sync-incident"
import type { OutboxEntry } from "@/types/local-sync"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

export function projectSyncIncidentSnapshot(
  input: unknown
): SyncIncidentSnapshot[] {
  const { userId, entries, items, shadows, outcomes } =
    syncIncidentSnapshotInputSchema.parse(input)
  const operationIds = new Set<string>()
  const sequences = new Set<number>()
  const intentions = new Map<string, OutboxEntry[]>()
  for (const entry of entries) {
    const id = entry.operation.operationId
    if (
      entry.userId !== userId ||
      operationIds.has(id) ||
      sequences.has(entry.sequence)
    )
      throw new Error("Incident queue contains foreign or duplicate operations")
    operationIds.add(id)
    sequences.add(entry.sequence)
    if (isUnresolvedOutboxEntry(entry)) {
      const group = intentions.get(entry.entityKey) ?? []
      group.push(entry)
      intentions.set(entry.entityKey, group)
    }
  }
  for (const group of intentions.values())
    group.sort((a, b) => a.sequence - b.sequence)
  const local = new Map<string, (typeof items)[number]>()
  for (const item of items) {
    if (item.ownerId !== userId || local.has(item.id))
      throw new Error("Incident items contain foreign or duplicate identities")
    local.set(item.id, item)
  }
  const remote = new Map<string, (typeof shadows)[number]["record"]>()
  for (const shadow of shadows) {
    if (shadow.record.ownerId !== userId || remote.has(shadow.entityKey))
      throw new Error(
        "Incident shadows contain foreign or duplicate identities"
      )
    remote.set(shadow.entityKey, shadow.record)
  }
  const evidence = new Map<string, (typeof outcomes)[number]>()
  for (const outcome of outcomes) {
    if (evidence.has(outcome.key))
      throw new Error("Incident outcome is duplicated")
    evidence.set(outcome.key, outcome)
  }
  return entries
    .filter((entry) => entry.state === "conflict" || entry.state === "rejected")
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry) => {
      const command = entry.operation.command
      if (!("itemId" in command))
        throw new Error("Incident requires an item identity")
      return {
        ...projectSyncIncident({
          userId,
          entry,
          local: local.get(command.itemId) ?? null,
          remote: remote.get(entry.entityKey) ?? null,
          outcome: evidence.get(
            `operation-outcome:${entry.operation.operationId}`
          ),
        }),
        intentions: intentions.get(entry.entityKey) ?? [],
      }
    })
}
