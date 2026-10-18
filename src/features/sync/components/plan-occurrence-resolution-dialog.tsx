import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PlanOccurrenceIncidentVersion } from "@/features/sync/components/plan-occurrence-incident-version"
import type { PlanOccurrenceResolutionRequest } from "@/types/plan-occurrence-resolution"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

export function PlanOccurrenceResolutionDialog({
  incident,
  choice = "adopt_remote",
  busy,
  onConfirm,
  onClose,
}: {
  incident: PlanOccurrenceSyncIncidentSnapshot
  choice?: PlanOccurrenceResolutionRequest["choice"]
  busy: boolean
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const adopt = choice === "adopt_remote"
  return (
    <ConfirmationDialog
      heading={
        adopt
          ? "¿Usar esta aparición remota?"
          : "¿Enviar tu aparición completa?"
      }
      confirmLabel={adopt ? "Usar versión remota" : "Guardar para enviar"}
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
          label={adopt ? "Aparición que conservarás" : "Aparición que enviarás"}
          occurrence={adopt ? incident.remote : incident.local}
          series={incident.series}
        />
        <p>
          {adopt ? "Tu borrador de este día dejará de mostrarse. " : ""}Esta
          elección sustituye {incident.intentions.length}{" "}
          {incident.intentions.length === 1
            ? "cambio pendiente"
            : "cambios pendientes"}{" "}
          de esta aparición; el historial se conserva.
        </p>
        <p>No cambia la serie ni otros días.</p>
        {adopt ? (
          <p>
            La elección no envía cambios al servidor. La versión remota es la
            última conocida aquí y puede haber cambiado después.
          </p>
        ) : (
          <>
            <p>
              Se enviará toda esta aparición, incluidos estado y pasos; no se
              fusionará automáticamente con la remota. Quedará pendiente de
              confirmación cuando haya conexión y puede aparecer otro conflicto.
            </p>
            <p>
              Se sincroniza por pasos; otro dispositivo puede mostrar un estado
              intermedio hasta terminar.
            </p>
          </>
        )}
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
