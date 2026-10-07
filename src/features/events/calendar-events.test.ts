import { expect, test } from "bun:test"
import {
  createEventCalendarIndex,
  prepareEventCalendar,
  selectCalendarEvents,
} from "@/features/events/calendar-events"
import { eventSchema } from "@/schemas/calendar-item"
import type { CalendarEvent } from "@/types/calendar-item"

function event(id: string, schedule: CalendarEvent["schedule"]): CalendarEvent {
  return eventSchema.parse({
    id: `${id.repeat(8)}-1111-4111-8111-111111111111`,
    ownerId: "test-owner",
    kind: "event",
    title: "Test event",
    description: "",
    schedule,
    recurrence: null,
    revision: 0,
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "2026-10-07T00:00:00.000Z",
    deletedAt: null,
  })
}
const timed = (
  localStart: string,
  localEnd: string | null,
  timeZone = "Europe/Madrid"
) => ({ mode: "timed" as const, localStart, localEnd, timeZone })
const day = (
  events: CalendarEvent[],
  date: string,
  timeZone = "Europe/Madrid"
) => selectCalendarEvents(events, { startDate: date, endDate: date }, timeZone)

test("event days honor civil all-day ranges and exact midnight end exclusion", () => {
  const allDay = event("a", {
    mode: "all_day",
    startDate: "2026-10-07",
    endDateExclusive: "2026-10-09",
  })
  const midnight = event("b", timed("2026-10-07T23:30", "2026-10-08T00:00"))
  const cross = event("c", timed("2026-10-07T23:30", "2026-10-08T00:30"))
  const events = [cross, midnight, allDay]
  expect(day(events, "2026-10-07").events.map((x) => x.id)).toEqual([
    allDay.id,
    midnight.id,
    cross.id,
  ])
  expect(day(events, "2026-10-08").events.map((x) => x.id)).toEqual([
    allDay.id,
    cross.id,
  ])
  expect(day(events, "2026-10-09").events).toHaveLength(0)
  expect(events[0]).toBe(cross)
})

test("account zone and DST use instants while point events appear only on their start day", () => {
  const point = event("a", timed("2026-10-07T00:30", null))
  expect(day([point], "2026-10-06", "America/Los_Angeles").events).toEqual([
    point,
  ])
  expect(day([point], "2026-10-07", "America/Los_Angeles").events).toHaveLength(
    0
  )
  const dst = event("b", timed("2026-03-28T23:30", "2026-03-30T00:00"))
  expect(day([dst], "2026-03-29").events).toEqual([dst])
  expect(day([dst], "2026-03-30").events).toHaveLength(0)
})

test("an account's skipped civil day does not gain a phantom timed event", () => {
  const crossing = event(
    "a",
    timed("2011-12-29T12:00", "2011-12-31T12:00", "Pacific/Apia")
  )
  expect(day([crossing], "2011-12-30", "Pacific/Apia").events).toHaveLength(0)
  expect(day([crossing], "2011-12-31", "Pacific/Apia").events).toEqual([
    crossing,
  ])
  // All-day dates remain civil, regardless of whether a local clock existed that day.
  const civil = event("b", {
    mode: "all_day",
    startDate: "2011-12-30",
    endDateExclusive: "2011-12-31",
  })
  expect(day([civil], "2011-12-30", "Pacific/Apia").events).toEqual([civil])
})

test("a brief return to the previous civil day is selected even when both endpoints share that earlier date", () => {
  const crossing = event(
    "a",
    timed("1987-10-25T02:29", "1987-10-25T03:00", "UTC")
  )
  expect(day([crossing], "1987-10-25", "America/St_Johns").events).toEqual([
    crossing,
  ])
  expect(day([crossing], "1987-10-24", "America/St_Johns").events).toEqual([
    crossing,
  ])
})

test("legacy schedule issues remain visible separately without hiding valid events", () => {
  const valid = event("a", timed("2026-10-25T12:00", null))
  const ambiguous = event("b", timed("2026-10-25T02:30", null))
  const gap = event("c", timed("2026-03-29T02:30", null))
  const result = day(
    [ambiguous, gap, valid, { ...valid, deletedAt: valid.createdAt }],
    "2026-10-25"
  )
  expect(result.events).toEqual([valid])
  expect(result.issues.map((x) => x.reason)).toEqual([
    "ambiguous",
    "nonexistent",
  ])
  const series = eventSchema.parse({
    ...valid,
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-25",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  })
  expect(day([series], "2026-10-25").events).toHaveLength(0)
})

test("calendar ranges are bounded, validated and preserve low civil years", () => {
  const low = event("a", timed("0001-01-01T12:00", null, "UTC"))
  expect(day([low], "0001-01-01", "UTC").events).toEqual([low])
  const high = event("b", timed("9999-12-31T12:00", null, "UTC"))
  expect(day([high], "9999-12-31", "UTC").events).toEqual([high])
  expect(() =>
    selectCalendarEvents(
      [],
      { startDate: "2026-01-01", endDate: "2027-01-01" },
      "UTC"
    )
  ).toThrow()
  expect(() =>
    selectCalendarEvents(
      [],
      { startDate: "2026-01-02", endDate: "2026-01-01" },
      "UTC"
    )
  ).toThrow()
  expect(() => day([], "2026-02-30")).toThrow()
  expect(() => day([], "2026-10-07", "Not/AZone")).toThrow()
})

test("a prepared calendar shares chronological results across cells and keeps range boundaries", () => {
  const events = [
    event("b", timed("2026-10-07T23:30", "2026-10-08T00:30")),
    event("a", {
      mode: "all_day",
      startDate: "2026-10-07",
      endDateExclusive: "2026-10-09",
    }),
  ]
  const original = JSON.stringify(events)
  const snapshot = prepareEventCalendar(
    events,
    { startDate: "2026-10-06", endDate: "2026-10-09" },
    "Europe/Madrid"
  )
  expect([...snapshot.counts.values()]).toEqual([0, 2, 2, 0])
  const index = createEventCalendarIndex(events, "Europe/Madrid")
  for (const date of ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]) {
    expect(snapshot.eventsByDate.get(date)).toEqual(day(events, date).events)
    expect(snapshot.counts.get(date)).toBe(
      index.select({ startDate: date, endDate: date }).events.length
    )
  }
  expect(JSON.stringify(events)).toBe(original)
  const high = prepareEventCalendar(
    [event("a", timed("9999-12-31T12:00", null, "UTC"))],
    { startDate: "9999-12-31", endDate: "9999-12-31" },
    "UTC"
  )
  expect(high.counts.get("9999-12-31")).toBe(1)
  expect(() =>
    index.select({ startDate: "2026-01-01", endDate: "2027-01-01" })
  ).toThrow()
})
