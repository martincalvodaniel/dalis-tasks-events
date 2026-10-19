import { editablePlanOccurrence } from "@/lib/calendar/plan-occurrence-command"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { planOccurrenceCohortInputSchema } from "@/schemas/plan-occurrence-cohort"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import type { OutboxEntry } from "@/types/local-sync"

// Structural classification only. Exact slot snapshots, outcomes and transaction guards are still required.
export function readPlanOccurrenceRecoveryCohort(input: unknown) {
  const { userId, operationId, series, entries } =
    planOccurrenceCohortInputSchema.parse(input)
  if (
    series.ownerId !== userId ||
    series.deletedAt ||
    !series.recurrence ||
    series.revision < 1
  )
    throw new Error(
      "Appearance cohort requires its own living committed recurring parent"
    )
  personalQueueDiagnosticsInputSchema.parse({
    userId,
    items: [series],
    entries,
  })
  const key = `item:${series.id}`,
    intentions = entries
      .filter(
        (entry) => entry.entityKey === key && isUnresolvedOutboxEntry(entry)
      )
      .toSorted((a, b) => a.sequence - b.sequence),
    root = intentions[0]
  if (
    !root ||
    root.operation.operationId !== operationId ||
    root.state !== "conflict" ||
    root.attempts < 1 ||
    root.lease !== null
  )
    throw new Error("Appearance cohort requires its exact first conflict")
  const connected = new Set<string>(),
    slots = new Map<string, OutboxEntry[]>(),
    ids = new Set(intentions.map((entry) => entry.operation.operationId)),
    byId = new Map(
      entries.map((entry) => [entry.operation.operationId, entry])
    ),
    needed = new Set<string>()
  for (const [index, entry] of intentions.entries()) {
    const operation = remotePlanOccurrenceOperationSchema.parse(
        entry.operation
      ),
      command = operation.command
    if (
      command.itemId !== series.id ||
      entry.userId !== userId ||
      entry.lease !== null ||
      operation.baseRevision > series.revision ||
      (index > 0 &&
        (entry.state !== "pending" ||
          entry.attempts !== 0 ||
          !entry.dependencies.some((id) => connected.has(id))))
    )
      throw new Error(
        "Appearance cohort contains another family, parent or uncertain disconnected intention"
      )
    editablePlanOccurrence(
      series,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: series.id,
        occurrenceId: command.occurrenceId,
        status: "not_started",
      },
      userId
    )
    const selected = slots.get(command.occurrenceId) ?? []
    selected.push(entry)
    slots.set(command.occurrenceId, selected)
    for (const id of entry.dependencies) if (!ids.has(id)) needed.add(id)
    connected.add(entry.operation.operationId)
  }
  if (slots.size < 2)
    throw new Error(
      "Multiple-slot classification requires at least two reviewed slots"
    )
  for (const entry of entries) {
    if (ids.has(entry.operation.operationId)) continue
    if (entry.dependencies.some((id) => ids.has(id)))
      throw new Error("Appearance cohort has an unreviewed external dependent")
    const command = entry.operation.command
    if (
      isUnresolvedOutboxEntry(entry) &&
      "itemId" in command &&
      command.itemId === series.id
    )
      throw new Error(
        "Appearance cohort has another unresolved operation on its parent"
      )
  }
  const pending = [...needed]
  while (pending.length) {
    const id = pending.pop(),
      entry = id ? byId.get(id) : undefined
    if (entry?.state !== "acknowledged")
      throw new Error(
        "Appearance cohort requires acknowledged external prerequisites"
      )
    for (const id of entry.dependencies)
      if (!needed.has(id)) {
        needed.add(id)
        pending.push(id)
      }
  }
  return {
    series,
    root,
    intentions,
    slots: [...slots].map(([occurrenceId, intentions]) => ({
      occurrenceId,
      intentions,
    })),
    acknowledgedDependencies: entries
      .filter((entry) => needed.has(entry.operation.operationId))
      .toSorted((a, b) => a.sequence - b.sequence),
  }
}
