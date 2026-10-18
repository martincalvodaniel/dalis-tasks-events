import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import { SyncIncidentVersion } from "@/features/sync/components/sync-incident-version"
import { availableItemViewResolutionChoices } from "@/lib/sync/item-view-resolution"
import type {
  ItemViewResolutionRequest,
  ItemViewResolutionSnapshot,
} from "@/types/item-view-resolution"

export function ItemViewIncidentResolutionDialog({
  snapshot,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: ItemViewResolutionSnapshot
  actor: string
  choice: ItemViewResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: ItemViewResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const choices = availableItemViewResolutionChoices(snapshot, actor)
  if (!choices.includes(choice)) return null
  const adopt = choice === "adopt_remote",
    chosen = adopt ? snapshot.incident.remote : snapshot.incident.local
  const view = chosen[0]?.record,
    knownTag =
      view?.store === "itemViews" &&
      snapshot.localTag?.id === view.record.primaryTagId
        ? snapshot.localTag
        : null
  return (
    <ConfirmationDialog
      heading="Resolver categoría del plan"
      confirmLabel={
        adopt ? "Usar asignación remota" : "Guardar asignación para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Si el plan o su categoría han cambiado, cierra y vuelve a revisar."
    >
      <fieldset disabled={busy} className="mt-3 space-y-1 text-sm">
        <legend className="font-medium">Qué quieres conservar</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="assignment-recovery-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar asignación remota
        </label>
        {choices.includes("retry_local") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="assignment-recovery-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_local")}
            />
            Enviar mi asignación
          </label>
        ) : null}
      </fieldset>
      <div className="mt-2 space-y-2 text-sm">
        <SyncIncidentVersion
          label="Plan que conserva su contenido"
          item={snapshot.parent}
        />
        <PersonalIncidentVersion
          label="Categoría que usarás"
          snapshot={[
            ...chosen,
            ...(knownTag
              ? [
                  {
                    entityKey: `tag:${knownTag.id}`,
                    record: { store: "tags" as const, record: knownTag },
                  },
                ]
              : []),
          ]}
          tagNames={{
            ...snapshot.incident.tagNames,
            ...(knownTag ? { [knownTag.id]: knownTag.name } : {}),
          }}
        />
        <p>
          Esta elección sustituye {snapshot.incident.intentions.length} cambios
          pendientes de asignación. El historial se conserva. No cambia el
          contenido del plan, el nombre o color de las categorías ni su orden.
        </p>
        <p>
          {adopt
            ? "La asignación remota es la última conocida aquí y puede haber cambiado después. Tu selección local dejará de mostrarse."
            : "Se guardará tu categoría elegida para enviarla. Quedará pendiente de confirmación y puede aparecer otro conflicto."}
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
