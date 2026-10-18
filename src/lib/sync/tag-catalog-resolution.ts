import { validateLocalPreferenceOutcomeV2 } from "@/lib/sync/local-operation-outcome-v2"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { remoteTagPlanningInputSchema } from "@/schemas/remote-tag-planning"
import {
  tagCatalogResolutionCaptureSchema,
  tagCatalogResolutionSnapshotSchema,
} from "@/schemas/tag-catalog-resolution"
import type { SyncCommand } from "@/types/sync"
import type { TagCatalogResolutionSnapshot } from "@/types/tag-catalog-resolution"

type CatalogCommandType = "tag.move" | "tag.delete"
function matchesCatalogCommand(
  command: SyncCommand,
  type: CatalogCommandType
): command is Extract<SyncCommand, { type: "tag.move" | "tag.delete" }> {
  return (
    (command.type === "tag.move" || command.type === "tag.delete") &&
    command.type === type
  )
}

// This complete local capture is not proof of the server's current catalog or authorization to write.
export function captureTagCatalogResolutionSnapshot(
  input: unknown,
  type: CatalogCommandType
): TagCatalogResolutionSnapshot {
  const value = tagCatalogResolutionCaptureSchema.parse(input),
    { incident, entries, userId } = value
  personalQueueDiagnosticsInputSchema.parse({ userId, items: [], entries })
  const command = incident.entry.operation.command
  if (
    !matchesCatalogCommand(command, type) ||
    incident.entry.userId !== userId ||
    incident.reason !== "conflict" ||
    incident.entry.state !== "conflict" ||
    incident.entry.attempts < 1 ||
    incident.blockedByRelatedIntentions
  )
    throw new Error("Category catalog requires its own isolated command conflict")
  const key = `tag:${command.tagId}`
  const chain = entries
    .filter(
      (entry) => entry.entityKey === key && isUnresolvedOutboxEntry(entry)
    )
    .toSorted((a, b) => a.sequence - b.sequence)
  if (type === "tag.delete" && chain.length !== 1)
    throw new Error("Category deletion requires one isolated intention")
  const compared = incident.intentions
    .filter((entry) => entry.entityKey === key)
    .toSorted((a, b) => a.sequence - b.sequence)
  if (
    JSON.stringify(chain) !== JSON.stringify(compared) ||
    JSON.stringify(chain[0]) !== JSON.stringify(incident.entry)
  )
    throw new Error(
      "Category catalog requires its complete exact chain and first conflict"
    )
  const ids = new Set(chain.map((entry) => entry.operation.operationId)),
    byId = new Map(entries.map((entry) => [entry.operation.operationId, entry]))
  const prerequisites = new Set<string>(),
    connected = new Set<string>()
  for (const entry of chain) {
    if (
      !matchesCatalogCommand(entry.operation.command, type) ||
      entry.operation.command.tagId !== command.tagId ||
      entry.lease !== null ||
      (entry !== chain[0] &&
        (entry.state !== "pending" || entry.attempts !== 0))
    )
      throw new Error(
        "Category catalog chain contains unsupported or uncertain intentions"
      )
    if (connected.size && !entry.dependencies.some((id) => connected.has(id)))
      throw new Error(
        "Category catalog child is disconnected from its reviewed root"
      )
    for (const id of entry.dependencies)
      if (!ids.has(id)) {
        if (byId.get(id)?.state !== "acknowledged")
          throw new Error(
            "Category catalog has an unresolved external prerequisite"
          )
        prerequisites.add(id)
      }
    connected.add(entry.operation.operationId)
  }
  for (const entry of entries) {
    if (!isUnresolvedOutboxEntry(entry) || ids.has(entry.operation.operationId))
      continue
    if (entry.dependencies.some((id) => ids.has(id)))
      throw new Error("Category catalog has an unreviewed external dependent")
    const type = entry.operation.command.type
    if (
      [
        "tag.save",
        "tag.delete",
        "tag.move",
        "item-view.set",
        "task.move",
      ].includes(type)
    )
      throw new Error(
        "Category catalog has another unresolved personal operation"
      )
  }
  const pending = [...prerequisites]
  while (pending.length) {
    const id = pending.pop(),
      parent = id ? byId.get(id) : undefined
    if (parent?.state !== "acknowledged")
      throw new Error(
        "Category catalog history requires acknowledged prerequisites"
      )
    for (const id of parent.dependencies)
      if (!prerequisites.has(id)) {
        prerequisites.add(id)
        pending.push(id)
      }
  }
  const snapshot = tagCatalogResolutionSnapshotSchema.parse({
    incident: { ...incident, intentions: chain, tagNames: {} },
    localTags: value.localTags.toSorted((a, b) => (a.id < b.id ? -1 : 1)),
    observedTags: value.observedTags.toSorted((a, b) => (a.id < b.id ? -1 : 1)),
    acknowledgedDependencies: entries
      .filter((entry) => prerequisites.has(entry.operation.operationId))
      .toSorted((a, b) => a.sequence - b.sequence),
  })
  validateTagCatalogResolutionSnapshot(snapshot, userId, type)
  return snapshot
}

