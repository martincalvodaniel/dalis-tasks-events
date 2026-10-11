import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { planOccurrenceProjectionInputSchema } from "@/schemas/plan-occurrence-projection"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { RemotePlanOccurrenceShadow } from "@/types/remote-recurring-sync"

export interface PlanOccurrenceProjection {
  local: PlanOccurrence | null
  shadow: RemotePlanOccurrenceShadow | null
  pending: boolean
}

// Pull describes current evidence; it does not rewrite intentions or establish ancestry.
export function planRemotePlanOccurrenceProjection(
  input: unknown
): PlanOccurrenceProjection {
  const value = planOccurrenceProjectionInputSchema.parse(input)
  personalQueueDiagnosticsInputSchema.parse({
    userId: value.userId,
    items: value.series ? [value.series] : [],
    entries: value.entries,
  })
  if (value.series && value.series.id !== value.key.seriesId)
    throw new Error("Appearance projection parent identity is inconsistent")
  for (const record of [
    value.local,
    value.shadow?.record,
    value.incoming?.record,
  ])
    if (
      record &&
      (record.id !== value.key.id || record.seriesId !== value.key.seriesId)
    )
      throw new Error(
        "Appearance projection records target another slot or series"
      )
  for (const shadow of [value.shadow, value.incoming])
    if (shadow) decodeRemoteRecurringShadow(shadow, value.userId)
  let shadow = value.shadow
  if (value.incoming) {
    const incoming = value.incoming
    if (!shadow || incoming.record.revision > shadow.record.revision)
      shadow = incoming
    else if (incoming.record.revision === shadow.record.revision) {
      if (JSON.stringify(incoming.record) !== JSON.stringify(shadow.record))
        throw new Error("Remote appearances disagree at the same revision")
      // Conflict observation can see a later parent with the same committed appearance.
      if (incoming.seriesRevision > shadow.seriesRevision) shadow = incoming
    }
  }
  const pending = value.entries.some((entry) => {
    const command = entry.operation.command
    if (
      !isUnresolvedOutboxEntry(entry) ||
      !("itemId" in command) ||
      command.itemId !== value.key.seriesId
    )
      return false
    return (
      !("occurrenceId" in command) ||
      command.occurrenceId === null ||
      command.occurrenceId === value.key.id
    )
  })
  return {
    local: pending ? value.local : (shadow?.record ?? value.local),
    shadow,
    pending,
  }
}
