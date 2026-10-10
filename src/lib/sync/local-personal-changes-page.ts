import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import { planRemotePreferenceProjection } from "@/lib/sync/preference-projection"
import { localPersonalChangesPageSchema } from "@/schemas/local-personal-changes-page"
import { userIdSchema } from "@/schemas/primitives"

// This personal plan is only one part of the future atomic mixed-page application.
export function planLocalPersonalChangesPage(
  input: unknown,
  actorInput: unknown,
  allowPlans = false
) {
  const userId = userIdSchema.parse(actorInput)
  const value = localPersonalChangesPageSchema.parse(input)
  if (value.state.userId !== userId)
    throw new Error("Personal download state belongs to another account")
  const receipt = validateLocalChangesPageInputV2(
    value.receipt,
    userId,
    allowPlans
  )
  let projection = planRemotePreferenceProjection(value.state)
  for (const change of receipt.page.changes) {
    if (change.kind !== "preference") continue
    projection = planRemotePreferenceProjection({
      userId,
      local: projection.local,
      shadows: projection.shadows,
      incoming: change.effects,
      entries: value.state.entries,
    })
  }
  return projection
}
