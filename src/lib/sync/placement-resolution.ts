import { isPlanOverdue, planIncludesDate } from "@/lib/calendar/plan-selection"
import { reviewCategoryPlacementGroups } from "@/lib/sync/category-placement-review"
import { validateLocalPreferenceOutcomeV2 } from "@/lib/sync/local-operation-outcome-v2"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  reviewPlacementGroup,
  reviewRecurringPlacementGroup,
} from "@/lib/sync/placement-group-review"
import { placementDate, taskPlacementEntityKey } from "@/schemas/ordering"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import {
  placementResolutionCaptureSchema,
  placementResolutionSnapshotSchema,
} from "@/schemas/placement-resolution"
import { remoteRecurringTaskPlacementPlanningInputSchema } from "@/schemas/recurring-task-placement-planning"
import type { OutboxEntry } from "@/types/local-sync"
import type {
  PlacementResolutionCatalog,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"
import type { TaskPlacement } from "@/types/preferences"

function placementKey(record: TaskPlacement) {
  return taskPlacementEntityKey(record.occurrenceId, record.scope, record.date)
}
function canonicalCatalog(
  input: PlacementResolutionCatalog
): PlacementResolutionCatalog {
  return {
    occurrences: input.occurrences.toSorted((a, b) => a.id.localeCompare(b.id)),
    items: input.items.toSorted((a, b) => a.id.localeCompare(b.id)),
    tags: input.tags.toSorted((a, b) => a.id.localeCompare(b.id)),
    views: input.views.toSorted((a, b) => a.itemId.localeCompare(b.itemId)),
    placements: input.placements.toSorted((a, b) =>
      placementKey(a).localeCompare(placementKey(b))
    ),
  }
}
function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
function prerequisites(chain: OutboxEntry[], entries: OutboxEntry[]) {
  const ids = new Set(chain.map((entry) => entry.operation.operationId)),
    byId = new Map(
      entries.map((entry) => [entry.operation.operationId, entry])
    ),
    needed = new Set(
      chain.flatMap((entry) => entry.dependencies.filter((id) => !ids.has(id)))
    )
  const pending = [...needed]
  while (pending.length) {
    const id = pending.pop(),
      entry = id ? byId.get(id) : undefined
    if (entry?.state !== "acknowledged")
      throw new Error(
        "Placement recovery requires acknowledged external prerequisites"
      )
    for (const id of entry.dependencies)
      if (!needed.has(id)) {
        needed.add(id)
        pending.push(id)
      }
  }
  return entries
    .filter((entry) => needed.has(entry.operation.operationId))
    .toSorted((a, b) => a.sequence - b.sequence)
}

// Observed catalogs are review evidence, not proof of server completeness or authorization to write.
export function capturePlacementResolutionSnapshot(
  input: unknown
): PlacementResolutionSnapshot {
  return captureSnapshot(input, "simple")
}
export function captureMixedPlacementResolutionSnapshot(
  input: unknown
): PlacementResolutionSnapshot {
  return captureSnapshot(input, "mixed_simple")
}
export function captureRecurringPlacementResolutionSnapshot(
  input: unknown
): PlacementResolutionSnapshot {
  return captureSnapshot(input, "recurring_primary")
}
export function captureCategoryPlacementResolutionSnapshot(
  input: unknown
): PlacementResolutionSnapshot {
  return captureSnapshot(input, "category_movement")
}
type PlacementRecoveryScope =
  | "simple"
  | "mixed_simple"
  | "recurring_primary"
  | "category_movement"
function captureSnapshot(
  input: unknown,
  scope: PlacementRecoveryScope
): PlacementResolutionSnapshot {
  const value = placementResolutionCaptureSchema.parse(input),
    { incident, entries, userId } = value
  personalQueueDiagnosticsInputSchema.parse({
    userId,
    items: value.local.items,
    entries,
  })
  const chain = entries
    .filter(
      (entry) =>
        entry.entityKey === incident.entry.entityKey &&
        isUnresolvedOutboxEntry(entry)
    )
    .toSorted((a, b) => a.sequence - b.sequence)
  if (!same(chain, incident.intentions) || !same(chain[0], incident.entry))
    throw new Error(
      "Placement recovery requires its exact complete chain and first conflict"
    )
  const ids = new Set(chain.map((entry) => entry.operation.operationId))
  for (const entry of entries)
    if (isUnresolvedOutboxEntry(entry) && !ids.has(entry.operation.operationId))
      throw new Error("Placement recovery has another unresolved intention")
  const snapshot = {
    incident: { ...incident, tagNames: {} },
    local: canonicalCatalog(value.local),
    observed: canonicalCatalog(value.observed),
    acknowledgedDependencies: prerequisites(chain, entries),
  }
  return validateSnapshot(snapshot, userId, scope)
}
export function validatePlacementResolutionSnapshot(
  input: unknown,
  actor: string
): PlacementResolutionSnapshot {
  return validateSnapshot(input, actor, "simple")
}
export function validateMixedPlacementResolutionSnapshot(
  input: unknown,
  actor: string
): PlacementResolutionSnapshot {
  return validateSnapshot(input, actor, "mixed_simple")
}
export function validateRecurringPlacementResolutionSnapshot(
  input: unknown,
  actor: string
): PlacementResolutionSnapshot {
  return validateSnapshot(input, actor, "recurring_primary")
}
export function validateCategoryPlacementResolutionSnapshot(
  input: unknown,
  actor: string
): PlacementResolutionSnapshot {
  return validateSnapshot(input, actor, "category_movement")
}
function validateSnapshot(
  input: unknown,
  actor: string,
  scope: PlacementRecoveryScope
): PlacementResolutionSnapshot {
  const value = placementResolutionSnapshotSchema.parse(input),
    { incident, local, observed } = value,
    command = incident.entry.operation.command
  if (
    command.type !== "task.move" ||
    (scope !== "category_movement" &&
      (scope === "recurring_primary"
        ? command.occurrenceId === null
        : command.occurrenceId !== null)) ||
    incident.entry.userId !== actor ||
    incident.reason !== "conflict" ||
    incident.entry.state !== "conflict" ||
    incident.entry.attempts < 1 ||
    incident.entry.lease !== null ||
    incident.blockedByRelatedIntentions
  )
    throw new Error(
      scope === "category_movement"
        ? "Category movement recovery requires its own isolated conflict"
        : "Placement recovery requires its own isolated simple movement conflict"
    )
  const key = taskPlacementEntityKey(
    command.occurrenceId ?? command.itemId,
    command.scope,
    command.date
  )
  if (
    incident.entry.entityKey !== key ||
    !same(local, canonicalCatalog(local)) ||
    !same(observed, canonicalCatalog(observed))
  )
    throw new Error(
      "Placement comparison identities or catalog order are inconsistent"
    )
  for (const catalog of [local, observed])
    remoteRecurringTaskPlacementPlanningInputSchema.parse({
      userId: actor,
      timestamp: incident.entry.createdAt,
      operation: incident.entry.operation,
      ...catalog,
    })
  for (const field of ["items", "tags", "views", "occurrences"] as const)
    if (
      (scope !== "category_movement" || field !== "views") &&
      !same(local[field], observed[field])
    )
      throw new Error(
        "Placement recovery cannot replace content, categories or assignments"
      )
  const parent = observed.items.find((item) => item.id === command.itemId)
  if (
    parent?.kind !== "plan" ||
    parent.deletedAt ||
    Boolean(parent.recurrence) !==
      (scope === "category_movement"
        ? command.occurrenceId !== null
        : scope === "recurring_primary") ||
    (scope !== "recurring_primary" &&
      scope !== "category_movement" &&
      (command.scope === "day"
        ? !planIncludesDate(parent, command.date)
        : !isPlanOverdue(parent, command.date)))
  )
    throw new Error(
      "Placement recovery requires its living simple plan in the declared civil scope"
    )
  const activeTags = new Set(
      observed.tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
    ),
    view = observed.views.find((view) => view.itemId === parent.id),
    effective =
      view?.primaryTagId && activeTags.has(view.primaryTagId)
        ? view.primaryTagId
        : null
  if (
    !view ||
    view.deletedAt ||
    (scope !== "category_movement" && effective !== command.tagId) ||
    (command.tagId !== null && !activeTags.has(command.tagId))
  )
    throw new Error(
      "Placement recovery cannot change its reviewed category group"
    )
  if (
    scope === "simple" &&
    observed.items.some(
      (item) =>
        item.kind === "plan" &&
        item.recurrence &&
        !item.deletedAt &&
        (() => {
          const view = observed.views.find((view) => view.itemId === item.id)
          return (
            (view?.primaryTagId && activeTags.has(view.primaryTagId)
              ? view.primaryTagId
              : null) === command.tagId
          )
        })()
    )
  )
    throw new Error(
      "Placement recovery cannot replace a group containing recurring plans"
    )
  const localByKey = new Map(
      local.placements.map((record) => [placementKey(record), record])
    ),
    remoteByKey = new Map(
      observed.placements.map((record) => [placementKey(record), record])
    )
  if (
    localByKey.size !== remoteByKey.size ||
    [...localByKey.keys()].some((key) => !remoteByKey.has(key))
  )
    throw new Error(
      "Placement recovery cannot infer missing or uncommitted placement identities"
    )
  const primary = localByKey.get(key),
    remote = remoteByKey.get(key)
  if (
    !primary ||
    !remote ||
    primary.deletedAt ||
    primary.tagId !== command.tagId ||
    (scope !== "category_movement" && remote.tagId !== command.tagId)
  )
    throw new Error("Placement primary is absent or belongs to another group")
  if (scope === "category_movement") {
    reviewCategoryPlacementGroups({
      userId: actor,
      operation: incident.entry.operation,
      local,
      observed,
    })
  } else if (scope !== "simple") {
    const review = (
      scope === "recurring_primary"
        ? reviewRecurringPlacementGroup
        : reviewPlacementGroup
    )({
      userId: actor,
      operation: incident.entry.operation,
      local,
      observed,
    })
    if (!review.includesRecurringPeers)
      throw new Error(
        "Mixed placement decision requires a visible recurring peer"
      )
  } else {
    for (const record of local.placements) {
      const other = remoteByKey.get(placementKey(record))
      if (!other) throw new Error("Placement observation is missing")
      if (same(record, other)) continue
      const item = observed.items.find(
        (item) => item.id === record.occurrenceId
      )
      const peerView = observed.views.find(
          (view) => view.itemId === record.occurrenceId
        ),
        peerTag =
          peerView?.primaryTagId && activeTags.has(peerView.primaryTagId)
            ? peerView.primaryTagId
            : null
      if (
        record.scope !== command.scope ||
        record.date !== placementDate(command.scope, command.date) ||
        record.tagId !== command.tagId ||
        other.tagId !== command.tagId ||
        record.deletedAt ||
        (other.deletedAt && record.occurrenceId !== parent.id) ||
        record.revision > other.revision ||
        record.createdAt !== other.createdAt ||
        item?.kind !== "plan" ||
        item.deletedAt ||
        item.recurrence ||
        peerView?.deletedAt ||
        peerTag !== command.tagId ||
        (command.scope === "day"
          ? !planIncludesDate(item, command.date)
          : !isPlanOverdue(item, command.date))
      )
        throw new Error(
          "Placement comparison contains changes outside its reviewed simple group"
        )
    }
  }
  const outcome = validateLocalPreferenceOutcomeV2(incident.outcome, actor)
  if (
    outcome.result.outcome.status !== "conflict" ||
    !same(outcome.operation, incident.entry.operation) ||
    !same(outcome.local, incident.localAtOutcome) ||
    !same(outcome.base, incident.shadowAtOutcome)
  )
    throw new Error("Placement comparison contradicts its frozen outcome")
  function read(snapshot: typeof incident.local): TaskPlacement | null {
    if (snapshot.length !== 1 || snapshot[0].entityKey !== key)
      throw new Error("Placement incident requires one exact primary")
    const effect = snapshot[0].record
    if (
      effect &&
      (effect.store !== "taskPlacements" ||
        effect.record.userId !== actor ||
        placementKey(effect.record) !== key)
    )
      throw new Error("Placement incident contains another entity")
    return effect?.store === "taskPlacements" ? effect.record : null
  }
  if (
    !same(read(incident.local), primary) ||
    !same(read(incident.remote), remote)
  )
    throw new Error("Placement catalog differs from its primary comparison")
  read(incident.localAtOutcome)
  read(incident.shadowAtOutcome)
  for (const snapshot of [
    outcome.base,
    [{ entityKey: key, record: outcome.result.outcome.current }],
  ]) {
    const prior = read(snapshot)
    if (
      prior &&
      (prior.revision > remote.revision ||
        (prior.revision === remote.revision && !same(prior, remote)))
    )
      throw new Error(
        "Placement observation regressed or contradicts frozen remote evidence"
      )
  }
  const all = [...incident.intentions, ...value.acknowledgedDependencies]
  personalQueueDiagnosticsInputSchema.parse({
    userId: actor,
    items: local.items,
    entries: all,
  })
  if (!same(incident.intentions[0], incident.entry))
    throw new Error("Placement chain is missing its first conflict")
  const connected = new Set<string>()
  for (const [index, entry] of incident.intentions.entries()) {
    const next = entry.operation.command
    if (
      entry.userId !== actor ||
      entry.entityKey !== key ||
      next.type !== "task.move" ||
      next.itemId !== parent.id ||
      next.occurrenceId !== command.occurrenceId ||
      next.scope !== command.scope ||
      next.date !== command.date ||
      next.tagId !== command.tagId ||
      entry.lease !== null ||
      (index > 0 &&
        (entry.state !== "pending" ||
          entry.attempts !== 0 ||
          entry.sequence <= incident.intentions[index - 1].sequence ||
          !entry.dependencies.some((id) => connected.has(id))))
    )
      throw new Error(
        "Placement chain contains an unsupported, disconnected or uncertain movement"
      )
    connected.add(entry.operation.operationId)
  }
  if (
    !same(
      prerequisites(incident.intentions, all),
      value.acknowledgedDependencies
    )
  )
    throw new Error(
      "Placement prerequisite evidence is incomplete or unrelated"
    )
  if (Object.keys(incident.tagNames).length)
    throw new Error(
      "Placement review names must come from its captured category catalog"
    )
  return value
}