export function validateTagCatalogResolutionSnapshot(
  input: unknown,
  actor: string,
  type: CatalogCommandType
): TagCatalogResolutionSnapshot {
  const value = tagCatalogResolutionSnapshotSchema.parse(input),
    { incident } = value
  const command = incident.entry.operation.command
  if (
    !matchesCatalogCommand(command, type) ||
    incident.entry.userId !== actor ||
    incident.reason !== "conflict" ||
    incident.entry.state !== "conflict" ||
    incident.entry.attempts < 1 ||
    incident.blockedByRelatedIntentions
  )
    throw new Error("Category catalog snapshot is foreign or unsupported")
  const primaryId = command.tagId,
    key = `tag:${primaryId}`,
    outcome = validateLocalPreferenceOutcomeV2(incident.outcome, actor)
  if (
    outcome.result.outcome.status !== "conflict" ||
    JSON.stringify(outcome.operation) !==
      JSON.stringify(incident.entry.operation) ||
    JSON.stringify(outcome.local) !== JSON.stringify(incident.localAtOutcome) ||
    JSON.stringify(outcome.base) !== JSON.stringify(incident.shadowAtOutcome)
  )
    throw new Error(
      "Category catalog comparison contradicts its frozen outcome"
    )
  for (const tags of [value.localTags, value.observedTags])
    remoteTagPlanningInputSchema.parse({
      userId: actor,
      timestamp: incident.entry.createdAt,
      operation: incident.entry.operation,
      tags,
    })
  const local = new Map(value.localTags.map((tag) => [tag.id, tag])),
    observed = new Map(value.observedTags.map((tag) => [tag.id, tag]))
  for (const tag of local.values()) {
    const remote = observed.get(tag.id)
    if (!remote)
      throw new Error("Local category has no complete observed remote evidence")
    if (
      tag.deletedAt &&
      !remote.deletedAt &&
      !(type === "tag.delete" && tag.id === primaryId)
    )
      throw new Error("Category catalog cannot resurrect a local tombstone")
  }
  const primary = local.get(command.tagId),
    remote = observed.get(command.tagId)
  if (
    !primary ||
    !remote ||
    (type === "tag.move" ? Boolean(primary.deletedAt) : !primary.deletedAt)
  )
    throw new Error("Category catalog primary is unavailable")
  function read(snapshot: typeof incident.local) {
    if (snapshot.length !== 1 || snapshot[0].entityKey !== key)
      throw new Error("Category catalog incident requires its exact primary")
    const effect = snapshot[0].record
    if (
      effect &&
      (effect.store !== "tags" ||
        effect.record.userId !== actor ||
        effect.record.id !== primaryId)
    )
      throw new Error("Category catalog incident contains another entity")
    return effect?.store === "tags" ? effect.record : null
  }
  if (
    JSON.stringify(read(incident.local)) !== JSON.stringify(primary) ||
    JSON.stringify(read(incident.remote)) !== JSON.stringify(remote)
  )
    throw new Error(
      "Category catalog catalog differs from its primary comparison"
    )
  read(incident.localAtOutcome)
  read(incident.shadowAtOutcome)
  for (const snapshot of [
    outcome.base,
    [{ entityKey: key, record: outcome.result.outcome.current }],
  ]) {
    const known = read(snapshot)
    // A later shadow is observed evidence, never an ancestor of the failed command.
    if (
      known &&
      (known.revision > remote.revision ||
        (known.revision === remote.revision &&
          JSON.stringify(known) !== JSON.stringify(remote)))
    )
      throw new Error(
        "Category catalog observed catalog is stale or contradicts remote evidence"
      )
  }
  if (type === "tag.delete" && incident.intentions.length !== 1)
    throw new Error("Category deletion requires one isolated intention")
  const all = [...incident.intentions, ...value.acknowledgedDependencies]
  personalQueueDiagnosticsInputSchema.parse({
    userId: actor,
    items: [],
    entries: all,
  })
  if (JSON.stringify(incident.intentions[0]) !== JSON.stringify(incident.entry))
    throw new Error("Category catalog snapshot is missing its first conflict")
  const ids = new Set(
      incident.intentions.map((entry) => entry.operation.operationId)
    ),
    byId = new Map(all.map((entry) => [entry.operation.operationId, entry])),
    needed = new Set<string>(),
    connected = new Set<string>()
  for (const [index, entry] of incident.intentions.entries()) {
    if (
      entry.entityKey !== key ||
      !matchesCatalogCommand(entry.operation.command, type) ||
      entry.lease !== null ||
      (index > 0 &&
        (entry.state !== "pending" ||
          entry.attempts !== 0 ||
          entry.sequence <= incident.intentions[index - 1].sequence ||
          !entry.dependencies.some((id) => connected.has(id))))
    )
      throw new Error(
        "Category catalog snapshot chain is unsupported or uncertain"
      )
    for (const id of entry.dependencies) if (!ids.has(id)) needed.add(id)
    connected.add(entry.operation.operationId)
  }
  const pending = [...needed]
  while (pending.length) {
    const id = pending.pop(),
      parent = id ? byId.get(id) : undefined
    if (parent?.state !== "acknowledged")
      throw new Error("Category catalog prerequisite is not acknowledged")
    for (const id of parent.dependencies)
      if (!needed.has(id)) {
        needed.add(id)
        pending.push(id)
      }
  }
  if (
    value.acknowledgedDependencies.length !== needed.size ||
    value.acknowledgedDependencies.some(
      (entry) =>
        entry.state !== "acknowledged" ||
        !needed.has(entry.operation.operationId)
    )
  )
    throw new Error("Category catalog prerequisite closure is incomplete")
  return value
}
