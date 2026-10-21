import { expect, test } from "bun:test"
import { applyPlanCommand } from "@/lib/calendar/plan-command"
import {
  planOccurrenceCopy,
  validatePlanOccurrenceCopyRecord,
} from "@/lib/sync/plan-occurrence-copy"
import { planOccurrenceCopyFixture } from "@/lib/sync/plan-occurrence-copy-fixture"
import { availablePlanOccurrenceResolutionChoices } from "@/lib/sync/plan-occurrence-resolution"
import { planOccurrenceCopyRecordSchema } from "@/schemas/plan-occurrence-copy"
import { planOccurrenceResolutionRequestSchema } from "@/schemas/plan-occurrence-resolution"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

for (const variant of ["task", "event", "appointment", "note"] as const)
  for (const timed of [false, true])
    for (const ownContent of [false, true])
      test(`${variant} copies only the reviewed ${timed ? "timed" : "all-day"} slot with ${ownContent ? "own" : "inherited"} content`, () => {
        const f = planOccurrenceCopyFixture(variant),
          current = f.snapshot
        if (!current.local || !current.remote)
          throw new Error("Copy fixture comparison is missing")
        current.local.checklist = [
          { id: crypto.randomUUID(), text: "Reviewed step", completed: true },
        ]
        if (ownContent)
          current.local.content = {
            title: "Later local title",
            description: "Later local notes",
          }
        else delete current.local.content
        if (timed)
          current.local.schedule = {
            mode: "timed",
            localStart: "2026-10-25T01:30",
            localEnd: "2026-10-25T03:30",
            timeZone: "Europe/Madrid",
          }
        f.request.expected = current
        const before = JSON.stringify(f),
          record = planOccurrenceCopy(f.request, current)
        expect(record.copy).toMatchObject({
          id: f.request.copyItemId,
          ownerId: f.userId,
          kind: "plan",
          variant,
          title: ownContent ? "Later local title" : f.series.title,
          description: ownContent ? "Later local notes" : f.series.description,
          schedule: current.local.schedule,
          status: current.local.status,
          checklist: current.local.checklist,
          recurrence: null,
          revision: 0,
          deletedAt: null,
          createdAt: f.request.createdAt,
          completedAt: f.request.createdAt,
        })
        expect(record.replacement).toMatchObject({
          operationId: f.request.operationId,
          protocolVersion: 1,
          baseRevision: 0,
          command: { type: "item.create", itemId: f.request.copyItemId },
        })
        expect(record.copy).toEqual(
          applyPlanCommand(
            null,
            record.replacement.command,
            f.userId,
            f.request.createdAt
          )
        )
        expect(record.local).toEqual(current.remote)
        expect(record.local.cancelled).toBe(true)
        expect(record.supersededOperationIds).toEqual(
          f.entries.map((entry) => entry.operation.operationId)
        )
        expect(validatePlanOccurrenceCopyRecord(record, f.userId)).toEqual(
          record
        )
        expect(JSON.stringify(f)).toBe(before)
        expect(availablePlanOccurrenceResolutionChoices(current)).toEqual([
          "adopt_remote",
        ])
        expect(() =>
          planOccurrenceResolutionRequestSchema.parse(f.request)
        ).toThrow()
        expect("primaryTagId" in record.copy).toBe(false)
        expect("seriesId" in record.copy).toBe(false)
      })

test("appearance copy preserves a known tombstone rather than resurrecting it", () => {
  const f = planOccurrenceCopyFixture()
  if (!f.snapshot.remote) throw new Error("Copy fixture remote is missing")
  f.snapshot.remote = {
    ...f.snapshot.remote,
    revision: 10,
    cancelled: false,
    deletedAt: f.request.createdAt,
  }
  f.request.expected = f.snapshot
  const record = planOccurrenceCopy(f.request, f.snapshot)
  expect(record.local).toEqual(f.snapshot.remote)
  expect(record.copy.deletedAt).toBeNull()
  expect(record.copy.id).not.toBe(record.local.id)
})

