import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { localPullCursorSchema, outboxEntrySchema } from "@/schemas/local-sync"
import { planSaveRequestSchema } from "@/schemas/plan-save"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
} from "@/schemas/preferences"
import { revisionSchema } from "@/schemas/primitives"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import { syncCommandSchema } from "@/schemas/sync"

export const planSyncBrowserCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("prepare") }),
  z.strictObject({ type: z.literal("snapshot") }),
  z.strictObject({ type: z.literal("run") }),
  z.strictObject({ type: z.literal("cleanup") }),
  z.strictObject({ type: z.literal("drop-response") }),
  z.strictObject({ type: z.literal("network"), online: z.boolean() }),
  z.strictObject({ type: z.literal("save"), request: planSaveRequestSchema }),
  z.strictObject({ type: z.literal("commit"), command: syncCommandSchema }),
])
export const planSyncBrowserSnapshotSchema = z.strictObject({
  items: z.array(calendarItemSchema),
  tags: z.array(tagSchema),
  views: z.array(itemViewSchema),
  placements: z.array(taskPlacementSchema),
  entries: z.array(outboxEntrySchema),
  cursor: localPullCursorSchema,
})
export const planSyncBrowserRemoteSchema = planSyncBrowserSnapshotSchema
  .omit({ entries: true, cursor: true })
  .extend({ page: remoteChangesPageV2Schema, receiptCount: revisionSchema })
