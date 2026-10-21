import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { CategoryPlacementResolutionVersion } from "@/features/sync/components/category-placement-resolution-version"
import { civilDateToUtc } from "@/lib/calendar/civil-date"
import {
  availableCategoryPlacementResolutionChoices,
  previewCategoryPlacementResolutionChoice,
} from "@/lib/sync/category-placement-decision"
import { reviewCategoryPlacementGroups } from "@/lib/sync/category-placement-review"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeZone: "UTC",
})
export function CategoryPlacementIncidentResolutionDialog({
  snapshot,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: PlacementResolutionSnapshot
  actor: string
  choice: PlacementResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: PlacementResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const choices = availableCategoryPlacementResolutionChoices(snapshot, actor)
  if (!choices.includes(choice)) return null
  const chosen = previewCategoryPlacementResolutionChoice(
      snapshot,
      actor,
      choice
    ),
    review = reviewCategoryPlacementGroups({
      userId: actor,
      operation: snapshot.incident.entry.operation,
      local: snapshot.local,
      observed: snapshot.observed,
    }),
    adopt = choice === "adopt_remote",
    catalog = {
      ...snapshot.observed,
      views: snapshot.observed.views.map((view) =>
        view.itemId === chosen.view.itemId ? chosen.view : view
      ),
      placements: chosen.placements,
    }
  return (
    <ConfirmationDialog
      heading="Resolver categoría y orden"
      confirmLabel={
        adopt
          ? "Usar categoría y orden remotos"
          : "Guardar movimiento para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. La categoría o el orden pueden haber cambiado; cierra y vuelve a revisar."
    >
      <p className="mt-2 text-xs">
        {review.scope === "overdue" ? "Atrasadas; día de referencia" : "Día"}{" "}
        {dayFormatter.format(civilDateToUtc(review.declaredDate))}
      </p>
      <fieldset disabled={busy} className="mt-3 space-y-1 text-sm">
        <legend className="font-medium">Cómo resolver el movimiento</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="category-placement-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar categoría y orden remotos conocidos
        </label>
        {choices.includes("retry_latest_move") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="category-placement-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_latest_move")}
            />
            Reaplicar mi último movimiento
          </label>
        ) : null}
      </fieldset>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CategoryPlacementResolutionVersion
          label="Tu estado actual"
          snapshot={snapshot}
          review={review}
          catalog={snapshot.local}
        />
        <CategoryPlacementResolutionVersion
          label={
            adopt ? "Estado que usarás" : "Estado que guardarás para enviar"
          }
          snapshot={snapshot}
          review={review}
          catalog={catalog}
        />
      </div>
      <p className="mt-3 text-sm font-medium">
        La categoría pertenece a todo el plan y cambia en todas sus fechas.
      </p>
      <p className="mt-1 text-xs">
        Las posiciones manuales de otras fechas se conservan. No cambia el
        contenido, el estado ni la repetición del plan.
      </p>
      <p className="mt-2 text-xs">
        Esta elección sustituye {snapshot.incident.intentions.length}{" "}
        movimientos pendientes. El historial se conserva.
      </p>
      <p className="mt-2 text-xs">
        {adopt
          ? "Se usará la categoría y el orden mostrados. No se enviará ningún movimiento."
          : "Se reaplicará sólo tu último movimiento con los vecinos revisados. Puede ajustar posiciones de este grupo; quedará pendiente de confirmación y puede aparecer otro conflicto."}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Es la última versión conocida aquí; puede haber cambiado después. Puedes
        cancelar para seguir revisando.
      </p>
    </ConfirmationDialog>
  )
}
