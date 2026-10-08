import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"

export const personalQueueDiagnosticsInputSchema = z
  .strictObject({
    userId: userIdSchema,
    entries: z.array(outboxEntrySchema).max(10000),
    items: z.array(calendarItemSchema).max(10000),
  })
  .superRefine((value, context) => {
    const reject = (message: string) =>
      context.addIssue({ code: "custom", message })
    const entries = new Map(
      value.entries.map((entry) => [entry.operation.operationId, entry])
    )
    if (
      entries.size !== value.entries.length ||
      new Set(value.entries.map((entry) => entry.sequence)).size !==
        value.entries.length
    )
      reject("Queue diagnostics contain duplicate intention identities")
    if (new Set(value.items.map((item) => item.id)).size !== value.items.length)
      reject("Queue diagnostics contain duplicate item identities")
    for (const item of value.items)
      if (item.ownerId !== value.userId)
        reject("Queue diagnostic item belongs to another account")
    for (const entry of value.entries) {
      if (entry.userId !== value.userId)
        reject("Queue diagnostic intention belongs to another account")
      for (const id of entry.dependencies) {
        const parent = entries.get(id)
        if (!parent || parent.sequence >= entry.sequence)
          reject("Queue diagnostics require complete ordered dependencies")
      }
    }
  })