const guards: [
  string,
  (snapshot: PlanOccurrenceSyncIncidentSnapshot) => void,
][] = [
  [
    "unknown remote",
    (value) => {
      value.remote = null
    },
  ],
  [
    "living remote",
    (value) => {
      if (value.remote) value.remote.cancelled = false
    },
  ],
  [
    "local cancellation",
    (value) => {
      if (value.local) value.local.cancelled = true
    },
  ],
  [
    "local deletion",
    (value) => {
      if (value.local) value.local.deletedAt = "2026-10-21T07:00:00.000Z"
    },
  ],
  [
    "missing local",
    (value) => {
      value.local = null
    },
  ],
  [
    "external dependents",
    (value) => {
      value.blockedByRelatedIntentions = true
    },
  ],
  [
    "foreign parent",
    (value) => {
      value.series.ownerId = "another-owner"
    },
  ],
  [
    "deleted parent",
    (value) => {
      value.series.deletedAt = "2026-10-21T07:00:00.000Z"
    },
  ],
  [
    "parent is not a series",
    (value) => {
      value.series.recurrence = null
    },
  ],
  [
    "uncertain send",
    (value) => {
      value.intentions[1].attempts = 1
    },
  ],
  [
    "another slot",
    (value) => {
      const command = value.intentions[1].operation.command
      if ("occurrenceId" in command)
        command.occurrenceId = `${value.series.id}:2026-10-19`
    },
  ],
  [
    "external prerequisite",
    (value) => {
      value.intentions[0].dependencies = [crypto.randomUUID()]
      value.entry = value.intentions[0]
    },
  ],
  [
    "unordered chain",
    (value) => {
      value.intentions.reverse()
    },
  ],
  [
    "forward dependency",
    (value) => {
      value.intentions[0].dependencies = [
        value.intentions[1].operation.operationId,
      ]
      value.entry = value.intentions[0]
    },
  ],
  [
    "conflicting descendant",
    (value) => {
      value.intentions[1].state = "conflict"
      value.intentions[1].attempts = 1
    },
  ],
  [
    "wrong frozen local",
    (value) => {
      if (value.localAtOutcome) value.localAtOutcome.status = "not_started"
    },
  ],
  [
    "stale remote",
    (value) => {
      if (value.remote) value.remote = { ...value.remote, revision: 1 }
    },
  ],
  [
    "same revision with changed content",
    (value) => {
      if (value.remote) value.remote.cancelled = false
    },
  ],
  [
    "unavailable is not deletion",
    (value) => {
      value.reason = "unavailable"
      value.entry.state = "rejected"
    },
  ],
]
for (const [name, change] of guards)
  test(`appearance copy rejects ${name} without mutation`, () => {
    const f = planOccurrenceCopyFixture(),
      current = structuredClone(f.snapshot)
    change(current)
    const request = { ...f.request, expected: current },
      before = JSON.stringify({ request, current })
    expect(() => planOccurrenceCopy(request, current)).toThrow()
    expect(JSON.stringify({ request, current })).toBe(before)
  })

test("appearance copy requires exact review and identities distinct from the retained chain", () => {
  const f = planOccurrenceCopyFixture()
  const current = structuredClone(f.snapshot)
  if (current.local)
    current.local.schedule = {
      mode: "all_day",
      startDate: "2026-10-22",
      endDateExclusive: "2026-10-23",
    }
  expect(() => planOccurrenceCopy(f.request, current)).toThrow(
    "changed after review"
  )
  for (const field of ["resolutionId", "operationId", "copyItemId"] as const)
    for (const collision of [
      f.series.id,
      f.request.resolutionId,
      f.request.operationId,
      f.request.copyItemId,
      f.entries[0].operation.operationId,
    ]) {
      if (collision === f.request[field]) continue
      expect(() =>
        planOccurrenceCopy({ ...f.request, [field]: collision }, f.snapshot)
      ).toThrow("identities")
    }
  expect(() =>
    planOccurrenceCopy({ ...f.request, userId: "foreign" }, f.snapshot)
  ).toThrow()
})

