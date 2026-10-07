import type { OrderableTask } from "@/lib/ordering/task-order"
import {
  civilDateSchema,
  occurrenceIdSchema,
  timestampSchema,
} from "@/schemas/primitives"

// Candidate implicit key: validated ISO dates sort with binary < and >.
export function defaultTaskOrderKey(task: OrderableTask): string {
  const date = civilDateSchema.parse(task.scheduledDate)
  const createdAt = timestampSchema.parse(task.createdAt)
  const id = occurrenceIdSchema.parse(task.id)
  return `${date}:${createdAt}:${id}`
}
