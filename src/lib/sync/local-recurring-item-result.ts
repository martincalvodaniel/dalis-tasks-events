import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { localSyncResultInputSchema } from "@/schemas/local-sync"
import { planDraftSchema } from "@/schemas/plan-item"
import { userIdSchema } from "@/schemas/primitives"

// Future root-item correspondence. Appearance results use their separate result port.
export function validateLocalRecurringItemResult(
  input: unknown,
  userIdInput: unknown
) {
  const userId = userIdSchema.parse(userIdInput),
    value = localSyncResultInputSchema.parse(input)
  const { operation, result } = value,
    command = operation.command
  if (
    ![
      "item.create",
      "item.update",
      "item.delete",
      "task.set-status",
      "task.set-checklist-entry",
      "plan.set-status",
      "plan.set-checklist-entry",
    ].includes(command.type) ||
    !("itemId" in command)
  )
    throw new Error("Recurring root result does not support this command")
  validateRemotePushResultV2(
    {
      transportVersion: 2,
      status: "complete",
      results: [{ kind: "item", outcome: result }],
    },
    userId,
    { transportVersion: 2, expectedUserId: userId, operations: [operation] }
  )
  if (result.status !== "applied") return value
  const item = result.item
  if (item.revision !== operation.baseRevision + 1)
    throw new Error(
      "Recurring root revision does not follow its submitted base"
    )
  if (item.kind === "birthday" || (item.recurrence && item.kind !== "plan"))
    throw new Error("Recurring root result supports only common plan series")
  if (item.kind === "plan") {
    if (
      item.recurrence &&
      (command.type === "plan.set-status" ||
        command.type === "plan.set-checklist-entry")
    )
      throw new Error("Recurring root progress cannot be acknowledged")
    if (command.type === "item.create" || command.type === "item.update") {
      const {
        id: _,
        ownerId: __,
        revision: ___,
        createdAt: ____,
        updatedAt: _____,
        deletedAt: ______,
        completedAt: _______,
        ...draft
      } = item
      if (
        JSON.stringify(planDraftSchema.parse(draft)) !==
        JSON.stringify(planDraftSchema.parse(command.input))
      )
        throw new Error("Recurring root content does not match its command")
    }
  }
  return value
}
