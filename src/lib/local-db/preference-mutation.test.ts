import { describe, expect, test } from "bun:test"
import {
  applyLocalItemViewCommand,
  applyLocalTagCommand,
  applyLocalTagMoveCommand,
} from "@/lib/local-db/preference-mutation"
import { compareRank } from "@/lib/ordering/rank"
import { taskSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"

import { syncCommandSchema } from "@/schemas/sync"

const userId = "preference-test-owner"
const tagId = "2dbe2bcb-8c3c-4a6d-992b-88b7bf7d75f8"
const itemId = "c882d47f-bf7e-4252-8e6a-1c8100ec89f8"
const now = "2026-10-07T05:00:00.000Z"
const create = {
  type: "tag.save" as const,
  tagId,
  input: { name: "Work", color: "#059669", position: 0 },
}
const tag = applyLocalTagCommand([], create, userId, now)
const item = taskSchema.parse({
  id: itemId,
  ownerId: userId,
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-07",
  status: "in_progress",
  checklist: [],
  recurrence: null,
  completedAt: null,
  revision: 3,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})

describe("personal preference mutations", () => {
  test("normalizes active names, preserves identity and rejects duplicates", () => {
    const changed = applyLocalTagCommand(
      [{ ...tag, revision: 4 }],
      {
        ...create,
        input: { ...create.input, name: "Home" },
      },
      userId,
      now
    )
    expect(changed.id).toBe(tag.id)
    expect(changed.revision).toBe(4)
    expect(changed.createdAt).toBe(tag.createdAt)
    expect(() =>
      applyLocalTagCommand(
        [tag],
        {
          ...create,
          tagId: itemId,
          input: { ...create.input, name: "ＷＯＲＫ" },
        },
        userId,
        now
      )
    ).toThrow("same name")
    const deleted = applyLocalTagCommand(
      [tag],
      { type: "tag.delete", tagId },
      userId,
      now
    )
    expect(deleted.deletedAt).toBe(now)
    expect(() => applyLocalTagCommand([deleted], create, userId, now)).toThrow(
      "cannot be restored"
    )
    expect(
      applyLocalTagCommand([deleted], { ...create, tagId: itemId }, userId, now)
        .deletedAt
    ).toBeNull()
    expect(() =>
      applyLocalTagCommand([tag], create, "other-user", now)
    ).toThrow()
  })
  test("category is a personal view and never replaces item state", () => {
    const command = {
      type: "item-view.set" as const,
      itemId,
      primaryTagId: tagId,
    }
    const view = applyLocalItemViewCommand(
      null,
      item,
      tag,
      command,
      userId,
      now
    )
    expect(view.primaryTagId).toBe(tagId)
    expect(view.userId).toBe(userId)
    expect(view.revision).toBe(0)
    const cleared = applyLocalItemViewCommand(
      { ...view, revision: 2 },
      item,
      null,
      { ...command, primaryTagId: null },
      userId,
      now
    )
    expect(cleared.primaryTagId).toBeNull()
    expect(cleared.revision).toBe(2)
    expect(item.status).toBe("in_progress")
    expect(() =>
      applyLocalItemViewCommand(
        null,
        item,
        { ...tag, deletedAt: now },
        command,
        userId,
        now
      )
    ).toThrow()
    expect(() =>
      applyLocalItemViewCommand(
        null,
        item,
        { ...tag, userId: "other" },
        command,
        userId,
        now
      )
    ).toThrow()
    expect(() =>
      applyLocalItemViewCommand(
        null,
        { ...item, deletedAt: now },
        tag,
        command,
        userId,
        now
      )
    ).toThrow()
    expect(() =>
      applyLocalItemViewCommand(
        { ...view, userId: "other" },
        item,
        tag,
        command,
        userId,
        now
      )
    ).toThrow()
  })
  test("outbox separates personal preference identity from shared content", () => {
    const operationId = "a1125f2e-f7fb-4454-b0a6-25e1adf99d8f"
    const entry = {
      userId,
      entityKey: `tag:${tagId}`,
      sequence: 1,
      operation: {
        operationId,
        protocolVersion: 1,
        baseRevision: 0,
        command: create,
      },
      dependencies: [],
      state: "pending",
      attempts: 0,
      createdAt: now,
      lease: null,
    }
    expect(outboxEntrySchema.safeParse(entry).success).toBe(true)
    expect(
      outboxEntrySchema.safeParse({ ...entry, entityKey: `item:${tagId}` })
        .success
    ).toBe(false)
    const viewEntry = {
      ...entry,
      entityKey: `item-view:${itemId}`,
      operation: {
        ...entry.operation,
        command: { type: "item-view.set", itemId, primaryTagId: null },
      },
    }
    expect(outboxEntrySchema.safeParse(viewEntry).success).toBe(true)
    expect(
      outboxEntrySchema.safeParse({ ...viewEntry, entityKey: `item:${itemId}` })
        .success
    ).toBe(false)
  })
})

describe("category movement", () => {
  const second = { ...tag, id: itemId, position: 1024 }
  const command = {
    type: "tag.move" as const,
    tagId: second.id,
    beforeId: tag.id,
    afterId: null,
  }
  test("changes rank without overwriting names, remote revisions or tombstones", () => {
    const deleted = { ...second, id: crypto.randomUUID(), deletedAt: now }
    const input = [tag, { ...second, revision: 7 }, deleted]
    const snapshot = JSON.stringify(input)
    const [moved] = applyLocalTagMoveCommand(input, command, userId, now)
    expect(moved.id).toBe(second.id)
    expect(moved.name).toBe(second.name)
    expect(moved.color).toBe(second.color)
    expect(moved.revision).toBe(7)
    expect(moved.createdAt).toBe(second.createdAt)
    expect([tag, moved].toSorted(compareRank)[0].id).toBe(second.id)
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(() =>
      applyLocalTagMoveCommand(
        [tag, deleted],
        { ...command, tagId: deleted.id },
        userId,
        now
      )
    ).toThrow()
    expect(() =>
      applyLocalTagMoveCommand(input, command, "other-user", now)
    ).toThrow()
  })
  test("validates movement identities and preserves the personal outbox namespace", () => {
    expect(syncCommandSchema.safeParse(command).success).toBe(true)
    for (const invalid of [
      { ...command, beforeId: second.id },
      { ...command, afterId: tag.id },
      { ...command, beforeId: "invalid" },
      { ...command, position: 999 },
    ])
      expect(syncCommandSchema.safeParse(invalid).success).toBe(false)
    const entry = {
      userId,
      entityKey: `tag:${second.id}`,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 7,
        command,
      },
      sequence: 1,
      dependencies: [],
      state: "pending",
      attempts: 0,
      createdAt: now,
      lease: null,
    }
    expect(outboxEntrySchema.safeParse(entry).success).toBe(true)
    expect(
      outboxEntrySchema.safeParse({ ...entry, entityKey: `item:${second.id}` })
        .success
    ).toBe(false)
    expect(
      outboxEntrySchema.safeParse({ ...entry, entityKey: `tag:${tag.id}` })
        .success
    ).toBe(false)
  })
  test("equal positions use stable IDs regardless of category names", () => {
    const equal = [
      { ...tag, name: "Z", normalizedName: "z" },
      { ...second, name: "A", normalizedName: "a", position: tag.position },
    ]
    expect(equal.toSorted(compareRank).map((record) => record.id)).toEqual(
      [tag.id, second.id].sort()
    )
    expect(
      equal
        .map((record) => ({ ...record, name: "Renamed" }))
        .toSorted(compareRank)
        .map((record) => record.id)
    ).toEqual(equal.toSorted(compareRank).map((record) => record.id))
  })
})
