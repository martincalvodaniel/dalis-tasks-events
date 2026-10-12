import { expect, test } from "bun:test"
import {
  birthdayAppearancesPage,
  birthdayLeapDayPolicy,
} from "@/lib/calendar/birthday-appearances"
import { birthdayAppearanceSchema } from "@/schemas/birthday-appearance"
import { birthdaySchema } from "@/schemas/calendar-item"

function fixture(overrides: Record<string, unknown> = {}) {
  return birthdaySchema.parse({
    kind: "birthday",
    id: "6b7b5260-2156-462c-b0d0-3bca4b245917",
    ownerId: "birthday-test-owner",
    title: "Birthday",
    description: "",
    month: 10,
    day: 12,
    birthYear: null,
    timeZone: "Europe/Madrid",
    revision: 0,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  })
}
const query = { startDate: "2026-01-01", endDate: "2028-12-31" }

test("unknown birth years yield civil annual identities without age or progress", () => {
  const source = fixture(),
    before = structuredClone(source)
  const page = birthdayAppearancesPage(source, query)
  expect(page.appearances.map((appearance) => appearance.date)).toEqual([
    "2026-10-12",
    "2027-10-12",
    "2028-10-12",
  ])
  for (const appearance of page.appearances) {
    expect(appearance.id).toBe(`${source.id}:${appearance.date}`)
    expect(appearance.age).toBeNull()
    expect(
      birthdayAppearanceSchema.safeParse({ ...appearance, status: "completed" })
        .success
    ).toBe(false)
    expect(
      birthdayAppearanceSchema.safeParse({ ...appearance, checklist: [] })
        .success
    ).toBe(false)
  }
  expect(page.nextAfter).toBeNull()
  expect(source).toEqual(before)
})
test("known birth years exclude earlier dates and calculate age only on each anniversary", () => {
  expect(
    birthdayAppearancesPage(
      fixture({ birthYear: 2027 }),
      query
    ).appearances.map((appearance) => [appearance.date, appearance.age])
  ).toEqual([
    ["2027-10-12", 0],
    ["2028-10-12", 1],
  ])
  expect(
    birthdayAppearancesPage(fixture({ birthYear: 2029 }), query).appearances
  ).toEqual([])
})
test("leap birthdays preserve February 29 including Gregorian century rules", () => {
  expect(birthdayLeapDayPolicy).toBe("leap_years_only")
  const page = birthdayAppearancesPage(
    fixture({ month: 2, day: 29, birthYear: null }),
    { startDate: "1896-01-01", endDate: "2104-12-31", limit: 100 }
  )
  const dates = page.appearances.map((appearance) => appearance.date)
  expect(dates).toContain("1896-02-29")
  expect(dates).not.toContain("1900-02-29")
  expect(dates).toContain("2000-02-29")
  expect(dates).not.toContain("2100-02-29")
  expect(dates).toContain("2104-02-29")
  expect(dates.every((date) => date.endsWith("02-29"))).toBe(true)
})
test("exclusive cursors page anniversaries without duplicate or skipped identities", () => {
  const source = fixture()
  const full = birthdayAppearancesPage(source, query)
  const first = birthdayAppearancesPage(source, { ...query, limit: 1 })
  const second = birthdayAppearancesPage(source, {
    ...query,
    limit: 1,
    afterDate: first.nextAfter,
  })
  const third = birthdayAppearancesPage(source, {
    ...query,
    limit: 1,
    afterDate: second.nextAfter,
  })
  expect([
    ...first.appearances,
    ...second.appearances,
    ...third.appearances,
  ]).toEqual(full.appearances)
  expect(third.nextAfter).toBeNull()
  expect(
    birthdayAppearancesPage(source, { ...query, afterDate: "2028-10-12" })
      .appearances
  ).toEqual([])
})
test("calendar extremes, deleted records and time zones cannot shift an anniversary", () => {
  const earliest = birthdayAppearancesPage(fixture({ month: 1, day: 1 }), {
    startDate: "0001-01-01",
    endDate: "0001-01-01",
  })
  expect(earliest.appearances[0].date).toBe("0001-01-01")
  const last = birthdayAppearancesPage(
    fixture({ month: 12, day: 31, birthYear: 1 }),
    { startDate: "9999-01-01", endDate: "9999-12-31" }
  )
  expect(last.appearances[0].age).toBe(9998)
  expect(last.nextAfter).toBeNull()
  expect(
    birthdayAppearancesPage(fixture({ timeZone: "Pacific/Kiritimati" }), query)
  ).toEqual(
    birthdayAppearancesPage(fixture({ timeZone: "America/Los_Angeles" }), query)
  )
  expect(
    birthdayAppearancesPage(
      fixture({ deletedAt: "2026-10-12T00:00:00.000Z" }),
      query
    )
  ).toEqual({ appearances: [], nextAfter: null })
})
test("invalid dates, cursors and incoherent output are rejected completely", () => {
  expect(() =>
    birthdayAppearancesPage({ ...fixture(), month: 4, day: 31 }, query)
  ).toThrow()
  expect(() =>
    birthdayAppearancesPage(fixture(), { ...query, limit: 0 })
  ).toThrow()
  expect(() =>
    birthdayAppearancesPage(fixture(), { ...query, afterDate: "2029-01-01" })
  ).toThrow()
  expect(() =>
    birthdayAppearancesPage(fixture(), {
      startDate: "2028-01-01",
      endDate: "2027-01-01",
    })
  ).toThrow()
  const appearance = birthdayAppearancesPage(fixture(), query).appearances[0]
  expect(
    birthdayAppearanceSchema.safeParse({ ...appearance, date: "2026-10-13" })
      .success
  ).toBe(false)
})
