import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import {
  planLocalRecurringChangesPage,
  validateLocalRecurringChangesPageInput,
} from "@/lib/sync/local-recurring-pull"
import { localRecurringChangesPageInputSchema } from "@/schemas/local-recurring-pull"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { RemoteRecurringShadow } from "@/types/remote-recurring-sync"

const timestamp = "2026-10-11T13:00:00.000Z"
function fixture() {
  const userId = "recurring-pull-owner",
    id = crypto.randomUUID(),
    tagId = crypto.randomUUID()
  const metadata = {
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const series = planSchema.parse({
    ...metadata,
    kind: "plan",
    variant: "task",
    id,
    ownerId: userId,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  })
  const occurrence = {
    ...applyPlanOccurrenceCommand(
      series,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        status: "completed",
      },
      userId,
      timestamp
    ),
    revision: 1,
  }
  const personalId = crypto.randomUUID()
  const changes = [
    {
      version: 2,
      kind: "item",
      recipientUserId: userId,
      operationId: crypto.randomUUID(),
      sequence: 1,
      item: series,
    },
    {
      version: 2,
      kind: "preference",
      recipientUserId: userId,
      operationId: personalId,
      sequence: 2,
      effects: {
        version: 1,
        userId,
        operationId: personalId,
        sequence: 2,
        effects: [
          {
            store: "tags",
            record: {
              ...metadata,
              id: tagId,
              userId,
              name: "Category",
              normalizedName: "category",
              color: "#123456",
              position: 1024,
            },
          },
        ],
      },
    },
    {
      version: 2,
      kind: "plan-occurrence",
      recipientUserId: userId,
      operationId: crypto.randomUUID(),
      sequence: 3,
      seriesRevision: 1,
      occurrence,
    },
  ]
  const receipt = localRecurringChangesPageInputSchema.parse({
    query: { after: 0, through: null, limit: 100 },
    page: { version: 2, changes, nextAfter: 3, through: 3, hasMore: false },
  })
  return {
    series,
    occurrence,
    input: {
      userId,
      receipt,
      cursor: {
        key: "pull-cursor" as const,
        after: 0,
        through: null as number | null,
      },
      items: [] as CalendarItem[],
      occurrences: [] as ItemOccurrence[],
      local: [] as PersonalSnapshot,
      shadows: [] as RemoteRecurringShadow[],
      entries: [] as OutboxEntry[],
    },
  }
}
function pending(
  value: ReturnType<typeof fixture>,
  occurrenceId = value.occurrence.id
) {
  return outboxEntrySchema.parse({
    userId: value.input.userId,
    entityKey: `item:${value.series.id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "plan.set-occurrence-status",
        itemId: value.series.id,
        occurrenceId,
        expectedOccurrenceRevision: 0,
        status: "in_progress",
      },
    },
    state: "pending",
    attempts: 0,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: timestamp,
  })
}

test("future mixed bootstrap projects content, personal data and appearances without ACK or input mutation", () => {
  const value = fixture(),
    original = structuredClone(value.input)
  const plan = planLocalRecurringChangesPage(value.input)
  expect(plan).toMatchObject({
    status: "applied",
    cursor: { after: 3, through: null },
  })
  expect(plan.items).toEqual([value.series])
  expect(plan.occurrences).toEqual([value.occurrence])
  expect(plan.local).toHaveLength(1)
  expect(plan.shadows.map((s) => s.kind)).toEqual([
    "item",
    "preference",
    "plan-occurrence",
  ])
  expect(value.input).toEqual(original)
  expect(() =>
    validateLocalChangesPageInputV2(
      value.input.receipt,
      value.input.userId,
      true
    )
  ).toThrow()
})

test("partial bootstrap retains its frozen checkpoint and completes the appearance in the next page", () => {
  const value = fixture()
  const receipt = {
    ...value.input.receipt,
    query: { ...value.input.receipt.query, limit: 2 },
    page: {
      ...value.input.receipt.page,
      changes: value.input.receipt.page.changes.slice(0, 2),
      nextAfter: 2,
      hasMore: true,
    },
  }
  const first = planLocalRecurringChangesPage({ ...value.input, receipt })
  expect(first.cursor).toEqual({ key: "pull-cursor", after: 2, through: 3 })
  const input = {
    ...value.input,
    items: first.items,
    occurrences: first.occurrences,
    local: first.local,
    shadows: first.shadows,
    cursor: first.cursor,
    receipt: {
      query: { after: 2, through: 3, limit: 100 },
      page: {
        ...value.input.receipt.page,
        changes: [value.input.receipt.page.changes[2]],
      },
    },
  }
  expect(planLocalRecurringChangesPage(input).occurrences).toEqual([
    value.occurrence,
  ])
  expect(() =>
    planLocalRecurringChangesPage({
      ...input,
      receipt: {
        ...input.receipt,
        query: { ...input.receipt.query, through: null },
      },
    })
  ).toThrow("checkpoint changed")
})

test("pending local appearance and parent work stay intact; another occurrence does not block its remote projection", () => {
  const value = fixture(),
    entry = pending(value)
  const local = {
    ...value.occurrence,
    revision: 0,
    status: "in_progress" as const,
    completedAt: null,
  }
  const input = {
    ...value.input,
    items: [value.series],
    occurrences: [local],
    entries: [entry],
  }
  const plan = planLocalRecurringChangesPage(input)
  expect(plan.occurrences).toEqual([local])
  expect(plan.shadows.at(-1)).toMatchObject({
    kind: "plan-occurrence",
    record: value.occurrence,
  })
  expect(input.entries).toEqual([entry])
  const other = pending(value, `${value.series.id}:2026-10-12`)
  expect(
    planLocalRecurringChangesPage({ ...input, entries: [other] }).occurrences
  ).toEqual([value.occurrence])
  const parent = outboxEntrySchema.parse({
    ...entry,
    operation: {
      ...entry.operation,
      command: { type: "item.delete", itemId: value.series.id },
    },
  })
  const optimistic = { ...value.series, title: "Pending parent content" }
  const parentPlan = planLocalRecurringChangesPage({
    ...input,
    items: [optimistic],
    entries: [parent],
  })
  expect(parentPlan.items).toEqual([optimistic])
  expect(parentPlan.occurrences).toEqual([local])
})

test("missing or wrong parent evidence, repeated revisions and corrupted pages fail as a whole", () => {
  const value = fixture(),
    last = value.input.receipt.page.changes[2]
  const only = {
    ...value.input,
    cursor: { ...value.input.cursor, after: 2 },
    receipt: {
      query: { after: 2, through: null, limit: 100 },
      page: { ...value.input.receipt.page, changes: [last] },
    },
  }
  expect(() => planLocalRecurringChangesPage(only)).toThrow(
    "parent is unavailable"
  )
  expect(() =>
    planLocalRecurringChangesPage({
      ...only,
      items: [value.series],
      receipt: {
        ...only.receipt,
        page: {
          ...only.receipt.page,
          changes: [{ ...last, seriesRevision: 2 }],
        },
      },
    })
  ).toThrow("parent revision")
  const duplicateRevision = {
    ...value.input.receipt,
    page: {
      ...value.input.receipt.page,
      changes: [
        ...value.input.receipt.page.changes,
        { ...last, sequence: 4, operationId: crypto.randomUUID() },
      ],
      nextAfter: 4,
      through: 4,
    },
  }
  expect(() =>
    validateLocalRecurringChangesPageInput(
      duplicateRevision,
      value.input.userId
    )
  ).toThrow("revisions must advance")
  expect(() =>
    planLocalRecurringChangesPage({
      ...value.input,
      receipt: {
        ...value.input.receipt,
        page: {
          ...value.input.receipt.page,
          changes: [
            ...value.input.receipt.page.changes.slice(0, 2),
            { ...last, recipientUserId: "foreign" },
          ],
        },
      },
    })
  ).toThrow()
})

test("ignored old pages still validate full queue, stored ownership and occurrence identities", () => {
  const value = fixture(),
    plan = planLocalRecurringChangesPage(value.input)
  const input = {
    ...value.input,
    items: plan.items,
    occurrences: plan.occurrences,
    local: plan.local,
    shadows: plan.shadows,
    cursor: plan.cursor,
  }
  expect(planLocalRecurringChangesPage(input)).toMatchObject({
    status: "ignored",
    cursor: plan.cursor,
    items: plan.items,
    occurrences: plan.occurrences,
  })
  const entry = pending(value)
  for (const invalid of [
    { ...input, entries: [{ ...entry, dependencies: [crypto.randomUUID()] }] },
    { ...input, items: [{ ...value.series, ownerId: "foreign" }] },
    { ...input, occurrences: [value.occurrence, value.occurrence] },
    { ...input, shadows: [...input.shadows, input.shadows[0]] },
    { ...input, items: [], occurrences: [] },
  ])
    expect(() => planLocalRecurringChangesPage(invalid)).toThrow()
})

test("incremental cancellation and parent tombstone keep both records and history", () => {
  const value = fixture(),
    first = planLocalRecurringChangesPage(value.input)
  const last = value.input.receipt.page.changes[2]
  const cancelled = {
    ...value.occurrence,
    revision: 2,
    cancelled: true,
    deletedAt: timestamp,
  }
  const deleted = { ...value.series, revision: 2, deletedAt: timestamp }
  const next = planLocalRecurringChangesPage({
    ...value.input,
    items: first.items,
    occurrences: first.occurrences,
    local: first.local,
    shadows: first.shadows,
    cursor: first.cursor,
    receipt: {
      query: { after: 3, through: null, limit: 100 },
      page: {
        version: 2,
        changes: [
          {
            ...last,
            sequence: 4,
            operationId: crypto.randomUUID(),
            occurrence: cancelled,
          },
          {
            version: 2,
            kind: "item",
            recipientUserId: value.input.userId,
            operationId: crypto.randomUUID(),
            sequence: 5,
            item: deleted,
          },
        ],
        nextAfter: 5,
        through: 5,
        hasMore: false,
      },
    },
  })
  expect(next.cursor).toMatchObject({ after: 5, through: null })
  expect(next.items).toEqual([deleted])
  expect(next.occurrences).toEqual([cancelled])
})
