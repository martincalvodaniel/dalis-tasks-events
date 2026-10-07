import { describe, expect, test } from "bun:test"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import {
  possibleZonedInstants,
  resolveZonedInstant,
  ZonedTimeError,
} from "@/lib/calendar/zoned-time"

const isoCandidates = (local: string, zone: string) =>
  possibleZonedInstants(local, zone).map((instant) =>
    new Date(instant).toISOString()
  )

describe("event exact time", () => {
  test("resolves explicit zones, fractional offsets and low years without using the host zone", () => {
    expect(isoCandidates("2026-10-07T00:00", "UTC")).toEqual([
      "2026-10-07T00:00:00.000Z",
    ])
    expect(isoCandidates("2026-10-07T00:00", "Europe/Madrid")).toEqual([
      "2026-10-06T22:00:00.000Z",
    ])
    expect(isoCandidates("2026-10-07T00:00", "Asia/Kathmandu")).toEqual([
      "2026-10-06T18:15:00.000Z",
    ])
    expect(isoCandidates("0099-01-01T12:34", "UTC")).toEqual([
      "0099-01-01T12:34:00.000Z",
    ])
    expect(isoCandidates("0001-01-01T00:00", "UTC")).toEqual([
      "0001-01-01T00:00:00.000Z",
    ])
    expect(isoCandidates("9999-12-31T23:59", "UTC")).toEqual([
      "9999-12-31T23:59:00.000Z",
    ])
    expect(isoCandidates("1890-01-01T12:00", "Europe/Paris")).toEqual([
      "1890-01-01T11:50:39.000Z",
    ])
  })
  test("identifies full-hour and half-hour gaps and repeats without choosing an instant", () => {
    for (const [local, zone] of [
      ["2026-03-29T02:30", "Europe/Madrid"],
      ["2026-03-08T02:30", "America/New_York"],
      ["2026-10-04T02:15", "Australia/Lord_Howe"],
      ["2011-12-30T12:00", "Pacific/Apia"],
    ]) {
      expect(possibleZonedInstants(local, zone)).toEqual([])
      try {
        resolveZonedInstant(local, zone)
        throw new Error("Expected missing time")
      } catch (error) {
        expect(error).toBeInstanceOf(ZonedTimeError)
        expect((error as ZonedTimeError).reason).toBe("nonexistent")
      }
    }
    expect(isoCandidates("2026-10-25T02:30", "Europe/Madrid")).toEqual([
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ])
    expect(isoCandidates("2026-11-01T01:30", "America/New_York")).toEqual([
      "2026-11-01T05:30:00.000Z",
      "2026-11-01T06:30:00.000Z",
    ])
    expect(isoCandidates("2026-04-05T01:45", "Australia/Lord_Howe")).toEqual([
      "2026-04-04T14:45:00.000Z",
      "2026-04-04T15:15:00.000Z",
    ])
    expect(() =>
      resolveZonedInstant("2026-10-25T02:30", "Europe/Madrid")
    ).toThrow(ZonedTimeError)
  })
  test("uses elapsed duration across transitions, preserves no-end points and all-day civil ranges", () => {
    const schedule = {
      mode: "timed" as const,
      localStart: "2026-03-29T01:30",
      localEnd: "2026-03-29T03:30",
      timeZone: "Europe/Madrid",
    }
    expect(resolveEventSchedule(schedule)).toMatchObject({
      mode: "timed",
      durationMilliseconds: 3600000,
    })
    expect(
      resolveEventSchedule({
        ...schedule,
        localStart: "2026-10-25T01:30",
        localEnd: "2026-10-25T03:30",
      })
    ).toMatchObject({ durationMilliseconds: 10800000 })
    expect(resolveEventSchedule({ ...schedule, localEnd: null })).toMatchObject(
      { end: null, durationMilliseconds: null }
    )
    expect(
      resolveEventSchedule({
        ...schedule,
        localStart: "2026-10-07T23:30",
        localEnd: "2026-10-08T00:30",
      })
    ).toMatchObject({ durationMilliseconds: 3600000 })
    const allDay = {
      mode: "all_day" as const,
      startDate: "2026-03-29",
      endDateExclusive: "2026-03-30",
    }
    expect(resolveEventSchedule(allDay)).toEqual(allDay)
    expect(schedule.localStart).toBe("2026-03-29T01:30")
  })
  test("rejects invalid local inputs, missing endpoint hours and non-positive ranges", () => {
    for (const [local, zone] of [
      ["2025-02-29T12:00", "UTC"],
      ["2026-01-01T24:00", "UTC"],
      ["0000-01-01T00:00", "UTC"],
      ["2026-01-01T12:00", "Invalid/Zone"],
    ])
      expect(() => resolveZonedInstant(local, zone)).toThrow()
    expect(() =>
      resolveEventSchedule({
        mode: "timed",
        localStart: "2026-03-29T01:30",
        localEnd: "2026-03-29T02:30",
        timeZone: "Europe/Madrid",
      })
    ).toThrow(ZonedTimeError)
    expect(() =>
      resolveEventSchedule({
        mode: "timed",
        localStart: "2026-01-01T12:00",
        localEnd: "2026-01-01T11:00",
        timeZone: "UTC",
      })
    ).toThrow()
    expect(() =>
      resolveEventSchedule({
        mode: "all_day",
        startDate: "2026-01-01",
        endDateExclusive: "2026-01-01",
      })
    ).toThrow()
  })
})
