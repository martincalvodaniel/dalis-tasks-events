import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localOperationOutcomeSchema,
  localPullCursorSchema,
  outboxEntrySchema,
  outboxSequenceSchema,
  preferenceTailSchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import { itemMembershipSchema, shareInvitationSchema } from "@/schemas/sharing"
import { syncResolutionRecordSchema } from "@/schemas/sync-resolution"

export const localBackupMetadataSchema = z.union([
  outboxSequenceSchema,
  preferenceTailSchema,
  localPullCursorSchema,
  localOperationOutcomeSchema,
  syncResolutionRecordSchema,
])
export const localBackupStoresSchema = z.strictObject({
  items: z.array(calendarItemSchema).max(10000),
  occurrences: z.array(itemOccurrenceSchema).max(10000),
  tags: z.array(tagSchema).max(10000),
  itemViews: z.array(itemViewSchema).max(10000),
  taskPlacements: z.array(taskPlacementSchema).max(10000),
  settings: z.array(userSettingsSchema).max(1),
  memberships: z.array(itemMembershipSchema).max(10000),
  invitations: z.array(shareInvitationSchema).max(10000),
  outbox: z.array(outboxEntrySchema).max(10000),
  remoteShadows: z.array(remoteShadowSchema).max(10000),
  syncMetadata: z.array(localBackupMetadataSchema).max(10000),
})
export const localBackupSchema = z.strictObject({
  format: z.literal("dalis-local-backup"),
  version: z.literal(1),
  protocolVersion: z.literal(1),
  databaseVersion: z.literal(2),
  userId: userIdSchema,
  exportedAt: timestampSchema,
  stores: localBackupStoresSchema,
})
