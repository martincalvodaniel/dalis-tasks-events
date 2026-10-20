import { useState } from "react"
import { createRoot } from "react-dom/client"
import { PlanOccurrenceCohortResolutionDialog } from "@/features/sync/components/plan-occurrence-cohort-resolution-dialog"
import { capturePlanOccurrenceCohortComparison } from "@/lib/sync/plan-occurrence-cohort-comparison"
import { planOccurrenceCohortFixture } from "@/lib/sync/plan-occurrence-cohort-fixture"
import type { PlanOccurrenceCohortResolutionRequest } from "@/types/plan-occurrence-cohort-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error(
    "Joint appearance visual proof requires its own loopback origin"
  )
const raw = planOccurrenceCohortFixture("browser-test-joint-visual")
raw.occurrences[0] = {
  ...raw.occurrences[0],
  content: {
    title: "Revisar propuesta y preparar documentación de la reunión",
    description:
      "Borrador local que conserva contenido, fecha, estado y pasos.",
  },
  checklist: [
    {
      id: crypto.randomUUID(),
      text: "Adjuntar los documentos revisados",
      completed: true,
    },
  ],
}
const snapshot = capturePlanOccurrenceCohortComparison(raw)
const root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status) throw new Error("Joint visual proof markup missing")
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function AppearanceCohortReviewFixture() {
  const [choice, setChoice] =
      useState<PlanOccurrenceCohortResolutionRequest["choice"]>("retry_local"),
    [open, setOpen] = useState(true)
  return open ? (
    <PlanOccurrenceCohortResolutionDialog
      snapshot={snapshot}
      actor={raw.userId}
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
createRoot(root).render(<AppearanceCohortReviewFixture />)
