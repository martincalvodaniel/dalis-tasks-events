import { expect, test } from "bun:test"
import { decodeLocalBackup, encodeLocalBackup } from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { calendarItemToDraft } from "@/lib/calendar/item-draft"
import { supportsRemoteItemCommand } from "@/lib/sync/item-command-support"
import { readPlacementSyncCommandCapability } from "@/lib/sync/sync-capabilities"
import { calendarItemDraftSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planDraftSchema } from "@/schemas/plan-item"
import { syncOperationSchema } from "@/schemas/sync"
import type { PlanDraft } from "@/types/plan-item"

const userId = "plan-contract-test"
const now = "2026-10-10T09:00:00.000Z"
const itemId = "b2d10a29-73af-4b53-a753-53e4dba1b110"
const entryId = "b2d10a29-73af-4b53-a753-53e4dba1b111"
const input: PlanDraft = {
  kind: "plan",
  variant: "note",
  title: "Plan",
  description: "",
  schedule: {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-11",
  },
  status: "not_started",
  checklist: [{ id: entryId, text: "Step", completed: false }],
  recurrence: null,
}
const operation = syncOperationSchema.parse({
  operationId: crypto.randomUUID(),
  protocolVersion: 1,
  baseRevision: 0,
  command: { type: "item.create", itemId, input },
})

function createCommand() {
  if (operation.command.type !== "item.create")
    throw new Error("Expected creation command")
  return operation.command
}

test("shared contracts preserve four variants and common progress without rewriting intent", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const draft = calendarItemDraftSchema.parse({ ...input, variant })
    let item = applyItemCommand(
      null,
      { type: "item.create", itemId, input: draft },
      userId,
      now
    )
    item = applyItemCommand(
      item,
      { type: "plan.set-status", itemId, status: "completed" },
      userId,
      now
    )
    item = applyItemCommand(
      item,
      { type: "plan.set-checklist-entry", itemId, entryId, completed: true },
      userId,
      now
    )
    if (item.kind !== "plan") throw new Error("Expected common plan")
    expect(item.variant).toBe(variant)
    expect(item.status).toBe("completed")
    expect(item.checklist[0].completed).toBe(true)
    const changed = applyItemCommand(
      item,
      {
        type: "item.update",
        itemId,
        input: {
          ...planDraftSchema.parse(calendarItemToDraft(item)),
          kind: "plan",
          variant: "note",
        },
      },
      userId,
      now
    )
    expect(changed.id).toBe(itemId)
    expect(changed.revision).toBe(item.revision)
  }
})

test("generation-three capabilities and item executor policy refuse common content before activation", () => {
  const item = applyItemCommand(null, createCommand(), userId, now)
  for (const command of [
    operation.command,
    { type: "item.update", itemId, input } as const,
    { type: "item.delete", itemId } as const,
    { type: "plan.set-status", itemId, status: "completed" } as const,
    {
      type: "plan.set-checklist-entry",
      itemId,
      entryId,
      completed: true,
    } as const,
    { type: "item-view.set", itemId, primaryTagId: null } as const,
  ]) {
    const capability = readPlacementSyncCommandCapability(command, item)
    expect(capability.supported).toBe(false)
    expect(capability.reason).toBe("plan_executor_unavailable")
    expect(supportsRemoteItemCommand(command, item)).toBe(false)
  }
  expect(readPlacementSyncCommandCapability(operation.command).supported).toBe(
    false
  )
})

test("portable backup round trips exact common content and its pending operation", () => {
  const item = applyItemCommand(null, createCommand(), userId, now)
  const entry = outboxEntrySchema.parse({
    userId,
    entityKey: `item:${itemId}`,
    operation,
    sequence: 1,
    dependencies: [],
    state: "pending",
    attempts: 0,
    createdAt: now,
    lease: null,
  })
  const backup = {
    format: "dalis-local-backup",
    version: 2,
    protocolVersion: 1,
    databaseVersion: 2,
    userId,
    exportedAt: now,
    stores: {
      items: [item],
      occurrences: [],
      tags: [],
      itemViews: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      outbox: [entry],
      remoteShadows: [],
      syncMetadata: [{ key: "outbox-sequence", value: 1 }],
    },
  }
  const json = encodeLocalBackup(backup, userId)
  const decoded = decodeLocalBackup(json, userId)
  expect(decoded.stores.items[0]).toEqual(item)
  expect(decoded.stores.outbox[0].operation).toEqual(operation)
  expect(calendarItemToDraft(item)).toEqual(input)
  expect(() => decodeLocalBackup(json, "foreign")).toThrow()
})
