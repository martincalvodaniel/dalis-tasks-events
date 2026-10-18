import { availableSyncIncidentResolutionChoices } from "@/lib/sync/incident-resolution"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { planCategoryRecoveryChainInputSchema } from "@/schemas/plan-category-recovery-chain"

// This preparatory classification does not authorize a write or replace the transaction's reread.
export function readPlanCategoryRecoveryChain(input: unknown) {
  const value = planCategoryRecoveryChainInputSchema.parse(input)
  const { incident, entries, userId } = value
  const { local, remote } = incident
  if (
    !local ||
    !remote ||
    local.kind !== "plan" ||
    remote.kind !== "plan" ||
    local.recurrence ||
    remote.recurrence ||
    local.deletedAt ||
    remote.deletedAt ||
    local.ownerId !== userId ||
    remote.ownerId !== userId ||
    local.id !== remote.id ||
    incident.entry.entityKey !== `item:${local.id}`
  )
    throw new Error(
      "Joint recovery requires its own living simple plan and known remote"
    )
  personalQueueDiagnosticsInputSchema.parse({ userId, items: [local], entries })
  const byId = new Map(
    entries.map((entry) => [entry.operation.operationId, entry])
  )
  const content = entries
    .filter(
      (entry) =>
        entry.entityKey === incident.entry.entityKey &&
        isUnresolvedOutboxEntry(entry)
    )
    .toSorted((a, b) => a.sequence - b.sequence)
  if (JSON.stringify(content) !== JSON.stringify(incident.intentions))
    throw new Error(
      "Joint recovery requires the exact complete content intentions"
    )
  const normalized = { ...incident, blockedByRelatedIntentions: false }
  if (
    !availableSyncIncidentResolutionChoices(normalized, true).includes(
      "retry_local"
    )
  )
    throw new Error("Joint recovery content is unsupported or uncertain")
  const views = entries
    .filter(
      (entry) =>
        entry.entityKey === `item-view:${local.id}` &&
        isUnresolvedOutboxEntry(entry)
    )
    .toSorted((a, b) => a.sequence - b.sequence)
  if (
    !views.length ||
    views.some(
      (entry) =>
        entry.userId !== userId ||
        entry.state !== "pending" ||
        entry.attempts !== 0 ||
        entry.lease !== null ||
        entry.operation.command.type !== "item-view.set" ||
        entry.operation.command.itemId !== local.id
    )
  )
    throw new Error(
      "Joint recovery requires only unattempted category assignments"
    )
  const connected = new Set(content.map((entry) => entry.operation.operationId))
  for (const entry of views) {
    if (!entry.dependencies.some((id) => connected.has(id)))
      throw new Error(
        "Joint category assignments are disconnected from reviewed content"
      )
    connected.add(entry.operation.operationId)
  }
  const intentions = [...content, ...views].toSorted(
    (a, b) => a.sequence - b.sequence
  )
  const ids = new Set(intentions.map((entry) => entry.operation.operationId))
  for (const entry of entries) {
    if (!isUnresolvedOutboxEntry(entry)) continue
    if (ids.has(entry.operation.operationId)) {
      if (
        entry.dependencies.some(
          (id) => !ids.has(id) && byId.get(id)?.state !== "acknowledged"
        )
      )
        throw new Error(
          "Joint recovery has an unresolved external prerequisite"
        )
    } else {
      if (entry.dependencies.some((id) => ids.has(id)))
        throw new Error("Joint recovery has an unreviewed external dependent")
      const command = entry.operation.command
      if ("itemId" in command && command.itemId === local.id)
        throw new Error(
          "Joint recovery has another unresolved operation on the same plan"
        )
    }
  }
  return { incident: normalized, content, views, intentions }
}
