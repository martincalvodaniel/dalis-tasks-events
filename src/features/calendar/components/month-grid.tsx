"use client"

import { useMonthSwipe } from "@/features/calendar/hooks/use-month-swipe"
import { calendarHref, calendarWeeks } from "@/features/calendar/month-view"
import { civilDateToUtc } from "@/lib/calendar/civil-date"

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "full",
  timeZone: "UTC",
})
const weekdays = [
  ["Lun", "Lunes"],
  ["Mar", "Martes"],
  ["Mié", "Miércoles"],
  ["Jue", "Jueves"],
  ["Vie", "Viernes"],
  ["Sáb", "Sábado"],
  ["Dom", "Domingo"],
] as const
const controlClass =
  "inline-flex min-h-11 items-center justify-center px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"

export function MonthGrid({
  selectedDate,
  today,
  counts,
  incompleteDates,
  completionKnown = true,
  dropScope,
}: {
  selectedDate: string
  today: string
  dropScope?: string
  counts: ReadonlyMap<string, number>
  incompleteDates?: ReadonlySet<string>
  completionKnown?: boolean
}) {
  const swipe = useMonthSwipe(selectedDate)
  const title = monthFormatter.format(civilDateToUtc(selectedDate))
  return (
    <section
      aria-label="Calendario mensual. Desliza para cambiar de mes o usa Re Pág y Av Pág."
      tabIndex={-1}
      aria-keyshortcuts="PageUp PageDown"
      {...swipe}
      data-order-drop-scope={dropScope}
      className="touch-pan-y touch-pinch-zoom select-none rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 wrap-anywhere text-base font-semibold first-letter:uppercase"
        >
          {title}
        </h2>
        <a
          href={calendarHref(today)}
          className={controlClass}
          data-calendar-control
        >
          <span className="rounded-lg border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            Hoy
          </span>
        </a>
      </div>
      <div className="touch-pan-y touch-pinch-zoom">
        <table className="w-full table-fixed border-separate border-spacing-1">
          <caption className="sr-only">
            {title}. Selecciona un día para ver sus planes.
          </caption>
          <thead>
            <tr>
              {weekdays.map(([short, full]) => (
                <th
                  key={full}
                  scope="col"
                  className="pb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                >
                  <abbr title={full} className="no-underline">
                    {short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendarWeeks(selectedDate).map((week) => (
              <tr key={week[0].key}>
                {week.map((cell) => {
                  if (!cell.date) return <td key={cell.key} />
                  const count = counts.get(cell.date) ?? 0
                  const incomplete =
                    count > 0 && incompleteDates?.has(cell.date)
                  const completed =
                    count > 0 &&
                    completionKnown &&
                    incompleteDates &&
                    !incomplete
                  const selected = cell.date === selectedDate
                  const isToday = cell.date === today
                  return (
                    <td key={cell.key} className="p-0 align-top">
                      <a
                        draggable={false}
                        data-order-drop-date={dropScope ? cell.date : undefined}
                        href={calendarHref(cell.date)}
                        aria-current={selected ? "true" : undefined}
                        aria-label={`${dayFormatter.format(civilDateToUtc(cell.date))}${isToday ? ", hoy" : ""}${selected ? ", seleccionado" : ""}${incomplete ? ", planes sin completar" : completed ? ", todos los planes completados" : count === 0 ? ", sin planes" : ""}`}
                        className={`flex min-h-14 items-center justify-center rounded-lg border py-1 text-sm text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 dark:text-zinc-200 ${selected ? "border-emerald-700 bg-zinc-100 dark:bg-zinc-800" : isToday ? "border-emerald-700" : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"} ${cell.inMonth ? "" : "opacity-60"}`}
                      >
                        <span
                          className={
                            incomplete
                              ? "font-bold text-red-700 dark:text-red-400"
                              : completed
                                ? "font-bold text-blue-700 dark:text-blue-400"
                                : undefined
                          }
                        >
                          {cell.day}
                        </span>
                      </a>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
