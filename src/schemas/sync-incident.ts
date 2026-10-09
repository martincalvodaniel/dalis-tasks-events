import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localOperationOutcomeSchema,
  outboxEntrySchema,
} from "@/schemas/local-sync"
import { observedTaskPlacementSchema } from "@/schemas/personal-snapshot"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"

export const syncIncidentProjectionSchema = z.strictObject({
  userId: userIdSchema,
  entry: outboxEntrySchema,
  outcome: localOperationOutcomeSchema,
  local: calendarItemSchema.nullable(),
  remote: calendarItemSchema.nullable(),
})

export const syncIncidentSnapshotInputSchema = z.strictObject({
  userId: userIdSchema,
  entries: z.array(outboxEntrySchema),
  items: z.array(calendarItemSchema),
  shadows: z.array(z.unknown()),
  outcomes: z.array(z.unknown()),
})

export const syncIncidentOverviewInputSchema =
  syncIncidentSnapshotInputSchema.extend({
    tags: z.array(tagSchema),
    itemViews: z.array(itemViewSchema),
    taskPlacements: z.array(observedTaskPlacementSchema),
  })

export const syncIncidentSnapshotSchema = z.strictObject({
  entry: outboxEntrySchema,
  reason: z.enum([
    "conflict",
    "unavailable",
    "invalid_command",
    "identity_reuse",
  ]),
  local: calendarItemSchema.nullable(),
  localAtOutcome: calendarItemSchema.nullable(),
  shadowAtOutcome: calendarItemSchema.nullable(),
  remote: calendarItemSchema.nullable(),
  intentions: z.array(outboxEntrySchema).min(1),
  blockedByRelatedIntentions: z.boolean().default(false),
})
