import {
  adjacentMonth,
  calendarHref,
  calendarWeeks,
} from "@/features/calendar/month-view"
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
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-zinc-700"

export function MonthGrid({
  selectedDate,
  today,
  counts,
}: {
  selectedDate: string
  today: string
  counts: ReadonlyMap<string, number>
}) {
  const previous = adjacentMonth(selectedDate, -1)
  const next = adjacentMonth(selectedDate, 1)
  const title = monthFormatter.format(civilDateToUtc(selectedDate))
  return (
    <section
      aria-label="Calendario mensual"
      className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-xl font-semibold first-letter:uppercase">{title}</h2>
      <nav aria-label="Cambiar mes" className="my-4 flex flex-wrap gap-2">
        {previous ? (
          <a
            href={calendarHref(previous)}
            aria-label="Mes anterior"
            className={controlClass}
          >
            Anterior
          </a>
        ) : (
          <span className={`${controlClass} opacity-50`}>Anterior</span>
        )}
        <a href={calendarHref(today)} className={controlClass}>
          Hoy
        </a>
        {next ? (
          <a
            href={calendarHref(next)}
            aria-label="Mes siguiente"
            className={controlClass}
          >
            Siguiente
          </a>
        ) : (
          <span className={`${controlClass} opacity-50`}>Siguiente</span>
        )}
      </nav>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[15rem] table-fixed border-separate border-spacing-1">
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
                  const selected = cell.date === selectedDate
                  const isToday = cell.date === today
                  return (
                    <td key={cell.key} className="p-0 align-top">
                      <a
                        href={calendarHref(cell.date)}
                        aria-current={selected ? "true" : undefined}
                        aria-label={`${dayFormatter.format(civilDateToUtc(cell.date))}${isToday ? ", hoy" : ""}${selected ? ", seleccionado" : ""}, ${count} ${count === 1 ? "elemento" : "elementos"}`}
                        className={`flex min-h-14 flex-col items-center justify-center rounded-lg border py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 ${selected ? "border-emerald-700 bg-emerald-700 font-bold text-white" : isToday ? "border-emerald-700 text-emerald-800 dark:text-emerald-300" : "border-transparent text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"} ${cell.inMonth ? "" : "opacity-60"}`}
                      >
                        <span>{cell.day}</span>
                        {count ? (
                          <span className="text-xs" aria-hidden="true">
                            {count > 99 ? "99+" : String(count)} ·
                          </span>
                        ) : (
                          <span className="h-4" aria-hidden="true" />
                        )}
                      </a>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hidden md:block mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Los números indican las tareas y los eventos de cada día, incluidas las
        tareas completadas.
      </p>
    </section>
  )
}
