import { validateLocalPreferenceOutcomeV2 } from "@/lib/sync/local-operation-outcome-v2"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { remoteTagPlanningInputSchema } from "@/schemas/remote-tag-planning"
import {
  tagOrderResolutionCaptureSchema,
  tagOrderResolutionSnapshotSchema,
} from "@/schemas/tag-order-resolution"
import type { TagOrderResolutionSnapshot } from "@/types/tag-order-resolution"

// This complete local capture is not proof of the server's current catalog or authorization to write.
export function captureTagOrderResolutionSnapshot(
  input: unknown
): TagOrderResolutionSnapshot {
  const value = tagOrderResolutionCaptureSchema.parse(input),
    { incident, entries, userId } = value
  personalQueueDiagnosticsInputSchema.parse({ userId, items: [], entries })
  const command = incident.entry.operation.command
  if (
    command.type !== "tag.move" ||
    incident.entry.userId !== userId ||
    incident.reason !== "conflict" ||
    incident.entry.state !== "conflict" ||
    incident.entry.attempts < 1 ||
    incident.blockedByRelatedIntentions
  )
    throw new Error("Category order requires its own isolated move conflict")
  const key = `tag:${command.tagId}`
  const chain = entries
    .filter(
      (entry) => entry.entityKey === key && isUnresolvedOutboxEntry(entry)
    )
    .toSorted((a, b) => a.sequence - b.sequence)
  const compared = incident.intentions
    .filter((entry) => entry.entityKey === key)
    .toSorted((a, b) => a.sequence - b.sequence)
  if (
    JSON.stringify(chain) !== JSON.stringify(compared) ||
    JSON.stringify(chain[0]) !== JSON.stringify(incident.entry)
  )
    throw new Error(
      "Category order requires its complete exact chain and first conflict"
    )
  const ids = new Set(chain.map((entry) => entry.operation.operationId)),
    byId = new Map(entries.map((entry) => [entry.operation.operationId, entry]))
  const prerequisites = new Set<string>(),
    connected = new Set<string>()
  for (const entry of chain) {
    if (
      entry.operation.command.type !== "tag.move" ||
      entry.operation.command.tagId !== command.tagId ||
      entry.lease !== null ||
      (entry !== chain[0] &&
        (entry.state !== "pending" || entry.attempts !== 0))
    )
      throw new Error(
        "Category order chain contains unsupported or uncertain intentions"
      )
    if (connected.size && !entry.dependencies.some((id) => connected.has(id)))
      throw new Error(
        "Category order child is disconnected from its reviewed root"
      )
    for (const id of entry.dependencies)
      if (!ids.has(id)) {
        if (byId.get(id)?.state !== "acknowledged")
          throw new Error(
            "Category order has an unresolved external prerequisite"
          )
        prerequisites.add(id)
      }
    connected.add(entry.operation.operationId)
  }
  for (const entry of entries) {
    if (!isUnresolvedOutboxEntry(entry) || ids.has(entry.operation.operationId))
      continue
    if (entry.dependencies.some((id) => ids.has(id)))
      throw new Error("Category order has an unreviewed external dependent")
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
        "Category order has another unresolved personal operation"
      )
  }
  const pending = [...prerequisites]
  while (pending.length) {
    const id = pending.pop(),
      parent = id ? byId.get(id) : undefined
    if (parent?.state !== "acknowledged")
      throw new Error(
        "Category order history requires acknowledged prerequisites"
      )
    for (const id of parent.dependencies)
      if (!prerequisites.has(id)) {
        prerequisites.add(id)
        pending.push(id)
      }
  }
  const snapshot = tagOrderResolutionSnapshotSchema.parse({
    incident: { ...incident, intentions: chain, tagNames: {} },
    localTags: value.localTags.toSorted((a, b) => (a.id < b.id ? -1 : 1)),
    observedTags: value.observedTags.toSorted((a, b) => (a.id < b.id ? -1 : 1)),
    acknowledgedDependencies: entries
      .filter((entry) => prerequisites.has(entry.operation.operationId))
      .toSorted((a, b) => a.sequence - b.sequence),
  })
  validateTagOrderResolutionSnapshot(snapshot, userId)
  return snapshot
}

export function validateTagOrderResolutionSnapshot(
  input: unknown,
  actor: string
): TagOrderResolutionSnapshot {
  const value = tagOrderResolutionSnapshotSchema.parse(input),
    { incident } = value
  const command = incident.entry.operation.command
  if (
    command.type !== "tag.move" ||
    incident.entry.userId !== actor ||
    incident.reason !== "conflict" ||
    incident.entry.state !== "conflict" ||
    incident.entry.attempts < 1 ||
    incident.blockedByRelatedIntentions
  )
    throw new Error("Category order snapshot is foreign or unsupported")
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
    throw new Error("Category order comparison contradicts its frozen outcome")
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
    if (tag.deletedAt && !remote.deletedAt)
      throw new Error("Category order cannot resurrect a local tombstone")
  }
  const primary = local.get(command.tagId),
    remote = observed.get(command.tagId)
  if (!primary || primary.deletedAt || !remote)
    throw new Error("Category order primary is unavailable")
  function read(snapshot: typeof incident.local) {
    if (snapshot.length !== 1 || snapshot[0].entityKey !== key)
      throw new Error("Category order incident requires its exact primary")
    const effect = snapshot[0].record
    if (
      effect &&
      (effect.store !== "tags" ||
        effect.record.userId !== actor ||
        effect.record.id !== primaryId)
    )
      throw new Error("Category order incident contains another entity")
    return effect?.store === "tags" ? effect.record : null
  }
  if (
    JSON.stringify(read(incident.local)) !== JSON.stringify(primary) ||
    JSON.stringify(read(incident.remote)) !== JSON.stringify(remote)
  )
    throw new Error(
      "Category order catalog differs from its primary comparison"
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
        "Category order observed catalog is stale or contradicts remote evidence"
      )
  }
  const all = [...incident.intentions, ...value.acknowledgedDependencies]
  personalQueueDiagnosticsInputSchema.parse({
    userId: actor,
    items: [],
    entries: all,
  })
  if (JSON.stringify(incident.intentions[0]) !== JSON.stringify(incident.entry))
    throw new Error("Category order snapshot is missing its first conflict")
  const ids = new Set(
      incident.intentions.map((entry) => entry.operation.operationId)
    ),
    byId = new Map(all.map((entry) => [entry.operation.operationId, entry])),
    needed = new Set<string>(),
    connected = new Set<string>()
  for (const [index, entry] of incident.intentions.entries()) {
    if (
      entry.entityKey !== key ||
      entry.operation.command.type !== "tag.move" ||
      entry.lease !== null ||
      (index > 0 &&
        (entry.state !== "pending" ||
          entry.attempts !== 0 ||
          entry.sequence <= incident.intentions[index - 1].sequence ||
          !entry.dependencies.some((id) => connected.has(id))))
    )
      throw new Error(
        "Category order snapshot chain is unsupported or uncertain"
      )
    for (const id of entry.dependencies) if (!ids.has(id)) needed.add(id)
    connected.add(entry.operation.operationId)
  }
  const pending = [...needed]
  while (pending.length) {
    const id = pending.pop(),
      parent = id ? byId.get(id) : undefined
    if (parent?.state !== "acknowledged")
      throw new Error("Category order prerequisite is not acknowledged")
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
    throw new Error("Category order prerequisite closure is incomplete")
  return value
}
