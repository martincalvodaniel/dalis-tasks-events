import { useState } from "react"
import { createRoot } from "react-dom/client"
import { TagDeletionIncidentResolutionDialog } from "@/features/sync/components/tag-delete-incident-resolution-dialog"
import { tagDeletionResolutionFixture } from "@/lib/backup/tag-delete-resolution-fixture"
import type { TagDeletionResolutionRequest } from "@/types/tag-delete-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error(
    "Deletion visual fixture requires its isolated loopback origin"
  )
const f = tagDeletionResolutionFixture("browser-test-deletion-visual")
const root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status) throw new Error("Deletion visual fixture markup missing")
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function TagDeletionReviewFixture() {
  const [choice, setChoice] =
      useState<TagDeletionResolutionRequest["choice"]>("retry_delete"),
    [open, setOpen] = useState(true)
  return open ? (
    <TagDeletionIncidentResolutionDialog
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
createRoot(root).render(<TagDeletionReviewFixture />)
