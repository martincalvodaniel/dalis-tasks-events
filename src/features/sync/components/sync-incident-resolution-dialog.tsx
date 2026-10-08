import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { SyncIncidentVersion } from "@/features/sync/components/sync-incident-version"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"
import type { SyncResolutionRequest } from "@/types/sync-resolution"

export function SyncIncidentResolutionDialog({
  incident,
  choice,
  busy,
  onConfirm,
  onClose,
}: {
  incident: SyncIncidentSnapshot
  choice: SyncResolutionRequest["choice"]
  busy: boolean
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const adopt = choice === "adopt_remote"
  const copying = choice === "copy_local"
  const deleting = !adopt && Boolean(incident.local?.deletedAt)
  return (
    <ConfirmationDialog
      heading={
        adopt
          ? "¿Usar la versión remota conocida?"
          : copying
            ? "¿Crear una copia de tu borrador?"
            : deleting
              ? "¿Enviar el borrado local?"
              : "¿Enviar todo tu borrador?"
      }
      confirmLabel={
        adopt
          ? "Usar versión remota"
          : copying
            ? "Crear copia para enviar"
            : deleting
              ? "Guardar borrado para enviar"
              : "Guardar para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Si el elemento cambió o tiene cambios relacionados pendientes, cierra este diálogo y vuelve a revisar."
    >
      <div className="mt-3 space-y-2 text-sm">
        <SyncIncidentVersion
          label={adopt ? "Versión que usarás" : "Contenido que enviarás"}
          item={adopt ? incident.remote : incident.local}
        />
        <p>
          Esta elección sustituye {incident.intentions.length}{" "}
          {incident.intentions.length === 1
            ? "cambio pendiente"
            : "cambios pendientes"}{" "}
          de este elemento, incluidas las ediciones posteriores. El historial se
          conserva.
        </p>
        <p>
          {adopt
            ? "Tu borrador dejará de mostrarse. La versión remota es la última conocida aquí y puede haber cambios más recientes."
            : copying
              ? "El original seguirá eliminado. Se creará otro elemento con tu contenido, estado, checklist y fecha, sin copiar categoría ni orden. La copia quedará pendiente de confirmación cuando haya conexión."
              : deleting
                ? "Se enviará una nueva intención de borrado. Quedará pendiente de confirmación cuando haya conexión y puede aparecer otro conflicto."
                : "Se enviará toda esta versión, incluidos estado y checklist; no se fusionará automáticamente con el remoto. Quedará pendiente de confirmación cuando haya conexión y puede aparecer otro conflicto."}
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
