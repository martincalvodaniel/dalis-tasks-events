import { useState } from "react"
import { createRoot } from "react-dom/client"
import { PlacementIncidentResolutionDialog } from "@/features/sync/components/placement-incident-resolution-dialog"
import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import type { PlacementResolutionRequest } from "@/types/placement-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error(
    "Placement visual fixture requires its isolated loopback origin"
  )
const f = placementResolutionFixture("browser-test-placement-visual")
const root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status) throw new Error("Placement visual fixture markup missing")
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function PlacementReviewFixture() {
  const [choice, setChoice] =
      useState<PlacementResolutionRequest["choice"]>("retry_latest_move"),
    [open, setOpen] = useState(true)
  return open ? (
    <PlacementIncidentResolutionDialog
      snapshot={f.snapshot}
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
createRoot(root).render(<PlacementReviewFixture />)
