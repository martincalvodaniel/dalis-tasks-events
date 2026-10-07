import { expect, test } from "bun:test"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import { eventSchema, taskSchema } from "@/schemas/calendar-item"
import type { CalendarEvent, RecurrenceRule } from "@/types/calendar-item"

const id = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const metadata = {
  id,
  ownerId: "test-owner",
  title: "Test series",
  description: "",
  revision: 4,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-10-07T10:00:00.000Z",
  deletedAt: null,
}
const recurrence = (
  anchorDate: string,
  timeZone = "Europe/Madrid"
): RecurrenceRule => ({
  frequency: "daily",
  anchorDate,
  timeZone,
  interval: 1,
  end: { type: "never" },
})
const query = (startDate: string, endDate: string, limit = 100) => ({
  startDate,
  endDate,
  limit,
})
function event(schedule: CalendarEvent["schedule"], rule?: RecurrenceRule) {
  return eventSchema.parse({
    ...metadata,
    kind: "event",
    schedule,
    recurrence:
      rule ??
      recurrence(
        schedule.mode === "all_day"
          ? schedule.startDate
          : schedule.localStart.slice(0, 10),
        schedule.mode === "timed" ? schedule.timeZone : "Europe/Madrid"
      ),
  })
}

test("task occurrences copy uncompleted checklist state with stable original IDs and metadata", () => {
  const series = taskSchema.parse({
    ...metadata,
    kind: "task",
    scheduledDate: "2026-10-07",
    status: "completed",
    completedAt: "2026-10-07T10:00:00.000Z",
    checklist: [{ id: entryId, text: "Test step", completed: true }],
    recurrence: recurrence("2026-10-07"),
  })
  const page = occurrencesPage(series, query("2026-10-07", "2026-10-08", 1))
  expect(page.nextAfter).toBe("2026-10-07")
  expect(page.occurrences[0]).toMatchObject({
    id: `${id}:2026-10-07`,
    slotKey: "2026-10-07",
    status: "not_started",
    completedAt: null,
    revision: 0,
    updatedAt: metadata.createdAt,
    checklist: [{ id: entryId, text: "Test step", completed: false }],
  })
  const rest = occurrencesPage(series, {
    ...query("2026-10-07", "2026-10-08", 1),
    afterDate: page.nextAfter,
  })
  const first = page.occurrences[0]
  const second = rest.occurrences[0]
  expect(first.kind).toBe("task")
  if (first.kind === "task") {
    first.checklist[0].completed = true
    first.checklist[0].text = "Changed occurrence step"
  }
  expect(second).toMatchObject({ checklist: [{ completed: false }] })
  expect(series.checklist[0].completed).toBe(true)
  expect(series.checklist[0].text).toBe("Test step")
  expect(second).toMatchObject({ checklist: [{ text: "Test step" }] })
  expect(rest.nextAfter).toBeNull()
  expect(occurrencesPage(series, query("2026-10-08", "2026-10-08"))).toEqual({
    occurrences: [second],
    issues: [],
    nextAfter: null,
  })
  expect(
    occurrencesPage(
      { ...series, deletedAt: metadata.updatedAt },
      query("2026-10-07", "2026-10-08")
    )
  ).toEqual({ occurrences: [], issues: [], nextAfter: null })
  expect(() =>
    occurrencesPage(
      { ...series, recurrence: null },
      query("2026-10-07", "2026-10-08")
    )
  ).toThrow()
})

test("all-day occurrences retain civil length and report overflow without losing their slots", () => {
  const series = event({
    mode: "all_day",
    startDate: "2026-10-07",
    endDateExclusive: "2026-10-09",
  })
  const page = occurrencesPage(series, query("2026-10-08", "2026-10-08"))
  expect(page.occurrences[0]).toMatchObject({
    id: `${id}:2026-10-08`,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-08",
      endDateExclusive: "2026-10-10",
    },
  })
  const boundary = occurrencesPage(series, query("9999-12-30", "9999-12-31", 1))
  expect(boundary).toEqual({
    occurrences: [],
    issues: [
      {
        id: `${id}:9999-12-30`,
        seriesId: id,
        slotKey: "9999-12-30",
        reason: "out_of_range",
      },
    ],
    nextAfter: "9999-12-30",
  })
  expect(
    occurrencesPage(
      event({
        mode: "all_day",
        startDate: "0001-01-01",
        endDateExclusive: "0001-01-02",
      }),
      query("0001-01-01", "0001-01-01")
    ).occurrences[0].id
  ).toBe(`${id}:0001-01-01`)
})

