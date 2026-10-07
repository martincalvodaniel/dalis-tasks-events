import type { z } from "zod"
import type {
  outboxEntrySchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import type { SyncCommand } from "@/types/sync"

export type OutboxEntry = z.infer<typeof outboxEntrySchema>
export type RemoteShadow = z.infer<typeof remoteShadowSchema>
export type LocalPreferenceCommand = Extract<
  SyncCommand,
  {
    type: "tag.save" | "tag.delete" | "tag.move" | "item-view.set" | "task.move"
  }
>
export type LocalItemCommand = Extract<
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
