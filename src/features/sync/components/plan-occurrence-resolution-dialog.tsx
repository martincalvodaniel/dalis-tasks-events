import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PlanOccurrenceIncidentVersion } from "@/features/sync/components/plan-occurrence-incident-version"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

export function PlanOccurrenceResolutionDialog({
  incident,
  busy,
  onConfirm,
  onClose,
}: {
  incident: PlanOccurrenceSyncIncidentSnapshot
  busy: boolean
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  return (
    <ConfirmationDialog
      heading="¿Usar esta aparición remota?"
      confirmLabel="Usar versión remota"
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Si el plan o sus cambios pendientes han cambiado, cierra y vuelve a revisar."
    >
      <div className="mt-3 space-y-2 text-sm">
        <p>
          Fecha original:{" "}
          {incident.outcome.operation.command.occurrenceId
            .slice(incident.series.id.length + 1)
            .replace("T", " ")}
        </p>
        <PlanOccurrenceIncidentVersion
          label="Aparición que conservarás"
          occurrence={incident.remote}
          series={incident.series}
        />
        <p>
          Tu borrador de este día dejará de mostrarse. Esta elección sustituye{" "}
          {incident.intentions.length}{" "}
          {incident.intentions.length === 1
            ? "cambio pendiente"
            : "cambios pendientes"}{" "}
          de esta aparición; el historial se conserva.
        </p>
        <p>
          No cambia la serie ni otros días y no envía cambios al servidor. La
          versión remota es la última conocida aquí y puede haber cambiado
          después.
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
