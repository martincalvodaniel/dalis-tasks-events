import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PlanOccurrenceIncidentVersion } from "@/features/sync/components/plan-occurrence-incident-version"
import { incidentTaskStatuses } from "@/features/sync/components/sync-incident-copy"
import { availablePlanOccurrenceCohortResolutionChoices } from "@/lib/sync/plan-occurrence-cohort-resolution"
import type { PlanOccurrenceCohortComparison } from "@/types/plan-occurrence-cohort-comparison"
import type { PlanOccurrenceCohortResolutionRequest } from "@/types/plan-occurrence-cohort-resolution"

export function PlanOccurrenceCohortResolutionDialog({
  snapshot,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: PlanOccurrenceCohortComparison
  actor: string
  choice: PlanOccurrenceCohortResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: PlanOccurrenceCohortResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const choices = availablePlanOccurrenceCohortResolutionChoices(
    snapshot,
    actor
  )
  if (!choices.includes(choice)) return null
  const adopt = choice === "adopt_remote",
    series = snapshot.source.series
  return (
    <ConfirmationDialog
      heading="Resolver fechas relacionadas"
      confirmLabel={
        adopt ? "Usar versiones remotas" : "Guardar apariciones para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. La serie, sus fechas o los cambios pendientes pueden haber cambiado; cierra y vuelve a revisar."
    >
      <p className="mt-3 text-sm font-medium break-words">{series.title}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {snapshot.slots.length} fechas · {snapshot.operationIds.length} cambios
        relacionados
      </p>
      <fieldset disabled={busy} className="mt-2 space-y-1 text-sm">
        <legend className="font-medium">Cómo resolver estas fechas</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="appearance-cohort-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar todas las versiones remotas conocidas
        </label>
        {choices.includes("retry_local") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="appearance-cohort-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_local")}
            />
            Enviar todos mis borradores completos
          </label>
        ) : null}
      </fieldset>
      <div className="mt-2 space-y-2 text-sm">
        {snapshot.slots.map((slot, index) => {
          const chosen = adopt ? slot.remote : slot.local
          return (
            <details
              key={slot.occurrenceId}
              open={index === 0}
              className="border-t border-zinc-200 dark:border-zinc-700"
            >
              <summary className="min-h-11 cursor-pointer py-2 break-words">
                {slot.occurrenceId
                  .slice(series.id.length + 1)
                  .replace("T", " ")}
                {chosen ? (
                  <span className="ml-2 text-xs text-zinc-500">
                    {chosen.cancelled
                      ? "Cancelada"
                      : chosen.deletedAt
                        ? "Eliminada"
                        : incidentTaskStatuses[chosen.status]}
                  </span>
                ) : null}
              </summary>
              <p className="mb-1 text-xs font-medium">
                {adopt
                  ? "Conservarás la versión remota"
                  : "Enviarás tu borrador completo"}
              </p>
              <div className="grid min-w-0 gap-2 pb-2 sm:grid-cols-2">
                <PlanOccurrenceIncidentVersion
                  label="Tu versión"
                  occurrence={slot.local}
                  series={series}
                />
                <PlanOccurrenceIncidentVersion
                  label="Remota conocida"
                  occurrence={slot.remote}
                  series={series}
                />
              </div>
            </details>
          )
        })}
        <p>
          Esta elección sustituye los {snapshot.operationIds.length} cambios
          pendientes de estas {snapshot.slots.length} fechas en conjunto; el
          historial se conserva.
        </p>
        <p>No cambia la serie ni las fechas fuera de esta revisión.</p>
        {adopt ? (
          <p>
            Tus borradores de estas fechas dejarán de mostrarse. La elección no
            envía cambios al servidor. Las versiones remotas son las últimas
            conocidas aquí y pueden haber cambiado después.
          </p>
        ) : (
          <>
            <p>
              Se enviarán todas estas apariciones, incluidos contenido, fecha,
              estado, pasos y cancelación; no se fusionarán automáticamente con
              las remotas. Quedarán pendientes de confirmación cuando haya
              conexión y puede aparecer otro conflicto.
            </p>
            <p>
              Se sincronizan en una cadena por pasos; otro dispositivo puede
              mostrar un estado intermedio hasta terminar todas las fechas.
            </p>
          </>
        )}
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
