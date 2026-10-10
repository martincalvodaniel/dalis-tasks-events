import { applyItemCommand } from "@/lib/calendar/item-command"
import { applyItemViewCommand } from "@/lib/preferences/preference-command"
import { planSchema } from "@/schemas/plan-item"
import {
  type PlanSaveRequest,
  planSaveRequestSchema,
} from "@/schemas/plan-save"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { ItemView, Tag } from "@/types/preferences"

export function planSaveCommands(requestInput: PlanSaveRequest) {
  const request = planSaveRequestSchema.parse(requestInput)
  return {
    content: {
      type:
        request.mode === "create"
          ? ("item.create" as const)
          : ("item.update" as const),
      itemId: request.itemId,
      input: request.input,
    },
    view: {
      type: "item-view.set" as const,
      itemId: request.itemId,
      primaryTagId: request.primaryTagId,
    },
  }
}

export function preparePlanSave(
  requestInput: PlanSaveRequest,
  currentPlanInput: Plan | null,
  currentViewInput: ItemView | null,
  tagInput: Tag | null,
  userId: string
) {
  const request = planSaveRequestSchema.parse(requestInput)
  const actor = userIdSchema.parse(userId)
  const currentPlan =
    currentPlanInput === null ? null : planSchema.parse(currentPlanInput)
  const currentView =
    currentViewInput === null ? null : itemViewSchema.parse(currentViewInput)
  const tag = tagInput === null ? null : tagSchema.parse(tagInput)
  if (request.mode === "create") {
    if (currentPlan || currentView)
      throw new Error("Plan creation cannot reuse existing content or view")
  } else {
    if (
      request.expectedPlan.ownerId !== actor ||
      (request.expectedView && request.expectedView.userId !== actor)
    )
      throw new Error("Expected plan or view belongs to another account")
    if (JSON.stringify(currentPlan) !== JSON.stringify(request.expectedPlan))
      throw new Error("Plan changed since the editor was opened")
    if (JSON.stringify(currentView) !== JSON.stringify(request.expectedView))
      throw new Error("Plan category changed since the editor was opened")
  }
  const commands = planSaveCommands(request)
  const plan = planSchema.parse(
    applyItemCommand(currentPlan, commands.content, actor, request.now)
  )
  const view = applyItemViewCommand(
    currentView,
    plan,
    tag,
    commands.view,
    actor,
    request.now
  )
  return { plan, view, commands }
}
