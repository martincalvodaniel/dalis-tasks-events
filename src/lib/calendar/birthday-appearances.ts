import type { z } from "zod"
import { birthdayAppearanceSchema } from "@/schemas/birthday-appearance"
import { birthdaySchema } from "@/schemas/calendar-item"
import { civilDateSchema } from "@/schemas/primitives"
import { recurrenceQuerySchema } from "@/schemas/recurrence-query"
import type { BirthdayAppearancePage } from "@/types/birthday-appearance"

// Preserve February 29: annual birthdays follow the existing leap-year-only rule.
export const birthdayLeapDayPolicy = "leap_years_only" as const

export function birthdayAppearancesPage(
  input: unknown,
  queryInput: z.input<typeof recurrenceQuerySchema>
): BirthdayAppearancePage {
  const birthday = birthdaySchema.parse(input)
  const query = recurrenceQuerySchema.parse(queryInput)
  const page: BirthdayAppearancePage = { appearances: [], nextAfter: null }
  if (birthday.deletedAt) return page
  const firstYear = Math.max(
    Number(query.startDate.slice(0, 4)),
    birthday.birthYear ?? 1
  )
  const lastYear = Number(query.endDate.slice(0, 4))
  const suffix = `${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`
  // Civil years are bounded to 1..9999; no wall clock or UTC conversion is involved.
  for (let year = firstYear; year <= lastYear; year++) {
    const candidate = civilDateSchema.safeParse(
      `${String(year).padStart(4, "0")}-${suffix}`
    )
    if (!candidate.success) continue
    const date = candidate.data
    if (
      date < query.startDate ||
      date > query.endDate ||
      (query.afterDate && date <= query.afterDate)
    )
      continue
    if (page.appearances.length === query.limit) {
      page.nextAfter = page.appearances[page.appearances.length - 1].date
      break
    }
    page.appearances.push(
      birthdayAppearanceSchema.parse({
        kind: "birthday",
        id: `${birthday.id}:${date}`,
        seriesId: birthday.id,
        slotKey: date,
        date,
        age: birthday.birthYear === null ? null : year - birthday.birthYear,
      })
    )
  }
  return page
}
