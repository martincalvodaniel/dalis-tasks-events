import { expect, test } from "bun:test"
import { applyItemCommand } from "@/lib/calendar/item-command"
import {
  readSyncCommandCapability,
  syncCapabilityRegistry,
} from "@/lib/sync/sync-capabilities"
import type { SyncCommand } from "@/types/sync"

const itemId = crypto.randomUUID()
const draft = {
  kind: "task" as const,
  title: "Own simple task",
  description: "",
  scheduledDate: "2026-10-09",
  status: "not_started" as const,
  checklist: [],
  recurrence: null,
}
const current = applyItemCommand(
  null,
  { type: "item.create", itemId, input: draft },
  "capability-owner",
  "2026-10-09T00:00:00.000Z"
)
const recurrence = {
  frequency: "daily" as const,
  interval: 1,
  anchorDate: "2026-10-09",
  timeZone: "Europe/Madrid",
  end: { type: "never" as const },
}

test("the prepared registry covers simple own content, categories and views without granting access or activating transport", () => {
  const tagId = crypto.randomUUID()
  const commands: SyncCommand[] = [
    { type: "item.create", itemId, input: draft },
    { type: "item.update", itemId, input: draft },
    { type: "item.delete", itemId },
    {
      type: "task.set-status",
      itemId,
      occurrenceId: null,
      status: "completed",
    },
    {
      type: "task.set-checklist-entry",
      itemId,
      occurrenceId: null,
      entryId: crypto.randomUUID(),
      completed: true,
    },
    {
      type: "tag.save",
      tagId,
      input: { name: "Own tag", color: "#123456", position: 1024 },
    },
    { type: "tag.delete", tagId },
    { type: "tag.move", tagId, beforeId: null, afterId: null },
    { type: "item-view.set", itemId, primaryTagId: tagId },
  ]
  const before = structuredClone(commands)
  for (const command of commands) {
    const value = readSyncCommandCapability(command)
    expect(value.supported).toBe(true)
    expect(value.reason).toBeNull()
    expect(value.contextKnown).toBe(false)
    expect(value.requiresRemoteValidation).toBe(true)
    expect(value.kind).toBe(
      command.type.startsWith("tag.") || command.type === "item-view.set"
        ? "preference"
        : "item"
    )
  }
  expect(commands).toEqual(before)
  expect(syncCapabilityRegistry.stores).toEqual(["items", "tags", "itemViews"])
  expect(Object.isFrozen(syncCapabilityRegistry.commands["task.move"])).toBe(
    true
  )
})

test("placements, settings and occurrence mutations remain explicitly unsupported", () => {
  const commands: SyncCommand[] = [
    {
      type: "task.move",
      itemId,
      occurrenceId: null,
      scope: "overdue",
      date: "2026-10-09",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
    {
      type: "settings.update",
      input: { timeZone: "Europe/Madrid", weekStartsOn: 1, locale: "es-ES" },
    },
    {
      type: "task.cancel-occurrence",
      itemId,
      occurrenceId: `${itemId}:2026-10-09`,
    },
    {
      type: "task.set-status",
      itemId,
      occurrenceId: `${itemId}:2026-10-09`,
      status: "completed",
    },
    {
      type: "task.set-checklist-entry",
      itemId,
      occurrenceId: `${itemId}:2026-10-09`,
      entryId: crypto.randomUUID(),
      completed: true,
    },
  ]
  for (const command of commands) {
    const value = readSyncCommandCapability(command)
    expect(value.supported).toBe(false)
    expect(value.reason).not.toBeNull()
    expect(value.requiresRemoteValidation).toBe(true)
  }
  expect(readSyncCommandCapability(commands[0]).kind).toBe("preference")
  expect(readSyncCommandCapability(commands[2]).kind).toBe("item")
})

test("a simple update cannot convert known recurrent content and birthday or recurrent drafts remain unsupported", () => {
  const series = { ...current, recurrence }
  for (const command of [
    { type: "item.update", itemId, input: draft },
    { type: "item.delete", itemId },
    { type: "item-view.set", itemId, primaryTagId: null },
  ]) {
    const capability = readSyncCommandCapability(command, series)
    expect(capability.supported).toBe(false)
    expect(capability.reason).toBe("recurrence_unavailable")
    expect(capability.contextKnown).toBe(true)
  }
  expect(
    readSyncCommandCapability({
      type: "item.create",
      itemId,
      input: { ...draft, recurrence },
    }).reason
  ).toBe("recurrence_unavailable")
  const birthday = {
    kind: "birthday",
    title: "Birthday",
    description: "",
    month: 10,
    day: 9,
    birthYear: null,
    timeZone: "Europe/Madrid",
  }
  expect(
    readSyncCommandCapability({ type: "item.create", itemId, input: birthday })
      .reason
  ).toBe("birthday_unavailable")
  const record = {
    ...birthday,
    id: itemId,
    ownerId: "capability-owner",
    revision: 1,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    deletedAt: null,
  }
  expect(
    readSyncCommandCapability({ type: "item.delete", itemId }, record).reason
  ).toBe("birthday_unavailable")
})

test("future commands, extra fields and mismatched item context reject rather than advertise a fallback capability", () => {
  for (const command of [
    { type: "future.command", itemId },
    { type: "item.delete", itemId, extra: true },
    { type: "item.delete", itemId: "invalid" },
  ])
    expect(() => readSyncCommandCapability(command)).toThrow()
  expect(() =>
    readSyncCommandCapability(
      { type: "item.delete", itemId: crypto.randomUUID() },
      current
    )
  ).toThrow("identity")
  expect(() =>
    readSyncCommandCapability(
      { type: "item.delete", itemId },
      { ...current, extra: true }
    )
  ).toThrow()
})
