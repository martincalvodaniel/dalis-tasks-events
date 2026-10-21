import { useState } from "react"
import { createRoot } from "react-dom/client"
import { PlanOccurrenceCopyDialog } from "@/features/sync/components/plan-occurrence-copy-dialog"
import { planOccurrenceCopyFixture } from "@/lib/sync/plan-occurrence-copy-fixture"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error("Copy visual proof requires its owned loopback origin")
const f = planOccurrenceCopyFixture("note"),
  root = document.getElementById("root"),
  status = document.getElementById("status")
if (!root || !status || !f.snapshot.local)
  throw new Error("Copy visual proof markup missing")
f.snapshot.local.content = {
  title:
    "Preparar los documentos y revisar los acuerdos pendientes de la reunión semanal",
  description: "Contenido local que se conservará en la nueva copia.",
}
f.snapshot.local.checklist = [
  {
    id: crypto.randomUUID(),
    text: "Revisar los puntos acordados antes de enviar el documento",
    completed: true,
  },
]
f.request.expected = f.snapshot
status.textContent =
  "Vista previa con CSS del build; no guarda datos ni abre bases."
export function AppearanceCopyReviewFixture() {
  const [open, setOpen] = useState(true)
  return open ? (
    <PlanOccurrenceCopyDialog
      request={f.request}
      actor={f.userId}
      busy={false}
      onConfirm={async () => setOpen(false)}
      onClose={() => setOpen(false)}
    />
  ) : (
    <p>Revisión de prueba cerrada sin guardar datos.</p>
  )
}
createRoot(root).render(<AppearanceCopyReviewFixture />)
