import { expect, test } from "bun:test"
import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import type { RemoteChangeV2 } from "@/types/remote-change-v2"

const userId = "local-mixed-page-owner"
const now = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
function fixture() {
  const itemId = crypto.randomUUID()
  const tagId = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  const changes: RemoteChangeV2[] = [
    {
      version: 2,
      kind: "item",
      recipientUserId: userId,
      operationId: crypto.randomUUID(),
      sequence: 3,
      item: {
        ...metadata,
        id: itemId,
        ownerId: userId,
        kind: "task",
        title: "Downloaded task",
        description: "",
        scheduledDate: "2026-10-08",
        status: "not_started",
        checklist: [],
        completedAt: null,
        recurrence: null,
      },
    },
    {
      version: 2,
      kind: "preference",
      recipientUserId: userId,
      operationId,
      sequence: 4,
      effects: {
        version: 1,
        userId,
        operationId,
        sequence: 4,
        effects: [
          {
            store: "tags",
            record: {
              ...metadata,
              revision: 8,
              id: tagId,
              userId,
              name: "Personal",
              normalizedName: "personal",
              color: "#123456",
              position: 0,
              deletedAt: now,
            },
          },
          {
            store: "itemViews",
            record: {
              ...metadata,
              revision: 2,
              userId,
              itemId,
              primaryTagId: tagId,
            },
          },
        ],
      },
    },
  ]
  return {
    query: { after: 2, through: 5, limit: 2 },
    page: {
      version: 2 as const,
      changes,
      nextAfter: 4,
      through: 5,
      hasMore: true,
    },
  }
}

test("local mixed receipt preserves the requested checkpoint, complete effects and detached evidence", () => {
  const input = fixture()
  const before = structuredClone(input)
  const value = validateLocalChangesPageInputV2(input, userId)
  expect(value.query).toEqual(input.query)
  expect(value.page.changes).toHaveLength(2)
  const personal = value.page.changes[1]
  if (personal.kind !== "preference")
    throw new Error("Personal fixture missing")
  expect(
    personal.effects.effects.map((effect) => effect.record.revision)
  ).toEqual([8, 2])
  expect(personal.effects.effects[0].record.deletedAt).toBe(now)
  personal.effects.effects[0].record.userId = "changed-clone"
  value.query.after = 0
  expect(input).toEqual(before)
  const empty = {
    query: { after: 5, through: 5, limit: 1 },
    page: { version: 2, changes: [], nextAfter: 5, through: 5, hasMore: false },
  }
  expect(
    validateLocalChangesPageInputV2(empty, userId).page.changes
  ).toHaveLength(0)
})

test("local mixed receipt rejects query, account and shape mismatches before returning a partial page", () => {
  const input = fixture()
  for (const invalid of [
    { ...input, query: { ...input.query, after: 1 } },
    { ...input, query: { ...input.query, through: 6 } },
    { ...input, query: { ...input.query, limit: 1 } },
    { ...input, page: { ...input.page, version: 3 } },
    { ...input, query: { ...input.query, extra: true } },
    { ...input, extra: true },
    {
      ...input,
      page: {
        ...input.page,
        changes: [...input.page.changes, input.page.changes[0]],
      },
    },
  ])
    expect(() => validateLocalChangesPageInputV2(invalid, userId)).toThrow()
  expect(() => validateLocalChangesPageInputV2(input, "other-user")).toThrow()
  expect(() => validateLocalChangesPageInputV2(input, "")).toThrow()
})

test("unsupported personal effects at the end reject the entire page without trimming supported effects", () => {
  for (const store of ["settings", "taskPlacements"] as const) {
    const input = fixture()
    const personal = input.page.changes[1]
    if (personal.kind !== "preference")
      throw new Error("Personal fixture missing")
    personal.effects.effects.push(
      store === "settings"
        ? {
            store,
            record: {
              ...metadata,
              userId,
              timeZone: "Europe/Madrid",
              weekStartsOn: 1,
              locale: "es-ES",
            },
          }
        : {
            store,
            record: {
              ...metadata,
              userId,
              occurrenceId: crypto.randomUUID(),
              scope: "overdue",
              date: "0001-01-01",
              tagId: null,
              position: 0,
            },
          }
    )
    const before = structuredClone(input)
    expect(() => validateLocalChangesPageInputV2(input, userId)).toThrow(
      "personal store"
    )
    expect(input).toEqual(before)
  }
})

test("local mixed receipt retains simple events but rejects uncommitted, recurring and regressing item history", () => {
  const input = fixture()
  const first = input.page.changes[0]
  if (first.kind !== "item" || first.item.kind !== "task")
    throw new Error("Task fixture missing")
  for (const mutation of ["uncommitted", "recurring", "birthday"] as const) {
    const value = structuredClone(input)
    const change = value.page.changes[0]
    if (change.kind !== "item" || change.item.kind !== "task")
      throw new Error("Task fixture missing")
    if (mutation === "uncommitted") change.item.revision = 0
    else if (mutation === "recurring")
      change.item.recurrence = {
        frequency: "daily",
        anchorDate: "2026-10-08",
        timeZone: "Europe/Madrid",
        interval: 1,
        end: { type: "never" },
      }
    else
      change.item = {
        ...metadata,
        id: change.item.id,
        ownerId: userId,
        kind: "birthday",
        title: "Birthday",
        description: "",
        month: 2,
        day: 29,
        birthYear: null,
        timeZone: "Europe/Madrid",
      }
    expect(() => validateLocalChangesPageInputV2(value, userId)).toThrow(
      "simple item"
    )
  }
  const event = structuredClone(input)
  const change = event.page.changes[0]
  if (change.kind !== "item") throw new Error("Item fixture missing")
  change.item = {
    ...metadata,
    id: first.item.id,
    ownerId: userId,
    kind: "event",
    title: "Appointment",
    description: "",
    recurrence: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-08",
      endDateExclusive: "2026-10-09",
    },
  }
  expect(
    validateLocalChangesPageInputV2(event, userId).page.changes[0]
  ).toEqual(change)
  for (const revision of [1, 0, 2]) {
    const value = structuredClone(input)
    value.page.changes[1] = {
      ...structuredClone(first),
      operationId: crypto.randomUUID(),
      sequence: 4,
      item: { ...first.item, revision },
    }
    if (revision === 2)
      expect(
        validateLocalChangesPageInputV2(value, userId).page.changes
      ).toHaveLength(2)
    else expect(() => validateLocalChangesPageInputV2(value, userId)).toThrow()
  }
})
