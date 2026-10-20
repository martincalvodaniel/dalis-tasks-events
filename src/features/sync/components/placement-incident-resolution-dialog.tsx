import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { MixedPlacementResolutionVersion } from "@/features/sync/components/mixed-placement-resolution-version"
import { PlacementResolutionVersion } from "@/features/sync/components/placement-resolution-version"
import { civilDateToUtc } from "@/lib/calendar/civil-date"
import {
  availableMixedPlacementResolutionChoices,
  previewMixedPlacementResolutionChoice,
} from "@/lib/sync/mixed-placement-decision"
import {
  availablePlacementResolutionChoices,
  previewPlacementResolutionChoice,
} from "@/lib/sync/placement-decision"
import {
  availableRecurringPlacementResolutionChoices,
  previewRecurringPlacementResolutionChoice,
} from "@/lib/sync/recurring-placement-decision"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeZone: "UTC",
})
export function PlacementIncidentResolutionDialog({
  snapshot,
  reviewKind,
  actor,
  choice,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  snapshot: PlacementResolutionSnapshot
  reviewKind?: "mixed_group" | "recurring_primary"
  actor: string
  choice: PlacementResolutionRequest["choice"]
  busy: boolean
  onSelect(choice: PlacementResolutionRequest["choice"]): void
  onConfirm(resolutionId: string): Promise<void>
  onClose(): void
}) {
  const grouped = reviewKind !== undefined
  const choices =
    reviewKind === "recurring_primary"
      ? availableRecurringPlacementResolutionChoices(snapshot, actor)
      : reviewKind === "mixed_group"
        ? availableMixedPlacementResolutionChoices(snapshot, actor)
        : availablePlacementResolutionChoices(snapshot, actor)
  if (!choices.includes(choice)) return null
  const command = snapshot.incident.entry.operation.command
  if (command.type !== "task.move") return null
  const adopt = choice === "adopt_remote",
    chosen =
      reviewKind === "recurring_primary"
        ? previewRecurringPlacementResolutionChoice(snapshot, actor, choice)
        : reviewKind === "mixed_group"
          ? previewMixedPlacementResolutionChoice(snapshot, actor, choice)
          : previewPlacementResolutionChoice(snapshot, actor, choice),
    tag = snapshot.observed.tags.find((tag) => tag.id === command.tagId)
  return (
    <ConfirmationDialog
      heading="Resolver orden de planes"
      confirmLabel={
        adopt ? "Usar orden remoto" : "Guardar movimiento para enviar"
      }
      pendingLabel="Guardando…"
      confirmTone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      failureMessage="No se pudo guardar la elección. Los planes o el orden pueden haber cambiado; cierra y vuelve a revisar."
    >
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {tag ? (
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
        ) : null}
        <span>
          {tag?.name ?? "Sin categoría"} ·{" "}
          {command.scope === "overdue" ? "Atrasadas; día de referencia" : "Día"}{" "}
          {dayFormatter.format(civilDateToUtc(command.date))}
        </span>
      </p>
      <fieldset disabled={busy} className="mt-3 space-y-1 text-sm">
        <legend className="font-medium">Cómo resolver el orden</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="placement-recovery-choice"
            checked={adopt}
            onChange={() => onSelect("adopt_remote")}
          />
          Usar orden remoto conocido
        </label>
        {choices.includes("retry_latest_move") ? (
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="placement-recovery-choice"
              checked={!adopt}
              onChange={() => onSelect("retry_latest_move")}
            />
            Reaplicar mi último movimiento
          </label>
        ) : null}
      </fieldset>
      {grouped ? (
        <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
          <MixedPlacementResolutionVersion
            reviewKind={reviewKind}
            label="Tu orden actual"
            snapshot={snapshot}
            placements={snapshot.local.placements}
          />
          <MixedPlacementResolutionVersion
            reviewKind={reviewKind}
            label={
              adopt ? "Orden que usarás" : "Orden que guardarás para enviar"
            }
            snapshot={snapshot}
            placements={chosen}
          />
        </div>
      ) : (
        <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
          <PlacementResolutionVersion
            label="Tu orden actual"
            snapshot={snapshot}
            placements={snapshot.local.placements}
          />
          <PlacementResolutionVersion
            label={
              adopt ? "Orden que usarás" : "Orden que guardarás para enviar"
            }
            snapshot={snapshot}
            placements={chosen}
          />
        </div>
      )}
      <div className="mt-2 space-y-2 text-xs">
        {grouped ? (
          <p>
            Este grupo incluye fechas de planes repetidos. Cada fecha conserva
            su contenido y su estado; sólo se revisa su posición.
          </p>
        ) : null}
        <p>
          Esta elección sustituye {snapshot.incident.intentions.length}{" "}
          movimientos pendientes. El historial se conserva. No cambia fechas,
          contenido ni categorías asignadas.
        </p>
        <p>
          {adopt
            ? "Se usará el orden remoto mostrado. No se enviará ningún movimiento."
            : "Se reaplicará sólo tu último movimiento con los vecinos revisados. Puede ajustar posiciones de otros planes de este grupo. Quedará pendiente de confirmación y puede aparecer otro conflicto."}
        </p>
        <p>
          Es la última versión conocida aquí; puede haber cambiado después. Los
          demás grupos se conservan.
        </p>
        <p className="text-zinc-500">Puedes cancelar para seguir revisando.</p>
      </div>
    </ConfirmationDialog>
  )
}
