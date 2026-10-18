import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"
import type { TagResolutionRequest } from "@/types/tag-resolution"

export function TagIncidentResolutionDialog({
  incident,
  choice,
  busy,
  onConfirm,
  onClose,
}: {
  incident: PersonalSyncIncidentSnapshot
  choice: TagResolutionRequest["choice"]
  busy: boolean
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const adopt = choice === "adopt_remote"
  const count = incident.intentions.filter(
    (entry) => entry.entityKey === incident.entry.entityKey
  ).length
  const remote = incident.remote.find(
    (entry) => entry.entityKey === incident.entry.entityKey
  )?.record
  const chosen = adopt
    ? incident.remote
    : incident.local.map((entry) =>
        entry.record?.store === "tags" && remote?.store === "tags"
          ? {
              ...entry,
              record: {
                store: "tags" as const,
                record: {
                  ...entry.record.record,
                  position: remote.record.position,
                  revision: remote.record.revision,
                },
              },
            }
          : entry
      )
  return (
    <ConfirmationDialog
      heading={
        adopt ? "¿Usar la categoría remota?" : "¿Enviar tu nombre y color?"
      }
      confirmLabel={
        adopt ? "Usar categoría remota" : "Guardar categoría para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Si la categoría o sus cambios pendientes han cambiado, cierra y vuelve a revisar."
    >
      <div className="mt-3 space-y-2 text-sm">
        <PersonalIncidentVersion
          label="Categoría que usarás"
          snapshot={chosen}
          tagNames={incident.tagNames}
        />
        <p>
          Esta elección sustituye {count}{" "}
          {count === 1
            ? "cambio de categoría pendiente"
            : "cambios de categoría pendientes"}
          . El historial se conserva; no cambia tus planes ni sus asignaciones.
        </p>
        <p>
          {adopt
            ? "La categoría remota es la última conocida aquí y puede haber cambiado después. Tu valor local dejará de mostrarse."
            : "Se enviarán tu nombre y color actuales, conservando el orden de la versión remota conocida. Quedará pendiente de confirmación cuando haya conexión y puede aparecer otro conflicto."}
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
