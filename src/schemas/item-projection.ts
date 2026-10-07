import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"

export const itemProjectionInputSchema = z
  .strictObject({
    userId: userIdSchema,
    local: calendarItemSchema.nullable(),
    shadow: calendarItemSchema.nullable(),
    incoming: calendarItemSchema,
    entries: z.array(outboxEntrySchema),
  })
  .superRefine((input, context) => {
    const id = input.incoming.id
    for (const record of [input.local, input.shadow, input.incoming]) {
      if (record && (record.id !== id || record.ownerId !== input.userId))
        context.addIssue({
          code: "custom",
          message: "Projection records must match the account and identity",
        })
    }
    const operationIds = new Set<string>()
    const sequences = new Set<number>()
    for (const entry of input.entries) {
      if (
        entry.userId !== input.userId ||
        entry.entityKey !== `item:${id}` ||
        operationIds.has(entry.operation.operationId) ||
        sequences.has(entry.sequence)
      )
        context.addIssue({
          code: "custom",
          message:
            "Projection operations must uniquely match the account and entity",
        })
      operationIds.add(entry.operation.operationId)
      sequences.add(entry.sequence)
    }
    if (
      input.incoming.revision < 1 ||
      (input.shadow && input.shadow.revision < 1)
    )
      context.addIssue({
        code: "custom",
        message: "Remote projection records require a committed revision",
      })
  })
