import { expect, test } from "bun:test"
import { applyItemCommand } from "@/lib/calendar/item-command"
import {
  placementSyncCapabilityRegistry,
  readPlacementSyncCommandCapability,
  readSyncCommandCapability,
  syncCapabilityRegistry,
} from "@/lib/sync/sync-capabilities"
import type { CalendarItemDraft } from "@/types/calendar-item"

const itemId = crypto.randomUUID()
const draft: CalendarItemDraft = {
  kind: "task",
  title: "Simple owned task",
  description: "",
  scheduledDate: "2026-10-09",
  status: "not_started",
  checklist: [],
  recurrence: null,
}
function item(input: CalendarItemDraft = draft) {
  return applyItemCommand(
    null,
    { type: "item.create", itemId, input },
    "capability-owner",
    "2026-10-09T00:00:00.000Z"
  )
}
const move = {
  type: "task.move",
  itemId,
  occurrenceId: null,
  scope: "day",
  date: "2026-10-09",
  tagId: null,
  beforeId: null,
  afterId: null,
}

test("prepared policy supports a known simple task without changing the active registry", () => {
  const current = item()
  const before = structuredClone({ current, move })
  expect(readPlacementSyncCommandCapability(move, current)).toEqual({
    kind: "preference",
    store: "taskPlacements",
    supported: true,
    reason: null,
    contextKnown: true,
    requiresRemoteValidation: true,
  })
  expect(readSyncCommandCapability(move, current).supported).toBe(false)
  expect(syncCapabilityRegistry.stores).not.toContain("taskPlacements")
  expect(placementSyncCapabilityRegistry.stores).toContain("taskPlacements")
  expect({ current, move }).toEqual(before)
  for (const value of [
    placementSyncCapabilityRegistry,
    placementSyncCapabilityRegistry.commands,
    placementSyncCapabilityRegistry.commands["task.move"],
    placementSyncCapabilityRegistry.stores,
  ])
    expect(Object.isFrozen(value)).toBe(true)
})

test("unknown context, event, birthday, series and occurrences do not advertise placement support", () => {
  const recurring = {
    ...draft,
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-09",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
  const event = item({
    kind: "event",
    title: "Event",
    description: "",
    recurrence: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-09",
      endDateExclusive: "2026-10-10",
    },
  })
  const birthday = item({
    kind: "birthday",
    title: "Birthday",
    description: "",
    month: 10,
    day: 9,
    birthYear: null,
    timeZone: "Europe/Madrid",
  })
  const cases = [
    [move, null, "placement_executor_unavailable"],
    [move, event, "placement_executor_unavailable"],
    [move, birthday, "birthday_unavailable"],
    [move, item(recurring as CalendarItemDraft), "recurrence_unavailable"],
    [
      { ...move, occurrenceId: `${itemId}:2026-10-09` },
      item(),
      "occurrence_executor_unavailable",
    ],
  ] as const
  for (const [command, current, reason] of cases) {
    const result = readPlacementSyncCommandCapability(command, current)
    expect(result.supported).toBe(false)
    expect(result.reason).toBe(reason)
    expect(result.requiresRemoteValidation).toBe(true)
  }
})

test("other families retain existing capability rules and unsupported commands remain blocked", () => {
  const commands = [
    { type: "item.create", itemId, input: draft },
    { type: "item.delete", itemId },
    { type: "item-view.set", itemId, primaryTagId: null },
    {
      type: "tag.move",
      tagId: crypto.randomUUID(),
      beforeId: null,
      afterId: null,
    },
    {
      type: "settings.update",
      input: { timeZone: "Europe/Madrid", weekStartsOn: 1, locale: "es-ES" },
    },
  ]
  for (const command of commands)
    expect(readPlacementSyncCommandCapability(command)).toEqual(
      readSyncCommandCapability(command)
    )
})

test("future or malformed commands and mismatched context fail validation", () => {
  for (const command of [
    { ...move, extra: true },
    { ...move, type: "future.move" },
    { ...move, itemId: "invalid" },
  ])
    expect(() => readPlacementSyncCommandCapability(command, item())).toThrow()
  expect(() =>
    readPlacementSyncCommandCapability(move, {
      ...item(),
      id: crypto.randomUUID(),
    })
  ).toThrow("identity")
  expect(() =>
    readPlacementSyncCommandCapability(move, { ...item(), extra: true })
  ).toThrow()
})
