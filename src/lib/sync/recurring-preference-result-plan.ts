import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import {
  planLocalPreferenceResult,
  planLocalSettingsPreferenceResult,
} from "@/lib/sync/preference-result-plan"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { recurringPreferenceResultPlanInputSchema } from "@/schemas/recurring-preference-result-plan"

// Future composition validates every family before projecting the personal result.
export function planLocalRecurringPreferenceResult(input: unknown) {
  return planRecurringPreferenceResult(input, false)
}

export function planLocalRecurringSettingsResult(input: unknown) {
  return planRecurringPreferenceResult(input, true)
}

function planRecurringPreferenceResult(input: unknown, allowSettings: boolean) {
  const value = recurringPreferenceResultPlanInputSchema.parse(input)
  personalQueueDiagnosticsInputSchema.parse({
    userId: value.userId,
    items: value.items,
    entries: value.entries,
  })
  const parents = new Map(value.items.map((item) => [item.id, item]))
  const shadows = value.shadows.map((shadow) =>
    decodeRemoteRecurringShadow(shadow, value.userId)
  )
  if (
    new Set(shadows.map((shadow) => shadow.entityKey)).size !== shadows.length
  )
    throw new Error(
      "Recurring personal result contains duplicate shadow identities"
    )
  for (const shadow of shadows)
    if (
      shadow.kind === "plan-occurrence" &&
      parents.get(shadow.record.seriesId)?.kind !== "plan"
    )
      throw new Error(
        "Recurring personal result appearance parent is unavailable"
      )
  const { items: _, ...personal } = value
  const project = allowSettings
    ? planLocalSettingsPreferenceResult
    : planLocalPreferenceResult
  const plan = project({
    ...personal,
    shadows: shadows.filter((shadow) => shadow.kind !== "plan-occurrence"),
  })
  const complete = [
    ...shadows.filter((shadow) => shadow.kind !== "preference"),
    ...plan.shadows,
  ]
  if (complete.length > 10000)
    throw new Error(
      "Recurring personal result exceeds the complete shadow limit"
    )
  return { ...plan, shadows: complete }
}
