import { useState } from "react"
import { createRoot } from "react-dom/client"
import { CategoryPlacementIncidentResolutionDialog } from "@/features/sync/components/category-placement-resolution-dialog"
import { categoryPlacementResolutionFixture } from "@/lib/sync/category-placement-resolution-fixture"
import { captureCategoryPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import type { PlacementResolutionRequest } from "@/types/placement-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error(
    "Category movement visual proof requires its owned loopback origin"
  )
const f = categoryPlacementResolutionFixture("moved"),
  capture = structuredClone(f.capture)
for (const catalog of [capture.local, capture.observed]) {
  for (const item of catalog.items)
    if (item.id === f.parentId)
      item.title =
        "Preparar la documentación y revisar los acuerdos de la reunión semanal"
  for (const occurrence of catalog.occurrences)
    if (occurrence.id === f.f.moved.id)
      occurrence.content = {
        title:
          "Reunión reprogramada para revisar la propuesta y los documentos pendientes",
        description: "Versión conocida conservada",
      }
}
const snapshot = captureCategoryPlacementResolutionSnapshot(capture),
  root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status) throw new Error("Category movement visual markup missing")
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function CategoryPlacementReviewFixture() {
  const [choice, setChoice] =
      useState<PlacementResolutionRequest["choice"]>("retry_latest_move"),
    [open, setOpen] = useState(true)
  return open ? (
    <CategoryPlacementIncidentResolutionDialog
      snapshot={snapshot}
      actor={f.actor}
      choice={choice}
      busy={false}
      onSelect={setChoice}
      onConfirm={async () => setOpen(false)}
      onClose={() => setOpen(false)}
    />
  ) : (
    <p>Revisión de prueba cerrada sin guardar datos.</p>
  )
}
createRoot(root).render(<CategoryPlacementReviewFixture />)
