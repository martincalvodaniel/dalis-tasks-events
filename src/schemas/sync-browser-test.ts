import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localPullCursorSchema,
  outboxEntrySchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import { entityIdSchema } from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import { syncQueueSummarySchema } from "@/schemas/sync-queue"

const loopbackOrigin = z.url().regex(/^http:\/\/127\.0\.0\.1:[1-9]\d{3,4}$/)
export const syncBrowserFixtureSchema = z
  .strictObject({
    runId: entityIdSchema,
    userId: z.string(),
    origins: z.tuple([loopbackOrigin, loopbackOrigin]),
  })
  .refine(
    (value) => value.userId === `browser-test-${value.runId}-sync-devices`,
    "Browser fixture account must match its run"
  )
  .refine(
    (value) => value.origins[0] !== value.origins[1],
    "Browser fixtures require independent origins"
  )

export const syncBrowserCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("snapshot") }),
  z.strictObject({ type: z.literal("run") }),
  z.strictObject({ type: z.literal("cleanup") }),
  z.strictObject({ type: z.literal("network"), online: z.boolean() }),
  z.strictObject({ type: z.literal("drop-response") }),
  z.strictObject({ type: z.literal("commit"), command: syncCommandSchema }),
])

export const syncBrowserSnapshotSchema = z.strictObject({
  summary: syncQueueSummarySchema,
  items: z.array(calendarItemSchema),
  entries: z.array(outboxEntrySchema),
  shadows: z.array(remoteShadowSchema),
  cursor: localPullCursorSchema,
})
