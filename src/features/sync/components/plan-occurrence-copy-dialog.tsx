import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PlanOccurrenceIncidentVersion } from "@/features/sync/components/plan-occurrence-incident-version"
import { SyncIncidentVersion } from "@/features/sync/components/sync-incident-version"
import { planOccurrenceCopy } from "@/lib/sync/plan-occurrence-copy"
import type {
  PlanOccurrenceCopyRecord,
  PlanOccurrenceCopyRequest,
} from "@/types/plan-occurrence-copy"

export function PlanOccurrenceCopyDialog({
  request,
  actor,
  busy,
  onConfirm,
  onClose,
}: {
  request: PlanOccurrenceCopyRequest
  actor: string
  busy: boolean
  onConfirm(): Promise<void>
  onClose(): void
}) {
  let record: PlanOccurrenceCopyRecord
  try {
    if (request.userId !== actor) return null
    record = planOccurrenceCopy(request, request.expected)
  } catch {
    return null
  }
  const command = record.replacement.command
  if (command.type !== "item.create") return null
  return (
    <ConfirmationDialog
      heading="¿Crear una copia de este día?"
      confirmLabel="Crear copia"
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la copia. Si el plan o sus cambios han cambiado, cierra y vuelve a revisar."
    >
      <div className="mt-3 space-y-2 text-sm">
        <p>Fecha original: {record.local.slotKey.replace("T", " ")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SyncIncidentVersion
            label="Plan nuevo que crearás"
            item={command.input}
          />
          <PlanOccurrenceIncidentVersion
            label="Original que conservarás"
            occurrence={record.local}
            series={request.expected.series}
          />
        </div>
        <p>
          Se copiará sólo este día como un plan independiente, sin repetición,
          categoría ni orden manual. La serie y su aparición cancelada o
          eliminada seguirán igual.
        </p>
        <p>
          Esta elección sustituye {record.supersededOperationIds.length} cambios
          de esta aparición. El historial se conserva; no se copian otros días.
        </p>
        <p>
          La copia quedará pendiente de confirmación cuando haya conexión y
          puede aparecer otro conflicto.
        </p>
        <p className="text-xs text-zinc-500">
          El remoto mostrado es la última versión conocida aquí y puede haber
          cambiado después. Puedes cancelar para seguir revisando.
        </p>
      </div>
    </ConfirmationDialog>
  )
}