test("timed occurrences keep both wall-clock endpoints and exact durations vary across DST", () => {
  const spring = event({
    mode: "timed",
    localStart: "2026-03-28T01:30",
    localEnd: "2026-03-28T03:30",
    timeZone: "Europe/Madrid",
  })
  const page = occurrencesPage(spring, query("2026-03-28", "2026-03-29"))
  expect(page.issues).toEqual([])
  const durations = page.occurrences.map((occurrence) => {
    expect(occurrence.kind).toBe("event")
    if (occurrence.kind !== "event")
      throw new Error("Expected event occurrence")
    const schedule = resolveEventSchedule(occurrence.schedule)
    return schedule.mode === "timed" ? schedule.durationMilliseconds : null
  })
  expect(durations).toEqual([7200000, 3600000])
  expect(page.occurrences[1]).toMatchObject({
    id: `${id}:2026-03-29T01:30`,
    schedule: { localStart: "2026-03-29T01:30", localEnd: "2026-03-29T03:30" },
  })
  const overnight = event({
    mode: "timed",
    localStart: "2026-10-24T23:30",
    localEnd: "2026-10-25T03:30",
    timeZone: "Europe/Madrid",
  })
  const result = occurrencesPage(overnight, query("2026-10-24", "2026-10-25"))
  const lengths = result.occurrences.map((occurrence) =>
    occurrence.kind === "event"
      ? resolveEventSchedule(occurrence.schedule)
      : null
  )
  expect(lengths).toMatchObject([
    { durationMilliseconds: 18000000 },
    { durationMilliseconds: 14400000 },
  ])
  expect(result.occurrences[1]).toMatchObject({
    schedule: { localStart: "2026-10-25T23:30", localEnd: "2026-10-26T03:30" },
  })
})

test("gaps and folds produce identified issues, consume slot count and keep pagination progress", () => {
  for (const [anchor, problem, next, reason] of [
    ["2026-03-28", "2026-03-29", "2026-03-30", "nonexistent"],
    ["2026-10-24", "2026-10-25", "2026-10-26", "ambiguous"],
  ] as const) {
    const series = event(
      {
        mode: "timed",
        localStart: `${anchor}T02:30`,
        localEnd: null,
        timeZone: "Europe/Madrid",
      },
      { ...recurrence(anchor), end: { type: "count", count: 2 } }
    )
    const page = occurrencesPage(series, query(problem, next, 1))
    expect(page).toEqual({
      occurrences: [],
      issues: [
        {
          id: `${id}:${problem}T02:30`,
          seriesId: id,
          slotKey: `${problem}T02:30`,
          reason,
        },
      ],
      nextAfter: null,
    })
    const unlimited = { ...series, recurrence: recurrence(anchor) }
    const first = occurrencesPage(unlimited, query(problem, next, 1))
    expect(first.nextAfter).toBe(problem)
    const last = occurrencesPage(unlimited, {
      ...query(problem, next, 1),
      afterDate: first.nextAfter,
    })
    expect(last.issues).toEqual([])
    expect(last.occurrences[0].id).toBe(`${id}:${next}T02:30`)
  }
})

test("end-time problems, skipped civil days and timed year overflow are explicit", () => {
  const endGap = event({
    mode: "timed",
    localStart: "2026-03-28T01:30",
    localEnd: "2026-03-28T02:30",
    timeZone: "Europe/Madrid",
  })
  expect(
    occurrencesPage(endGap, query("2026-03-29", "2026-03-29")).issues[0]
  ).toMatchObject({ reason: "nonexistent", slotKey: "2026-03-29T01:30" })
  const apia = event({
    mode: "timed",
    localStart: "2011-12-29T09:00",
    localEnd: null,
    timeZone: "Pacific/Apia",
  })
  expect(
    occurrencesPage(apia, query("2011-12-30", "2011-12-31"))
  ).toMatchObject({
    issues: [{ reason: "nonexistent", slotKey: "2011-12-30T09:00" }],
    occurrences: [{ slotKey: "2011-12-31T09:00" }],
  })
  const long = event({
    mode: "timed",
    localStart: "2026-10-07T23:30",
    localEnd: "2026-10-08T00:30",
    timeZone: "UTC",
  })
  expect(
    occurrencesPage(long, query("9999-12-31", "9999-12-31")).issues[0]
  ).toMatchObject({ reason: "out_of_range", slotKey: "9999-12-31T23:30" })
})
