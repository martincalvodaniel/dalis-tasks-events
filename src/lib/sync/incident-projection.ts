import { syncIncidentProjectionSchema } from "@/schemas/sync-incident"
import type { SyncIncident } from "@/types/sync-incident"

export function projectSyncIncident(input: unknown): SyncIncident {
  const { userId, entry, outcome, local, remote } =
    syncIncidentProjectionSchema.parse(input)
  const command = entry.operation.command
  if (
    entry.userId !== userId ||
    (entry.state !== "conflict" && entry.state !== "rejected")
  )
    throw new Error(
      "Incident requires a terminal operation owned by its account"
    )
  if (
    command.type !== "item.create" &&
    command.type !== "item.update" &&
    command.type !== "item.delete" &&
    command.type !== "plan.set-status" &&
    command.type !== "plan.set-checklist-entry" &&
    command.type !== "task.set-status" &&
    command.type !== "task.set-checklist-entry"
  )
    throw new Error("Incident projection requires an item operation")
  if (JSON.stringify(entry.operation) !== JSON.stringify(outcome.operation))
    throw new Error("Incident outcome does not match its frozen operation")
  const result = outcome.result
  if (
    result.status === "applied" ||
    result.status === "unsupported" ||
    (entry.state === "conflict") !== (result.status === "conflict")
  )
    throw new Error("Incident state does not match its durable result")
  const knownRemote = result.status === "conflict" ? result.current : null
  for (const item of [local, remote, outcome.local, outcome.base, knownRemote])
    if (item && (item.ownerId !== userId || item.id !== command.itemId))
      throw new Error("Incident record identity or account is inconsistent")
  for (const item of [remote, outcome.base, knownRemote])
    if (item && item.revision < 1)
      throw new Error("Incident remote versions require a committed revision")
  const versions = [outcome.base, knownRemote, remote].filter(
    (item) => item !== null
  )
  for (const first of versions)
    for (const second of versions)
      if (
        first.revision === second.revision &&
        JSON.stringify(first) !== JSON.stringify(second)
      )
        throw new Error("Incident remote versions are contradictory")
  const latestKnown = versions.reduce<(typeof versions)[number] | null>(
    (latest, item) =>
      !latest || item.revision > latest.revision ? item : latest,
    null
  )
  if (remote && latestKnown && remote.revision < latestKnown.revision)
    throw new Error(
      "Incident current shadow cannot regress its durable evidence"
    )
  return {
    entry,
    reason: result.status,
    local,
    localAtOutcome: outcome.local,
    shadowAtOutcome: outcome.base,
    remote: remote ?? latestKnown,
  }
}
