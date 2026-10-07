import { expect, test } from "bun:test"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import { isTaskOverdue } from "@/lib/calendar/overdue"
import { createTaskOccurrenceIndex } from "@/lib/calendar/task-occurrence-selection"
import { taskSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import type { ItemOccurrence, Task } from "@/types/calendar-item"

const id = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const otherId = "1bbc261b-a8ca-40b2-a655-8e7c77862396"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const timestamp = "2026-10-07T10:00:00.000Z"
function series(overrides: Partial<Task> = {}): Task {
  return taskSchema.parse({
    id,
    ownerId: "test-owner",
    title: "Template",
    description: "Template description",
    kind: "task",
    revision: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    scheduledDate: "2026-10-07",
    status: "completed",
    completedAt: timestamp,
    checklist: [{ id: entryId, text: "Template step", completed: true }],
    recurrence: {
      frequency: "daily",
      anchorDate: "2026-10-07",
      timeZone: "Europe/Madrid",
      interval: 1,
      end: { type: "count", count: 3 },
    },
    ...overrides,
  })
}
function occurrence(
  parent: Task,
  slotKey: string,
  overrides: Partial<Extract<ItemOccurrence, { kind: "task" }>> = {}
) {
  const generated = occurrencesPage(parent, {
    startDate: slotKey,
    endDate: slotKey,
    limit: 1,
  }).occurrences[0]
  if (generated?.kind !== "task") throw new Error("Test task slot is missing")
  const record = itemOccurrenceSchema.parse({ ...generated, ...overrides })
  if (record.kind !== "task") throw new Error("Test task kind changed")
  return record
}
const dateRange = { startDate: "2026-10-07", endDate: "2026-10-09" }

test("exception streams select effective dates and suppress every original virtual slot without duplication", () => {
  const parent = series({
    scheduledDate: "2026-09-30",
    recurrence: {
      frequency: "daily",
      anchorDate: "2026-09-30",
      timeZone: "Europe/Madrid",
      interval: 1,
      end: { type: "never" },
    },
  })
  const movedIn = occurrence(parent, "2026-09-30", {
    scheduledDate: "2026-10-07",
    content: { title: "Moved in", description: "Own content" },
    status: "in_progress",
  })
  const movedOut = occurrence(parent, "2026-10-07", {
    scheduledDate: "2026-11-01",
  })
  const cancelled = occurrence(parent, "2026-10-08", { cancelled: true })
  const deleted = occurrence(parent, "2026-10-09", { deletedAt: timestamp })
  const index = createTaskOccurrenceIndex(
    [parent],
    [movedIn, movedOut, cancelled, deleted],
    parent.ownerId
  )
  expect(index.generatedPage(id, dateRange)).toEqual({
    views: [],
    nextAfter: null,
  })
  expect(index.exceptionsPage(dateRange)).toMatchObject({
    views: [
      {
        title: "Moved in",
        description: "Own content",
        occurrence: {
          id: movedIn.id,
          scheduledDate: "2026-10-07",
          status: "in_progress",
        },
      },
    ],
    nextCursor: null,
  })
  expect(
    index.generatedPage(id, { startDate: "2026-09-30", endDate: "2026-09-30" })
      .views
  ).toEqual([])
  const november = index.generatedPage(id, {
    startDate: "2026-11-01",
    endDate: "2026-11-01",
  }).views
  const movedNovember = index.exceptionsPage({
    startDate: "2026-11-01",
    endDate: "2026-11-01",
  }).views
  expect(
    new Set([...november, ...movedNovember].map((view) => view.occurrence.id))
      .size
  ).toBe(2)
  expect(isTaskOverdue(movedIn, "2026-10-08")).toBe(true)
  expect(isTaskOverdue(cancelled, "2026-10-09")).toBe(false)
})

test("historical content and checklist survive future template changes and exception paging ties are deterministic", () => {
  const parent = series()
  const first = occurrence(parent, "2026-10-07", {
    scheduledDate: "2026-10-08",
    content: { title: "Historical", description: "Saved" },
    checklist: [{ id: entryId, text: "Historical step", completed: true }],
    status: "completed",
    completedAt: timestamp,
  })
  const second = occurrence(parent, "2026-10-09", {
    scheduledDate: "2026-10-08",
    status: "in_progress",
  })
  if (!parent.recurrence) throw new Error("Test recurrence is missing")
  const changed = series({
    title: "Future template",
    checklist: [],
    recurrence: { ...parent.recurrence, end: { type: "count", count: 1 } },
  })
  const index = createTaskOccurrenceIndex(
    [changed],
    [second, first],
    parent.ownerId
  )
  const page1 = index.exceptionsPage({ ...dateRange, limit: 1 })
  expect(page1.views[0]).toMatchObject({
    title: "Historical",
    description: "Saved",
    occurrence: {
      id: first.id,
      checklist: [{ text: "Historical step", completed: true }],
    },
  })
  expect(page1.nextCursor).toEqual({ date: "2026-10-08", id: first.id })
  const page2 = index.exceptionsPage({
    ...dateRange,
    limit: 1,
    after: page1.nextCursor,
  })
  expect(page2.views[0]).toMatchObject({
    title: "Future template",
    description: parent.description,
    occurrence: { id: second.id, status: "in_progress" },
  })
  expect(page2.nextCursor).toBeNull()
  expect(
    index
      .exceptionsPage({ ...dateRange, includeCompleted: false })
      .views.map((view) => view.occurrence.id)
  ).toEqual([second.id])
  expect(index.generatedPage(id, dateRange).views).toEqual([])
  page1.views[0].occurrence.checklist[0].text = "Caller changed result"
  expect(
    index.exceptionsPage(dateRange).views[0].occurrence.checklist[0].text
  ).toBe("Historical step")
  expect(first.checklist[0].text).toBe("Historical step")
  expect(changed.checklist).toEqual([])
})

test("virtual pagination advances through empty completed or cancelled pages and reaches backlog outside visible month", () => {
  const parent = series({
    scheduledDate: "2020-01-01",
    recurrence: {
      frequency: "daily",
      anchorDate: "2020-01-01",
      timeZone: "Europe/Madrid",
      interval: 1,
      end: { type: "never" },
    },
  })
  const history = occurrencesPage(parent, {
    startDate: "2020-01-01",
    endDate: "2020-02-29",
    limit: 500,
  }).occurrences.map((record, index) =>
    itemOccurrenceSchema.parse({
      ...record,
      ...(index % 2
        ? { cancelled: true }
        : { status: "completed", completedAt: timestamp }),
    })
  )
  const index = createTaskOccurrenceIndex([parent], history, parent.ownerId)
  const range = {
    startDate: "2020-01-01",
    endDate: "2020-03-03",
    limit: 10,
    includeCompleted: false,
  }
  let afterDate: string | null = null
  const seen: string[] = []
  let pages = 0
  do {
    const page = index.generatedPage(id, { ...range, afterDate })
    if (pages < 6) expect(page.views.length).toBe(0)
    seen.push(...page.views.map((view) => view.occurrence.slotKey))
    afterDate = page.nextAfter
    pages++
  } while (afterDate)
  expect(pages).toBe(7)
  expect(seen).toEqual(["2020-03-01", "2020-03-02", "2020-03-03"])
  expect(index.exceptionsPage({ ...range, limit: 10 }).views).toEqual([])
  expect(
    index.generatedPage(id, { startDate: "2026-10-07", endDate: "2026-10-07" })
      .views[0].occurrence.status
  ).toBe("not_started")
})

test("selection isolates owners and excludes orphaned, deleted and non-recurring parents", () => {
  const parent = series()
  const exception = occurrence(parent, "2026-10-07")
  for (const excluded of [
    series({ ownerId: "other-owner" }),
    series({ deletedAt: timestamp }),
    series({ recurrence: null }),
  ]) {
    const index = createTaskOccurrenceIndex(
      [excluded],
      [exception],
      parent.ownerId
    )
    expect(index.seriesIds).toEqual([])
    expect(index.generatedPage(id, dateRange)).toEqual({
      views: [],
      nextAfter: null,
    })
    expect(index.exceptionsPage(dateRange)).toEqual({
      views: [],
      nextCursor: null,
    })
  }
  const second = series({ id: otherId })
  const otherException = occurrence(second, "2026-10-07")
  const index = createTaskOccurrenceIndex(
    [parent],
    [otherException],
    parent.ownerId
  )
  expect(index.generatedPage(id, dateRange).views.length).toBe(3)
  expect(index.exceptionsPage(dateRange).views.length).toBe(0)
  expect(() =>
    createTaskOccurrenceIndex([parent, parent], [], parent.ownerId)
  ).toThrow()
  expect(() =>
    createTaskOccurrenceIndex([parent], [exception, exception], parent.ownerId)
  ).toThrow()
  expect(() =>
    createTaskOccurrenceIndex(
      [parent],
      [
        {
          ...exception,
          id: `${id}:2026-10-07T09:00`,
          slotKey: "2026-10-07T09:00",
        },
      ],
      parent.ownerId
    )
  ).toThrow()
  expect(() =>
    createTaskOccurrenceIndex(
      [parent],
      [{ ...exception, id: `${otherId}:2026-10-07` }],
      parent.ownerId
    )
  ).toThrow()
})

test("bounded queries preserve civil extremes, global recurrence count and cross-series cursor ordering", () => {
  for (const date of ["0001-01-01", "9999-12-31"]) {
    const parent = series({
      scheduledDate: date,
      recurrence: {
        frequency: "daily",
        anchorDate: date,
        timeZone: "Europe/Madrid",
        interval: 1,
        end: { type: "never" },
      },
    })
    const index = createTaskOccurrenceIndex([parent], [], parent.ownerId)
    expect(
      index.generatedPage(id, { startDate: date, endDate: date })
    ).toMatchObject({
      views: [{ occurrence: { slotKey: date } }],
      nextAfter: null,
    })
  }
  const parent = series()
  const other = series({ id: otherId })
  const index = createTaskOccurrenceIndex(
    [parent, other],
    [occurrence(parent, "2026-10-07"), occurrence(other, "2026-10-07")],
    parent.ownerId
  )
  const first = index.exceptionsPage({ ...dateRange, limit: 1 })
  const second = index.exceptionsPage({
    ...dateRange,
    limit: 1,
    after: first.nextCursor,
  })
  expect(first.views[0].seriesId).toBe(otherId)
  expect(second.views[0].seriesId).toBe(id)
  expect(second.nextCursor).toBeNull()
  expect(
    index.generatedPage(id, { startDate: "2026-10-10", endDate: "2026-10-20" })
      .views
  ).toEqual([])
  for (const query of [
    { ...dateRange, limit: 0 },
    { ...dateRange, limit: 501 },
    { ...dateRange, endDate: "2026-10-01" },
    { ...dateRange, startDate: "0000-01-01" },
  ]) {
    expect(() => index.generatedPage(id, query)).toThrow()
    expect(() => index.exceptionsPage(query)).toThrow()
  }
  expect(() =>
    index.generatedPage(id, { ...dateRange, afterDate: "2026-10-01" })
  ).toThrow()
  expect(() =>
    index.exceptionsPage({
      ...dateRange,
      after: { date: "2026-10-01", id: `${id}:2026-10-01` },
    })
  ).toThrow()
})
