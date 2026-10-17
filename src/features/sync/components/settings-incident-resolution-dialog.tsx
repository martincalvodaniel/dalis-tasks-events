import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import type { SettingsResolutionRequest } from "@/types/settings-resolution"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"

export function SettingsIncidentResolutionDialog({
  incident,
  choice,
  busy,
  onConfirm,
  onClose,
}: {
  incident: PersonalSyncIncidentSnapshot
  choice: SettingsResolutionRequest["choice"]
  busy: boolean
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const adopt = choice === "adopt_remote"
  const count = incident.intentions.filter(
    (entry) => entry.entityKey === incident.entry.entityKey
  ).length
  return (
    <ConfirmationDialog
      heading={
        adopt ? "¿Usar la zona remota conocida?" : "¿Enviar tu zona horaria?"
      }
      confirmLabel={adopt ? "Usar zona remota" : "Guardar zona para enviar"}
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Si la zona o sus cambios pendientes han cambiado, cierra y vuelve a revisar."
    >
      <div className="mt-3 space-y-2 text-sm">
        <PersonalIncidentVersion
          label="Zona que usarás"
          snapshot={adopt ? incident.remote : incident.local}
          tagNames={incident.tagNames}
        />
        <p>
          Esta elección sustituye {count}{" "}
          {count === 1
            ? "cambio de zona pendiente"
            : "cambios de zona pendientes"}
          . El historial se conserva; no cambia tus planes ni sus fechas.
        </p>
        <p>
          {adopt
            ? "La zona remota es la última conocida aquí y puede haber cambiado después. Tu valor local dejará de mostrarse."
            : "Se guardará una nueva intención con tu zona actual, pendiente de confirmación cuando haya conexión. Puede aparecer otro conflicto."}
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
