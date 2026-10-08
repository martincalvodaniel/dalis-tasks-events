import { incidentTaskStatuses } from "@/features/sync/components/sync-incident-copy"
import type { CalendarItem, CalendarItemDraft } from "@/types/calendar-item"

export function SyncIncidentVersion({
  label,
  item,
}: {
  label: string
  item: CalendarItem | CalendarItemDraft | null
}) {
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900"
    >
      <h4 className="font-medium">{label}</h4>
      {!item ? (
        <p className="mt-1 text-zinc-500">No disponible en este dispositivo.</p>
      ) : (
        <div className="mt-1 space-y-1 break-words [overflow-wrap:anywhere]">
          {"deletedAt" in item && item.deletedAt ? (
            <p className="font-medium">Elemento eliminado</p>
          ) : null}
          <p>{item.title}</p>
          {item.description ? (
            <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
              {item.description}
            </p>
          ) : null}
          {item.kind === "task" ? (
            <>
              <p>
                {item.scheduledDate} · {incidentTaskStatuses[item.status]}
              </p>
              {item.checklist.length > 0 ? (
                <ul aria-label="Checklist" className="space-y-1">
                  {item.checklist.map((entry) => (
                    <li key={entry.id}>
                      {entry.completed ? "☑" : "☐"} {entry.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : item.kind === "event" ? (
            item.schedule.mode === "all_day" ? (
              <p>
                Todo el día · desde {item.schedule.startDate} hasta{" "}
                {item.schedule.endDateExclusive} (sin incluir)
              </p>
            ) : (
              <p>
                {item.schedule.localStart.replace("T", " ")}
                {item.schedule.localEnd
                  ? ` — ${item.schedule.localEnd.replace("T", " ")}`
                  : ""}{" "}
                · {item.schedule.timeZone}
              </p>
            )
          ) : (
            <p>
              Cumpleaños · {item.day}/{item.month}
              {item.birthYear ? `/${item.birthYear}` : ""}
            </p>
          )}
          {"recurrence" in item && item.recurrence ? (
            <p>Con repetición (solo local por ahora).</p>
          ) : null}
          {"revision" in item ? (
            <p className="text-xs text-zinc-500">Revisión {item.revision}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}
