import { z } from "zod"
import { planInputSchema } from "@/schemas/plan-input"
import { planSchema } from "@/schemas/plan-item"
import { itemViewSchema } from "@/schemas/preferences"
import { entityIdSchema, timestampSchema } from "@/schemas/primitives"

const common = {
  itemId: entityIdSchema,
  contentOperationId: entityIdSchema,
  viewOperationId: entityIdSchema,
  input: planInputSchema,
  primaryTagId: entityIdSchema.nullable(),
  now: timestampSchema,
}

export const planSaveRequestSchema = z
  .discriminatedUnion("mode", [
    z.strictObject({ ...common, mode: z.literal("create") }),
    z.strictObject({
      ...common,
      mode: z.literal("update"),
      expectedPlan: planSchema,
      expectedView: itemViewSchema.nullable(),
    }),
  ])
  .superRefine((request, context) => {
    if (request.contentOperationId === request.viewOperationId)
      context.addIssue({
        code: "custom",
        path: ["viewOperationId"],
        message: "Plan save requires distinct operation identifiers",
      })
    if (
      request.mode === "update" &&
      (request.expectedPlan.id !== request.itemId ||
        (request.expectedView &&
          request.expectedView.itemId !== request.itemId))
    )
      context.addIssue({
        code: "custom",
        path: ["itemId"],
        message: "Expected plan and view must match the saved item",
      })
  })

export type PlanSaveRequest = z.infer<typeof planSaveRequestSchema>
