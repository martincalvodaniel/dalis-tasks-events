import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import { SyncIncidentVersion } from "@/features/sync/components/sync-incident-version"
import { availableReviewedPlanCategoryResolutionChoices } from "@/lib/sync/plan-category-resolution"
import type {
  PlanCategoryResolutionRequest,
  PlanCategoryResolutionSnapshot,
} from "@/types/plan-category-resolution"

export function PlanCategoryIncidentResolutionDialog({
  snapshot,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: PlanCategoryResolutionSnapshot
  actor: string
  choice: PlanCategoryResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: PlanCategoryResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const choices = availableReviewedPlanCategoryResolutionChoices(
    snapshot,
    actor
  )
  if (!choices.includes(choice)) return null
  const adopt = choice === "adopt_remote",
    view = adopt ? snapshot.remoteView : snapshot.localView
  const knownTag =
    snapshot.localTag?.id === view.primaryTagId ? snapshot.localTag : null
  const count =
    snapshot.incident.intentions.length + snapshot.viewIntentions.length
  return (
    <ConfirmationDialog
      heading="Resolver plan y categoría"
      confirmLabel={adopt ? "Usar ambos remotos" : "Guardar ambos para enviar"}
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Si el plan, la categoría o sus cambios pendientes han cambiado, cierra y vuelve a revisar."
    >
      <fieldset disabled={busy} className="mt-3 space-y-1 text-sm">
        <legend className="font-medium">Qué quieres conservar</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="joint-recovery-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar plan y categoría remotos
        </label>
        {choices.includes("retry_local") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="joint-recovery-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_local")}
            />
            Enviar mi plan y categoría
          </label>
        ) : null}
      </fieldset>
      <div className="mt-2 space-y-2 text-sm">
        <SyncIncidentVersion
          label={adopt ? "Plan que usarás" : "Plan que enviarás"}
          item={adopt ? snapshot.incident.remote : snapshot.incident.local}
        />
        <PersonalIncidentVersion
          label="Categoría que usarás"
          snapshot={[
            {
              entityKey: `item-view:${view.itemId}`,
              record: { store: "itemViews", record: view },
            },
            ...(knownTag
              ? [
                  {
                    entityKey: `tag:${knownTag.id}`,
                    record: { store: "tags" as const, record: knownTag },
                  },
                ]
              : []),
          ]}
          tagNames={knownTag ? { [knownTag.id]: knownTag.name } : {}}
        />
        <p>
          Esta elección sustituye {count} cambios pendientes de contenido y
          categoría de este plan. El historial se conserva.
        </p>
        <p>
          {adopt
            ? "Tu borrador y su asignación dejarán de mostrarse. Las versiones remotas son las últimas conocidas aquí y pueden haber cambiado después."
            : "Se enviará tu plan completo, incluidos fecha, estado y pasos, junto con su categoría. Quedarán pendientes de confirmación y puede aparecer otro conflicto."}
        </p>
        {!adopt ? (
          <p>
            El envío avanza por pasos: otro dispositivo puede mostrar primero el
            contenido y después su categoría. No cambia el nombre, color ni
            orden de las categorías.
          </p>
        ) : null}
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
