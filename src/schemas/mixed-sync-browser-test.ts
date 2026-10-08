import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { localPullCursorSchema, outboxEntrySchema } from "@/schemas/local-sync"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import { syncCommandSchema } from "@/schemas/sync"

export const mixedSyncBrowserCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("snapshot") }),
  z.strictObject({ type: z.literal("send") }),
  z.strictObject({ type: z.literal("pull") }),
  z.strictObject({ type: z.literal("coordinate") }),
  z.strictObject({ type: z.literal("cleanup") }),
  z.strictObject({ type: z.literal("drop-response") }),
  z.strictObject({ type: z.literal("network"), online: z.boolean() }),
  z.strictObject({ type: z.literal("commit"), command: syncCommandSchema }),
])

export const mixedSyncBrowserSnapshotSchema = z.strictObject({
  items: z.array(calendarItemSchema),
  tags: z.array(tagSchema),
  views: z.array(itemViewSchema),
  entries: z.array(outboxEntrySchema),
  shadows: z.array(z.unknown()),
  outcomes: z.array(z.unknown()),
  cursor: localPullCursorSchema,
})

export const mixedSyncBrowserRemoteSchema = z.strictObject({
  items: z.array(calendarItemSchema),
  tags: z.array(tagSchema),
  views: z.array(itemViewSchema),
  page: remoteChangesPageV2Schema,
})
