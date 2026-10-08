import type { CalendarItem } from "@/types/calendar-item"

export function BackupItemContent({ item }: { item: CalendarItem }) {
  return (
    <div className="space-y-1 break-words text-xs text-zinc-600 dark:text-zinc-400">
      <p>
        {item.kind === "task"
          ? `Tarea · ${item.scheduledDate} · ${{ not_started: "Sin empezar", in_progress: "En proceso", completed: "Completada" }[item.status]}`
          : item.kind === "event"
            ? item.schedule.mode === "all_day"
              ? `Evento · ${item.schedule.startDate} · Día completo`
              : `Evento · ${item.schedule.localStart.replace("T", " ")} · ${item.schedule.timeZone}${item.schedule.localEnd ? ` · Hasta ${item.schedule.localEnd.replace("T", " ")}` : ""}`
            : `Cumpleaños · ${item.day}/${item.month}`}
      </p>
      {item.kind === "event" && item.schedule.mode === "all_day" ? (
        <p>Hasta {item.schedule.endDateExclusive} (sin incluir ese día).</p>
      ) : null}
      {item.description ? (
        <p className="whitespace-pre-wrap">{item.description}</p>
      ) : null}
      {item.kind === "task" && item.checklist.length > 0 ? (
        <ul className="space-y-1">
          {item.checklist.map((entry) => (
            <li key={entry.id}>
              {entry.completed ? "✓" : "○"} {entry.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
