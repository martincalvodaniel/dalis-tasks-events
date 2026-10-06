"use client"

import type { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import { itemMembershipSchema, shareInvitationSchema } from "@/schemas/sharing"

export const localSchemas = {
  items: calendarItemSchema,
  occurrences: itemOccurrenceSchema,
  tags: tagSchema,
  itemViews: itemViewSchema,
  taskPlacements: taskPlacementSchema,
  settings: userSettingsSchema,
  memberships: itemMembershipSchema,
  invitations: shareInvitationSchema,
}

export type LocalStoreName = keyof typeof localSchemas
export type LocalRecords = {
  [Store in LocalStoreName]: z.infer<(typeof localSchemas)[Store]>
}

interface IndexDefinition {
  name: string
  keyPath: string | string[]
  unique?: boolean
}
interface StoreDefinition {
  keyPath: string | string[]
  indexes: readonly IndexDefinition[]
}
export const localStoreDefinitions: Record<LocalStoreName, StoreDefinition> = {
  items: {
    keyPath: "id",
    indexes: [
      { name: "byKind", keyPath: "kind" },
      { name: "byTaskDate", keyPath: ["kind", "scheduledDate"] },
    ],
  },
  occurrences: {
    keyPath: "id",
    indexes: [
      { name: "bySeries", keyPath: "seriesId" },
      { name: "bySlot", keyPath: ["seriesId", "slotKey"], unique: true },
      { name: "byTaskDate", keyPath: ["kind", "scheduledDate"] },
    ],
  },
  tags: {
    keyPath: "id",
    indexes: [{ name: "byPosition", keyPath: "position" }],
  },
  itemViews: {
    keyPath: "itemId",
    indexes: [{ name: "byTag", keyPath: "primaryTagId" }],
  },
  taskPlacements: {
    keyPath: ["occurrenceId", "scope", "date"],
    indexes: [{ name: "byDateAndScope", keyPath: ["date", "scope"] }],
  },
  settings: { keyPath: "userId", indexes: [] },
  memberships: {
    keyPath: ["itemId", "userId"],
    indexes: [{ name: "byItem", keyPath: "itemId" }],
  },
  invitations: {
    keyPath: "id",
    indexes: [{ name: "byStatus", keyPath: "status" }],
  },
}

export function parseLocalRecord<Store extends LocalStoreName>(
  store: Store,
  value: unknown,
  userId: string
): LocalRecords[Store] {
  const record = localSchemas[store].parse(value)
  if (
    (store === "tags" ||
      store === "itemViews" ||
      store === "taskPlacements" ||
      store === "settings") &&
    "userId" in record &&
    record.userId !== userId
  ) {
    throw new Error("Personal record belongs to a different account")
  }
  return record as LocalRecords[Store]
}
