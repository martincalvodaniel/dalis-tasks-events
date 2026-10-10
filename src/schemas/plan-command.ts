import { z } from "zod"
import { taskStatusSchema } from "@/schemas/item-fields"
import { planDraftSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"

export const planCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item.create"),
    itemId: entityIdSchema,
    input: planDraftSchema,
  }),
  z.strictObject({
    type: z.literal("item.update"),
    itemId: entityIdSchema,
    input: planDraftSchema,
  }),
  z.strictObject({ type: z.literal("item.delete"), itemId: entityIdSchema }),
  z.strictObject({
    type: z.literal("plan.set-status"),
    itemId: entityIdSchema,
    status: taskStatusSchema,
  }),
  z.strictObject({
    type: z.literal("plan.set-checklist-entry"),
    itemId: entityIdSchema,
    entryId: entityIdSchema,
    completed: z.boolean(),
  }),
])
