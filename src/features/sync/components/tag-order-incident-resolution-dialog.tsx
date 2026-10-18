import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { TagOrderResolutionVersion } from "@/features/sync/components/tag-order-resolution-version"
import {
  availableTagOrderResolutionChoices,
  previewTagOrderResolutionChoice,
} from "@/lib/sync/tag-order-decision"
import type {
  TagOrderResolutionRequest,
  TagOrderResolutionSnapshot,
} from "@/types/tag-order-resolution"

export function TagOrderIncidentResolutionDialog({
  snapshot,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: TagOrderResolutionSnapshot
  actor: string
  choice: TagOrderResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: TagOrderResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const choices = availableTagOrderResolutionChoices(snapshot, actor)
  if (!choices.includes(choice)) return null
  const primaryId =
      snapshot.incident.entry.operation.command.type === "tag.move"
        ? snapshot.incident.entry.operation.command.tagId
        : "",
    adopt = choice === "adopt_remote",
    chosen = previewTagOrderResolutionChoice(snapshot, actor, choice)
  return (
    <ConfirmationDialog
      heading="Resolver orden de categorías"
      confirmLabel={
        adopt ? "Usar orden remoto" : "Guardar movimiento para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. El catálogo o los cambios pendientes pueden haber cambiado; cierra y vuelve a revisar."
    >
      <fieldset disabled={busy} className="mt-3 space-y-1 text-sm">
        <legend className="font-medium">Cómo resolver el orden</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="tag-order-recovery-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar orden remoto conocido
        </label>
        {choices.includes("retry_latest_move") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="tag-order-recovery-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_latest_move")}
            />
            Reaplicar mi último movimiento
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
            adopt ? "Catálogo que usarás" : "Orden que guardarás para enviar"
          }
          tags={chosen}
          primaryId={primaryId}
        />
      </div>
      <div className="mt-2 space-y-2 text-xs">
        <p>
          Esta elección sustituye {snapshot.incident.intentions.length}{" "}
          movimientos pendientes de la categoría en revisión. El historial se
          conserva. No cambia planes, asignaciones ni su orden.
        </p>
        <p>
          Se usarán los nombres, colores y eliminaciones del catálogo remoto
          mostrado. Es la última versión conocida aquí; puede haber cambiado
          después.
        </p>
        <p>
          {adopt
            ? "Tu orden local dejará de mostrarse. No se enviará ningún movimiento."
            : "Se reaplicará sólo tu último movimiento sobre ese catálogo, con los vecinos revisados. No se enviará todo tu orden local. Quedará pendiente de confirmación y puede aparecer otro conflicto."}
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
