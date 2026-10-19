import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { TagOrderResolutionVersion } from "@/features/sync/components/tag-order-resolution-version"
import {
  availableTagDeletionResolutionChoices,
  previewTagDeletionResolutionChoice,
} from "@/lib/sync/tag-delete-decision"
import type {
  TagDeletionResolutionRequest,
  TagDeletionResolutionSnapshot,
} from "@/types/tag-delete-resolution"

export function TagDeletionIncidentResolutionDialog({
  snapshot,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: TagDeletionResolutionSnapshot
  actor: string
  choice: TagDeletionResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: TagDeletionResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const choices = availableTagDeletionResolutionChoices(snapshot, actor)
  if (!choices.includes(choice)) return null
  const command = snapshot.incident.entry.operation.command,
    primaryId = command.type === "tag.delete" ? command.tagId : "",
    adopt = choice === "adopt_remote",
    chosen = previewTagDeletionResolutionChoice(snapshot, actor, choice),
    restored = adopt && !chosen.find((tag) => tag.id === primaryId)?.deletedAt
  return (
    <ConfirmationDialog
      heading="Resolver eliminación de categoría"
      confirmLabel={
        adopt ? "Usar categoría remota" : "Guardar eliminación para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone={adopt ? "primary" : "danger"}
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. La categoría o los cambios pendientes pueden haber cambiado; cierra y vuelve a revisar."
    >
      <fieldset disabled={busy} className="mt-3 space-y-1 text-sm">
        <legend className="font-medium">Cómo resolver la eliminación</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="tag-delete-recovery-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar categoría remota conocida
        </label>
        {choices.includes("retry_delete") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="tag-delete-recovery-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_delete")}
            />
            Volver a solicitar la eliminación
          </label>
        ) : null}
      </fieldset>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
        <TagOrderResolutionVersion
          label="Tu catálogo actual"
          tags={snapshot.localTags}
          primaryId={primaryId}
        />
        <TagOrderResolutionVersion
          label={
            adopt ? "Catálogo que usarás" : "Catálogo que guardarás para enviar"
          }
          tags={chosen}
          primaryId={primaryId}
        />
      </div>
      <div className="mt-2 space-y-2 text-xs">
        <p>
          Esta elección sustituye tu borrado pendiente. El historial se
          conserva. No modifica planes ni sus asignaciones.
        </p>
        <p>
          Se usarán los nombres, colores y eliminaciones del catálogo remoto
          mostrado. Es la última versión conocida aquí; puede haber cambiado
          después.
        </p>
        <p>
          {adopt
            ? restored
              ? "La categoría volverá a estar visible y sus planes asignados volverán a agruparse bajo ella. No se enviará ningún cambio."
              : "La categoría seguirá eliminada. Sus asignaciones se conservan, aunque no se muestre la categoría. No se enviará ningún cambio."
            : "La categoría quedará eliminada aquí y se enviará una nueva solicitud. Las asignaciones se conservan. Quedará pendiente de confirmación y puede aparecer otro conflicto."}
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
