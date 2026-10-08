import { applyItemViewCommand } from "@/lib/preferences/preference-command"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { revisionSchema } from "@/schemas/primitives"
import { remoteItemViewPlanningInputSchema } from "@/schemas/remote-item-view-planning"
import type { ItemView } from "@/types/preferences"
import type { RemoteItemViewPlan } from "@/types/remote-item-view-planning"

// Access checks belong to the future authenticated, own-item repository service.
export function planRemoteItemViewOperation(
  input: unknown
): RemoteItemViewPlan {
  const { userId, timestamp, operation, item, current, tag } =
    remoteItemViewPlanningInputSchema.parse(input)
  const command = operation.command
  if (command.type !== "item-view.set") return { status: "unsupported" }
  if (!item || item.deletedAt) return { status: "unavailable" }
  if (item.kind === "birthday" || item.recurrence)
    return { status: "unsupported" }
  if (
    current &&
    (current.deletedAt || current.revision !== operation.baseRevision)
  )
    return { status: "conflict", current }
  if (!current && operation.baseRevision !== 0) return { status: "unavailable" }
  let record: ItemView
  try {
    record = applyItemViewCommand(
      current,
      item,
      tag,
      command,
      userId,
      timestamp
    )
  } catch {
    return { status: "invalid_command" }
  }
  record.revision = revisionSchema.parse((current?.revision ?? 0) + 1)
  // No journal number is allocated; reserve its maximum serialized width.
  const bounded = remotePreferenceEffectsSchema.safeParse({
    version: 1,
    userId,
    operationId: operation.operationId,
    sequence: Number.MAX_SAFE_INTEGER,
    effects: [{ store: "itemViews", record }],
  })
  if (!bounded.success) return { status: "invalid_command" }
  return { status: "changes", effects: bounded.data.effects }
}
