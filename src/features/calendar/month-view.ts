import { civilDateToUtc } from "@/lib/calendar/civil-date"
import { civilDateSchema } from "@/schemas/primitives"

export function calendarDateFromSearch(search: string): string | null {
  const parsed = civilDateSchema.safeParse(
    new URLSearchParams(search).get("date")
  )
  return parsed.success ? parsed.data : null
}

export function calendarHref(date: string): string {
  return `/workspace?view=calendar&date=${civilDateSchema.parse(date)}`
}

export function adjacentMonth(date: string, offset: -1 | 1): string | null {
  const current = civilDateToUtc(date)
  const day = current.getUTCDate()
  current.setUTCDate(1)
  current.setUTCMonth(current.getUTCMonth() + offset)
  if (current.getUTCFullYear() < 1 || current.getUTCFullYear() > 9999)
    return null
  const last = new Date(current)
  last.setUTCMonth(last.getUTCMonth() + 1, 0)
  current.setUTCDate(Math.min(day, last.getUTCDate()))
  return current.toISOString().slice(0, 10)
}

export function calendarWeeks(date: string) {
  const month = civilDateSchema.parse(date).slice(0, 7)
  const first = civilDateToUtc(`${month}-01`)
  const last = new Date(first)
  last.setUTCMonth(last.getUTCMonth() + 1, 0)
  const offset = (first.getUTCDay() + 6) % 7
  const length = Math.ceil((offset + last.getUTCDate()) / 7) * 7
  const cells = Array.from({ length }, (_, index) => {
    const value = new Date(first)
    value.setUTCDate(1 - offset + index)
    const supported =
      value.getUTCFullYear() >= 1 && value.getUTCFullYear() <= 9999
    const day = supported ? value.toISOString().slice(0, 10) : null
    return {
      key: day ?? `boundary-${index}`,
      date: day,
      day: value.getUTCDate(),
      inMonth: day?.startsWith(month) ?? false,
    }
  })
  return Array.from({ length: length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7)
  )
}
