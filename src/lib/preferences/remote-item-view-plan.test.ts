import { expect, test } from "bun:test"
import { planRemoteItemViewOperation } from "@/lib/preferences/remote-item-view-plan"
import { taskSchema } from "@/schemas/calendar-item"
import type { ItemView, Tag } from "@/types/preferences"

const userId = "remote-view-test-owner"
const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const tagId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const createdAt = "2026-10-07T00:00:00.000Z"
const timestamp = "2026-10-08T00:00:00.000Z"
const item = taskSchema.parse({
  id: itemId,
  ownerId: userId,
  kind: "task",
  title: "Current task",
  description: "Content untouched",
  scheduledDate: "2026-10-08",
  status: "in_progress",
  checklist: [
    { id: crypto.randomUUID(), text: "Current step", completed: true },
  ],
  recurrence: null,
  completedAt: null,
  revision: 4,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
})
const tag: Tag = {
  id: tagId,
  userId,
  name: "Work",
  normalizedName: "work",
  color: "#ffffff",
  position: 0,
  revision: 1,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
}
const current: ItemView = {
  userId,
  itemId,
  primaryTagId: tagId,
  revision: 2,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
}
function input(view: ItemView | null = null, baseRevision = 0) {
  return {
    userId,
    timestamp,
    item,
    tag,
    current: view,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1 as const,
      baseRevision,
      command: {
        type: "item-view.set" as const,
        itemId,
        primaryTagId: tagId as string | null,
      },
    },
  }
}

test("personal view plans assign and clear categories without touching item content", () => {
  const value = input()
  const before = JSON.stringify(value)
  const planned = planRemoteItemViewOperation(value)
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes" || planned.effects[0].store !== "itemViews")
    throw new Error("View plan missing")
  expect(planned.effects).toHaveLength(1)
  expect(planned.effects[0].record).toEqual({
    userId,
    itemId,
    primaryTagId: tagId,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  expect(JSON.stringify(value)).toBe(before)
  const clearing = input(current, 2)
  clearing.operation.command.primaryTagId = null
  const cleared = planRemoteItemViewOperation({ ...clearing, tag: null })
  expect(cleared.status).toBe("changes")
  if (cleared.status !== "changes" || cleared.effects[0].store !== "itemViews")
    throw new Error("View plan missing")
  expect(cleared.effects[0].record.primaryTagId).toBeNull()
  expect(cleared.effects[0].record.revision).toBe(3)
  expect(cleared.effects[0].record.createdAt).toBe(createdAt)
  const changing = input(current, 2)
  changing.operation.command.primaryTagId = itemId
  const changed = planRemoteItemViewOperation({
    ...changing,
    tag: { ...tag, id: itemId, name: "Home", normalizedName: "home" },
  })
  expect(changed.status).toBe("changes")
  if (changed.status !== "changes" || changed.effects[0].store !== "itemViews")
    throw new Error("View change plan missing")
  expect(changed.effects[0].record.primaryTagId).toBe(itemId)
  expect(current.primaryTagId).toBe(tagId)
  expect(item.status).toBe("in_progress")
  expect(item.checklist[0].completed).toBe(true)
})

test("view CAS and tombstones preserve stored context and reject missing bases", () => {
  const conflict = planRemoteItemViewOperation(input(current, 1))
  expect(conflict).toEqual({ status: "conflict", current })
  if (conflict.status !== "conflict") throw new Error("Conflict plan missing")
  conflict.current.primaryTagId = null
  expect(current.primaryTagId).toBe(tagId)
  const deleted = { ...current, deletedAt: createdAt }
  expect(planRemoteItemViewOperation(input(deleted, 2))).toEqual({
    status: "conflict",
    current: deleted,
  })
  expect(planRemoteItemViewOperation(input(null, 1))).toEqual({
    status: "unavailable",
  })
  expect(planRemoteItemViewOperation({ ...input(), item: null })).toEqual({
    status: "unavailable",
  })
  expect(
    planRemoteItemViewOperation({
      ...input(),
      item: { ...item, deletedAt: createdAt },
    })
  ).toEqual({ status: "unavailable" })
})

test("view context refuses foreign identities and inactive category choices", () => {
  for (const changed of [
    { item: { ...item, ownerId: "other" } },
    { item: { ...item, revision: 0 } },
    { current: { ...current, userId: "other" } },
    { tag: { ...tag, userId: "other" } },
    { item: { ...item, id: tagId } },
    { current: { ...current, itemId: tagId } },
    { tag: { ...tag, id: itemId } },
    { current: { ...current, revision: 0 } },
    { tag: { ...tag, revision: 0 } },
  ])
    expect(() =>
      planRemoteItemViewOperation({ ...input(), ...changed })
    ).toThrow()
  expect(planRemoteItemViewOperation({ ...input(), tag: null })).toEqual({
    status: "invalid_command",
  })
  expect(
    planRemoteItemViewOperation({
      ...input(),
      tag: { ...tag, deletedAt: createdAt },
    })
  ).toEqual({ status: "invalid_command" })
  expect(() =>
    planRemoteItemViewOperation(
      input(
        { ...current, revision: Number.MAX_SAFE_INTEGER },
        Number.MAX_SAFE_INTEGER
      )
    )
  ).toThrow()
})

test("simple events are supported while recurring content and other command families stay pending", () => {
  const {
    status: _status,
    checklist: _checklist,
    scheduledDate: _scheduledDate,
    completedAt: _completedAt,
    ...identity
  } = item
  const event = {
    ...identity,
    kind: "event",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-08",
      endDateExclusive: "2026-10-09",
    },
  }
  expect(planRemoteItemViewOperation({ ...input(), item: event }).status).toBe(
    "changes"
  )
  expect(
    planRemoteItemViewOperation({
      ...input(),
      item: {
        ...item,
        recurrence: {
          frequency: "daily",
          interval: 1,
          anchorDate: "2026-10-08",
          timeZone: "Europe/Madrid",
          end: { type: "never" },
        },
      },
    })
  ).toEqual({ status: "unsupported" })
  expect(
    planRemoteItemViewOperation({
      ...input(),
      operation: {
        ...input().operation,
        command: { type: "tag.delete", tagId },
      },
    })
  ).toEqual({ status: "unsupported" })
})
