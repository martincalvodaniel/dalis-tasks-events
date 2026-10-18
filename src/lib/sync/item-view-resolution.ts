import { applyItemViewCommand } from "@/lib/preferences/preference-command"
import { validateLocalPreferenceOutcomeV2 } from "@/lib/sync/local-operation-outcome-v2"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  itemViewResolutionCaptureSchema,
  itemViewResolutionRecordSchema,
  itemViewResolutionRequestSchema,
  itemViewResolutionSnapshotSchema,
} from "@/schemas/item-view-resolution"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import type {
  ItemViewResolutionRecord,
  ItemViewResolutionRequest,
  ItemViewResolutionSnapshot,
} from "@/types/item-view-resolution"
import type { ItemView } from "@/types/preferences"

// A capture must be reconstructed in the writer's transaction; this DTO is not authorization.
export function captureItemViewResolutionSnapshot(
  input: unknown
): ItemViewResolutionSnapshot {
  const value = itemViewResolutionCaptureSchema.parse(input)
  const { userId, parent, entries, incident } = value
  personalQueueDiagnosticsInputSchema.parse({
    userId,
    items: [parent],
    entries,
  })
  const key = `item-view:${parent.id}`
  const chain = entries
    .filter(
      (entry) => entry.entityKey === key && isUnresolvedOutboxEntry(entry)
    )
    .toSorted((a, b) => a.sequence - b.sequence)
  const compared = incident.intentions
    .filter((entry) => entry.entityKey === key)
    .toSorted((a, b) => a.sequence - b.sequence)
  if (JSON.stringify(chain) !== JSON.stringify(compared))
    throw new Error("Assignment recovery requires its complete exact queue")
  const ids = new Set(chain.map((entry) => entry.operation.operationId))
  const byId = new Map(
    entries.map((entry) => [entry.operation.operationId, entry])
  )
  const dependencies = new Set<string>()
  for (const entry of entries) {
    if (!isUnresolvedOutboxEntry(entry)) continue
    if (ids.has(entry.operation.operationId)) {
      for (const id of entry.dependencies)
        if (!ids.has(id)) {
          if (byId.get(id)?.state !== "acknowledged")
            throw new Error(
              "Assignment has an unresolved external prerequisite"
            )
          dependencies.add(id)
        }
    } else {
      if (entry.dependencies.some((id) => ids.has(id)))
        throw new Error("Assignment has an unreviewed external dependent")
      const command = entry.operation.command
      if ("itemId" in command && command.itemId === parent.id)
        throw new Error(
          "Assignment has another unresolved operation on its plan"
        )
    }
  }
  const pending = [...dependencies]
  while (pending.length) {
    const id = pending.pop()
    const dependency = id ? byId.get(id) : undefined
    if (dependency?.state !== "acknowledged")
      throw new Error("Assignment history requires acknowledged prerequisites")
    for (const id of dependency.dependencies)
      if (!dependencies.has(id)) {
        dependencies.add(id)
        pending.push(id)
      }
  }
  const selected = new Set(
    [...incident.local, ...incident.remote].flatMap((value) =>
      value.record?.store === "itemViews" && value.record.record.primaryTagId
        ? [value.record.record.primaryTagId]
        : []
    )
  )
  const tagNames = Object.fromEntries(
    Object.entries(incident.tagNames).filter(([id]) => selected.has(id))
  )
  const snapshot = {
    incident: { ...incident, intentions: chain, tagNames },
    parent,
    localTag: value.localTag,
    acknowledgedDependencies: entries
      .filter((entry) => dependencies.has(entry.operation.operationId))
      .toSorted((a, b) => a.sequence - b.sequence),
  }
  validateComparison(snapshot, userId)
  return itemViewResolutionSnapshotSchema.parse(snapshot)
}
function validateComparison(input: unknown, actor: string) {
  const value = itemViewResolutionSnapshotSchema.parse(input)
  const { incident, parent, localTag } = value
  const key = `item-view:${parent.id}`
  if (
    parent.ownerId !== actor ||
    parent.deletedAt ||
    parent.recurrence ||
    incident.entry.userId !== actor ||
    incident.entry.entityKey !== key ||
    incident.entry.operation.command.type !== "item-view.set" ||
    incident.reason !== "conflict" ||
    incident.entry.state !== "conflict" ||
    incident.blockedByRelatedIntentions
  )
    throw new Error(
      "Assignment recovery requires its own living simple plan conflict"
    )
  const outcome = validateLocalPreferenceOutcomeV2(incident.outcome, actor)
  if (
    outcome.result.outcome.status !== "conflict" ||
    JSON.stringify(outcome.operation) !==
      JSON.stringify(incident.entry.operation) ||
    JSON.stringify(outcome.local) !== JSON.stringify(incident.localAtOutcome) ||
    JSON.stringify(outcome.base) !== JSON.stringify(incident.shadowAtOutcome)
  )
    throw new Error("Assignment comparison contradicts its frozen outcome")
  function read(snapshot: typeof incident.local): ItemView | null {
    if (snapshot.length !== 1 || snapshot[0].entityKey !== key)
      throw new Error("Assignment comparison requires one exact entity")
    const effect = snapshot[0].record
    if (
      effect &&
      (effect.store !== "itemViews" ||
        effect.record.userId !== actor ||
        effect.record.itemId !== parent.id)
    )
      throw new Error("Assignment comparison contains a foreign entity")
    return effect?.store === "itemViews" ? effect.record : null
  }
  const local = read(incident.local),
    remote = read(incident.remote)
  read(incident.localAtOutcome)
  read(incident.shadowAtOutcome)
  if (!remote || remote.deletedAt || remote.revision < 1)
    throw new Error("Assignment requires a living committed remote view")
  if (local?.deletedAt)
    throw new Error("Assignment cannot restore a deleted local view")
  for (const snapshot of [
    outcome.base,
    [{ entityKey: key, record: outcome.result.outcome.current }],
  ]) {
    const observed = read(snapshot)
    // Optimistic local revisions are not ancestors; only observed remote evidence bounds freshness.
    if (
      observed &&
      (observed.revision > remote.revision ||
        (observed.revision === remote.revision &&
          JSON.stringify(observed) !== JSON.stringify(remote)))
    )
      throw new Error(
        "Assignment remote comparison regressed or contradicts evidence"
      )
  }
  if (
    localTag &&
    (localTag.userId !== actor || localTag.id !== local?.primaryTagId)
  )
    throw new Error(
      "Assignment category belongs to another account or selection"
    )
  const all = [...incident.intentions, ...value.acknowledgedDependencies]
  personalQueueDiagnosticsInputSchema.parse({
    userId: actor,
    items: [parent],
    entries: all,
  })
  const ids = new Set(
    incident.intentions.map((entry) => entry.operation.operationId)
  )
  if (
    !incident.intentions.some(
      (entry) => JSON.stringify(entry) === JSON.stringify(incident.entry)
    )
  )
    throw new Error("Assignment chain is missing its incident")
  for (const entry of incident.intentions) {
    if (
      entry.entityKey !== key ||
      entry.operation.command.type !== "item-view.set" ||
      entry.lease !== null ||
      ["acknowledged", "sending", "superseded"].includes(entry.state) ||
      (entry.state === "pending" && entry.attempts > 0)
    )
      throw new Error(
        "Assignment chain contains an unsupported or uncertain intention"
      )
  }
  if (
    incident.intentions.some(
      (entry, index) =>
        index > 0 && entry.sequence <= incident.intentions[index - 1].sequence
    )
  )
    throw new Error("Assignment intentions are not ordered")
  const byId = new Map(all.map((entry) => [entry.operation.operationId, entry]))
  const needed = new Set(
    incident.intentions.flatMap((entry) =>
      entry.dependencies.filter((id) => !ids.has(id))
    )
  )
  const pending = [...needed]
  while (pending.length) {
    const id = pending.pop()
    const dependency = id ? byId.get(id) : undefined
    if (dependency?.state !== "acknowledged")
      throw new Error("Assignment prerequisite is not acknowledged")
    for (const id of dependency.dependencies)
      if (!needed.has(id)) {
        needed.add(id)
        pending.push(id)
      }
  }
  if (
    needed.size !== value.acknowledgedDependencies.length ||
    value.acknowledgedDependencies.some(
      (entry) =>
        entry.state !== "acknowledged" ||
        !needed.has(entry.operation.operationId)
    )
  )
    throw new Error("Assignment prerequisite evidence is incomplete")
  const last = incident.intentions.at(-1)?.operation.command
  if (
    local &&
    (last?.type !== "item-view.set" || last.primaryTagId !== local.primaryTagId)
  )
    throw new Error(
      "Assignment local selection contradicts its latest intention"
    )
  return { value, local, remote }
}
export function availableItemViewResolutionChoices(
  input: unknown,
  actor: string
): ItemViewResolutionRequest["choice"][] {
  try {
    const { value, local, remote } = validateComparison(input, actor)
    return local &&
      remote.revision < Number.MAX_SAFE_INTEGER &&
      (local.primaryTagId === null ||
        (value.localTag &&
          !value.localTag.deletedAt &&
          value.localTag.revision > 0))
      ? ["adopt_remote", "retry_local"]
      : ["adopt_remote"]
  } catch {
    return []
  }
}
export function planItemViewIncidentResolution(
  input: unknown,
  currentInput: unknown
): ItemViewResolutionRecord {
  const request = itemViewResolutionRequestSchema.parse(input),
    current = itemViewResolutionSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Assignment comparison changed after review")
  const { local, remote, value } = validateComparison(current, request.userId)
  const identities = [request.resolutionId, request.operationId].filter(
    (id) => id !== null
  )
  if (
    new Set(identities).size !== identities.length ||
    [...current.incident.intentions, ...current.acknowledgedDependencies].some(
      (entry) => identities.includes(entry.operation.operationId)
    )
  )
    throw new Error("Assignment decision identities must be new and distinct")
  if (
    !availableItemViewResolutionChoices(current, request.userId).includes(
      request.choice
    )
  )
    throw new Error(
      "Assignment choice is unavailable for this reviewed snapshot"
    )
  const replacement =
    request.choice === "retry_local" && local
      ? {
          operationId: request.operationId,
          protocolVersion: 1,
          baseRevision: remote.revision,
          command: {
            type: "item-view.set" as const,
            itemId: remote.itemId,
            primaryTagId: local.primaryTagId,
          },
        }
      : null
  return itemViewResolutionRecordSchema.parse({
    ...request,
    key: `item-view-resolution:${request.resolutionId}`,
    replacement,
    local: replacement
      ? applyItemViewCommand(
          remote,
          value.parent,
          value.localTag,
          replacement.command,
          request.userId,
          request.createdAt
        )
      : remote,
    supersededOperationIds: current.incident.intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}
export function validateItemViewResolutionRecord(
  input: unknown,
  actor: string
): ItemViewResolutionRecord {
  const record = itemViewResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Assignment decision belongs to another account")
  const request = {
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    choice: record.choice,
    createdAt: record.createdAt,
    expected: record.expected,
  }
  if (
    JSON.stringify(record) !==
    JSON.stringify(planItemViewIncidentResolution(request, record.expected))
  )
    throw new Error(
      "Stored assignment decision contradicts its reviewed evidence"
    )
  return record
}