test("appearance copy receipt validates frozen evidence and every derived result", () => {
  const f = planOccurrenceCopyFixture(),
    record = planOccurrenceCopy(f.request, f.snapshot)
  for (const corrupt of [
    { ...record, copy: { ...record.copy, recurrence: f.series.recurrence } },
    { ...record, local: { ...record.local, cancelled: false } },
    { ...record, replacement: { ...record.replacement, baseRevision: 9 } },
    {
      ...record,
      supersededOperationIds: record.supersededOperationIds.slice(1),
    },
    { ...record, key: `appearance-resolution:${record.resolutionId}` },
    { ...record, expected: { ...record.expected, outcome: undefined } },
  ])
    expect(() => validatePlanOccurrenceCopyRecord(corrupt, f.userId)).toThrow()
  expect(() => validatePlanOccurrenceCopyRecord(record, "foreign")).toThrow()
  expect(planOccurrenceCopyRecordSchema.parse(record)).toEqual(record)
})

test("appearance copy refuses oversized evidence even when the reviewed snapshot fits", () => {
  const f = planOccurrenceCopyFixture(),
    root = f.snapshot.entry,
    children = Array.from({ length: 9999 }, (_, index) => ({
      ...f.snapshot.intentions[1],
      sequence: index + 2,
      operation: { ...root.operation, operationId: crypto.randomUUID() },
      dependencies: [root.operation.operationId],
    }))
  for (let index = 1; index < children.length; index++) {
    children[index].dependencies = [children[index - 1].operation.operationId]
  }
  const maximum = 5 * 1024 * 1024,
    bytes = (count: number) =>
      new TextEncoder().encode(
        JSON.stringify({
          ...f.snapshot,
          intentions: [root, ...children.slice(0, count)],
        })
      ).byteLength
  let low = 0,
    high = children.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (bytes(middle) <= maximum - 1024) low = middle
    else high = middle - 1
  }
  f.snapshot.intentions = [root, ...children.slice(0, low)]
  f.request.expected = f.snapshot
  expect(bytes(low)).toBeLessThan(maximum)
  expect(low).toBeGreaterThan(1000)
  const before = JSON.stringify(f.snapshot)
  expect(() => planOccurrenceCopy(f.request, f.snapshot)).toThrow("byte limit")
  expect(JSON.stringify(f.snapshot)).toBe(before)
})

test("appearance copy keeps incomplete progress and rejects ambiguous civil time", () => {
  const f = planOccurrenceCopyFixture()
  if (!f.snapshot.local) throw new Error("Copy fixture local is missing")
  f.snapshot.local.status = "in_progress"
  f.snapshot.local.completedAt = null
  f.request.expected = f.snapshot
  expect(planOccurrenceCopy(f.request, f.snapshot).copy.completedAt).toBeNull()
  expect(planOccurrenceCopy(f.request, f.snapshot).copy.status).toBe(
    "in_progress"
  )
  f.snapshot.local.schedule = {
    mode: "timed",
    localStart: "2026-10-25T02:30",
    localEnd: "2026-10-25T03:30",
    timeZone: "Europe/Madrid",
  }
  const before = JSON.stringify(f.snapshot)
  expect(() => planOccurrenceCopy(f.request, f.snapshot)).toThrow("ambiguous")
  expect(JSON.stringify(f.snapshot)).toBe(before)
})

test("appearance copy cannot supersede disconnected pending work", () => {
  const f = planOccurrenceCopyFixture()
  f.snapshot.intentions[1].dependencies = []
  f.request.expected = f.snapshot
  const before = JSON.stringify(f.snapshot)
  expect(() => planOccurrenceCopy(f.request, f.snapshot)).toThrow(
    "isolated chain"
  )
  expect(JSON.stringify(f.snapshot)).toBe(before)
})
