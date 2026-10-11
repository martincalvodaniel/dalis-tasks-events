import { expect, test } from "bun:test"
import { decodeRemoteChange } from "@/lib/sync/remote-change-v2"
import { validateRemoteChangesPageV2 } from "@/lib/sync/remote-changes-page-v2"
import {
  decodeRemoteRecurringChange,
  validateRemoteRecurringChangesPage,
} from "@/lib/sync/remote-recurring-changes"

const actor = "recurring-page-owner"
const seriesId = crypto.randomUUID()
const timestamp = "2026-10-11T13:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
function legacy() {
  return {
    recipientUserId: actor,
    operationId: crypto.randomUUID(),
    sequence: 1,
    item: {
      ...metadata,
      id: crypto.randomUUID(),
      ownerId: actor,
      kind: "task" as const,
      title: "Legacy item",
      description: "",
      scheduledDate: "2026-10-11",
      status: "not_started" as const,
      recurrence: null,
      checklist: [],
      completedAt: null,
    },
  }
}
function appearance(sequence = 2) {
  return {
    version: 2 as const,
    kind: "plan-occurrence" as const,
    recipientUserId: actor,
    operationId: crypto.randomUUID(),
    sequence,
    seriesRevision: 7,
    occurrence: {
      ...metadata,
      kind: "plan" as const,
      id: `${seriesId}:2026-10-11`,
      seriesId,
      slotKey: "2026-10-11",
      schedule: {
        mode: "all_day" as const,
        startDate: "2026-10-13",
        endDateExclusive: "2026-10-14",
      },
      status: "completed" as const,
      completedAt: timestamp,
      checklist: [],
      cancelled: false,
    },
  }
}
function page() {
  return {
    version: 2 as const,
    changes: [
      decodeRemoteRecurringChange(legacy(), actor),
      decodeRemoteRecurringChange(appearance(), actor),
    ],
    nextAfter: 2,
    through: 2,
    hasMore: false,
  }
}
const query = { after: 0, through: null, limit: 100 }

test("future page preserves legacy identity and independent appearance revision without broadening active readers", () => {
  const old = legacy(),
    snapshot = structuredClone(old),
    next = appearance()
  expect(decodeRemoteRecurringChange(old, actor)).toEqual({
    ...old,
    kind: "item",
    version: 2,
  })
  expect(old).toEqual(snapshot)
  expect(decodeRemoteRecurringChange(next, actor)).toEqual(next)
  expect(next.occurrence.revision).toBe(1)
  expect(next.seriesRevision).toBe(7)
  const value = page()
  expect(validateRemoteRecurringChangesPage(value, actor, query)).toEqual(value)
  expect(() => decodeRemoteChange(next, actor)).toThrow()
  expect(() => validateRemoteChangesPageV2(value, actor, query)).toThrow()
})

test("future pages reject account changes, holes, duplicates, changed checkpoints and overfull requested ranges", () => {
  const value = page()
  expect(() =>
    validateRemoteRecurringChangesPage(value, "foreign", query)
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(value, actor, { ...query, through: 3 })
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(value, actor, { ...query, limit: 1 })
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(value, actor, { ...query, after: 1 })
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(
      { ...value, hasMore: true },
      actor,
      query
    )
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(
      {
        ...value,
        changes: [value.changes[0], { ...value.changes[1], sequence: 3 }],
        nextAfter: 3,
        through: 3,
      },
      actor,
      query
    )
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(
      {
        ...value,
        changes: [
          value.changes[0],
          { ...value.changes[1], operationId: value.changes[0].operationId },
        ],
      },
      actor,
      query
    )
  ).toThrow()
  expect(() =>
    validateRemoteRecurringChangesPage(
      { ...value, changes: [], nextAfter: 0, hasMore: true },
      actor,
      query
    )
  ).toThrow()
})

test("appearance decoding rejects corrupt identities, future versions and recipients instead of filtering entries", () => {
  const next = appearance()
  for (const value of [
    { ...next, version: 3 },
    { ...next, recipientUserId: "foreign" },
    { ...next, seriesRevision: 0 },
    { ...next, extra: true },
    { ...next, occurrence: { ...next.occurrence, revision: 0 } },
    { ...next, occurrence: { ...next.occurrence, slotKey: "2026-10-12" } },
  ])
    expect(() => decodeRemoteRecurringChange(value, actor)).toThrow()
  expect(
    validateRemoteRecurringChangesPage(
      { version: 2, changes: [], nextAfter: 4, through: 4, hasMore: false },
      actor,
      { ...query, after: 4 }
    )
  ).toMatchObject({ nextAfter: 4 })
})
