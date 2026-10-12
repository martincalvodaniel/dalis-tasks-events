import { addCivilDays } from "@/lib/calendar/civil-date"
import { civilDateSchema } from "@/schemas/primitives"

export function adjacentFormDate(
  value: string,
  days: -1 | 1,
  minimum = "0001-01-01",
  maximum = "9999-12-31"
): string | null {
  if (!civilDateSchema.safeParse(value).success) return null
  try {
    const result = addCivilDays(value, days)
    return result >= minimum && result <= maximum ? result : null
  } catch {
    return null
  }
}
