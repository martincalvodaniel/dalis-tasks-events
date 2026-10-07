import type { z } from "zod"
import type { syncCommandSchema, syncOperationSchema } from "@/schemas/sync"

export type SyncCommand = z.infer<typeof syncCommandSchema>
export type SyncOperation = z.infer<typeof syncOperationSchema>

export type ItemCommand = Extract<
  SyncCommand,
  {
    type:
      | "item.create"
      | "item.update"
      | "item.delete"
      | "task.set-status"
      | "task.set-checklist-entry"
  }
>
