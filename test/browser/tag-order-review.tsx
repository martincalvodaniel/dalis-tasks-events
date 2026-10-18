import { useState } from "react"
import { createRoot } from "react-dom/client"
import { TagOrderIncidentResolutionDialog } from "@/features/sync/components/tag-order-incident-resolution-dialog"
import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import type { TagOrderResolutionRequest } from "@/types/tag-order-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error("Order visual fixture requires its isolated loopback origin")
const f = tagOrderResolutionFixture("browser-test-order-visual")
const root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status) throw new Error("Order visual fixture markup missing")
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function TagOrderReviewFixture() {
  const [choice, setChoice] =
      useState<TagOrderResolutionRequest["choice"]>("retry_latest_move"),
    [open, setOpen] = useState(true)
  return open ? (
    <TagOrderIncidentResolutionDialog
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
createRoot(root).render(<TagOrderReviewFixture />)
