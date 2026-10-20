import { useState } from "react"
import { createRoot } from "react-dom/client"
import { PlacementIncidentResolutionDialog } from "@/features/sync/components/placement-incident-resolution-dialog"
import { captureRecurringPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { recurringPlacementResolutionFixture } from "@/lib/sync/recurring-placement-resolution-fixture"
import type { PlacementResolutionRequest } from "@/types/placement-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error(
    "Recurring placement visual proof requires its owned loopback origin"
  )
const f = recurringPlacementResolutionFixture(),
  capture = structuredClone(f.capture)
for (const catalog of [capture.local, capture.observed]) {
  for (const item of catalog.items)
    if (item.id === f.series.id)
      item.title =
        "Preparar la documentación y revisar los acuerdos de la reunión semanal"
  for (const occurrence of catalog.occurrences)
    if (occurrence.id === f.moved.id)
      occurrence.content = {
        title:
          "Reunión reprogramada para revisar la propuesta y los documentos pendientes",
        description: "Versión conocida conservada",
      }
}
const snapshot = captureRecurringPlacementResolutionSnapshot(capture),
  root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status)
  throw new Error("Recurring placement visual markup missing")
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function RecurringPlacementReviewFixture() {
  const [choice, setChoice] =
      useState<PlacementResolutionRequest["choice"]>("retry_latest_move"),
    [open, setOpen] = useState(true)
  return open ? (
    <PlacementIncidentResolutionDialog
      snapshot={snapshot}
      actor={f.simple.actor}
      choice={choice}
      reviewKind="recurring_primary"
      busy={false}
      onSelect={setChoice}
      onConfirm={async () => setOpen(false)}
      onClose={() => setOpen(false)}
    />
  ) : (
    <p>Revisión de prueba cerrada sin guardar datos.</p>
  )
}
createRoot(root).render(<RecurringPlacementReviewFixture />)
