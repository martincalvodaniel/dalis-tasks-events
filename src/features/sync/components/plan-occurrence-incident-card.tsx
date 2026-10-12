import { PlanOccurrenceIncidentVersion } from "@/features/sync/components/plan-occurrence-incident-version"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

export function PlanOccurrenceIncidentCard({
  incident,
}: {
  incident: PlanOccurrenceSyncIncidentSnapshot
}) {
  return (
    <details className="border-t border-zinc-200 text-sm dark:border-zinc-800">
      <summary className="min-h-11 cursor-pointer py-2 break-words">
        {incident.series.title}
        <span className="ml-2 text-xs text-zinc-500">
          {incident.reason === "conflict"
            ? "Conflicto de aparición"
            : "Cambio de aparición rechazado"}
        </span>
      </summary>
      <div className="space-y-2 pb-2">
        <p>
          Fecha original:{" "}
          {incident.outcome.operation.command.occurrenceId
            .slice(incident.series.id.length + 1)
            .replace("T", " ")}
        </p>
        <p className="text-xs text-zinc-500">
          El cambio y sus dependencias se conservan. La versión remota es la
          última conocida y puede haber cambiado después.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <PlanOccurrenceIncidentVersion
            label="Tu estado actual"
            occurrence={incident.local}
            series={incident.series}
          />
          <PlanOccurrenceIncidentVersion
            label="Versión remota conocida"
            occurrence={incident.remote}
            series={incident.series}
          />
        </div>
        <details>
          <summary className="min-h-11 cursor-pointer py-2">
            Cambio enviado e historial conservado
          </summary>
          <p className="my-1 text-xs">
            Serie actual: revisión {incident.series.revision}. Revisión de
            partida de la serie: {incident.entry.operation.baseRevision}.
            Revisión enviada de la aparición:{" "}
            {incident.outcome.operation.command.expectedOccurrenceRevision}.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <PlanOccurrenceIncidentVersion
              label="Estado local al recibir el resultado"
              occurrence={incident.localAtOutcome}
              series={incident.seriesAtOutcome}
            />
            <PlanOccurrenceIncidentVersion
              label="Remoto observado al recibir el resultado"
              occurrence={incident.shadowAtOutcome}
              series={incident.seriesAtOutcome}
            />
          </div>
          <p className="my-1 text-xs">
            {incident.intentions.length} cambios relacionados conservados.
          </p>
        </details>
        <p className="text-xs text-zinc-500">
          La resolución desde esta pantalla aún no está disponible. Ningún
          cambio se ha descartado ni confirmado por esta comparación.
        </p>
      </div>
    </details>
  )
}
