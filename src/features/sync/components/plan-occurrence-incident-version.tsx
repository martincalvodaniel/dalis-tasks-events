import { incidentTaskStatuses } from "@/features/sync/components/sync-incident-copy"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

export function PlanOccurrenceIncidentVersion({
  label,
  occurrence,
  series,
}: {
  label: string
  occurrence: PlanOccurrence | null
  series: Plan | null
}) {
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900"
    >
      <h4 className="font-medium">{label}</h4>
      {occurrence ? (
        <div className="mt-1 space-y-1 break-words">
          <p>{occurrence.content?.title ?? series?.title ?? "Aparición"}</p>
          {(occurrence.content?.description ?? series?.description) ? (
            <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
              {occurrence.content?.description ?? series?.description}
            </p>
          ) : null}
          <p>
            {incidentTaskStatuses[occurrence.status]} · revisión{" "}
            {occurrence.revision}
          </p>
          {occurrence.cancelled ? <p>Aparición cancelada</p> : null}
          {occurrence.deletedAt ? <p>Aparición eliminada</p> : null}
          <p>
            {occurrence.schedule.mode === "all_day"
              ? `Todo el día · desde ${occurrence.schedule.startDate} hasta ${occurrence.schedule.endDateExclusive} (sin incluir)`
              : `${occurrence.schedule.localStart.replace("T", " ")}${occurrence.schedule.localEnd ? ` — ${occurrence.schedule.localEnd.replace("T", " ")}` : ""} · ${occurrence.schedule.timeZone}`}
          </p>
          {occurrence.checklist.length ? (
            <ul aria-label="Pasos de la aparición">
              {occurrence.checklist.map((step) => (
                <li key={step.id}>
                  {step.completed ? "☑" : "☐"} {step.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-zinc-500">Sin excepción guardada.</p>
      )}
    </section>
  )
}
