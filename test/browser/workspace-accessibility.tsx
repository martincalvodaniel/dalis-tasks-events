import { StrictMode, useEffect, useId, useState } from "react"
import { createRoot } from "react-dom/client"
import { WorkspaceNavigation } from "@/components/shared/workspace-navigation"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { WorkspaceHeading } from "@/features/workspace/components/workspace-heading"
import { useWorkspaceView } from "@/features/workspace/hooks/use-workspace-view"
import { handleWorkspaceNavigation } from "@/features/workspace/navigation"

if (location.hostname !== "127.0.0.1" || location.port !== "4277")
  throw new Error("Accessibility proof requires its isolated loopback origin")

export function WorkspaceAccessibilityProof() {
  const contentId = useId()
  const view = useWorkspaceView()
  const date = useCalendarDate() ?? "2026-10-21"
  const [mountId] = useState(() => crypto.randomUUID())
  const [dialogOpen, setDialogOpen] = useState(false)
  useEffect(() => {
    document.addEventListener("click", handleWorkspaceNavigation)
    return () =>
      document.removeEventListener("click", handleWorkspaceNavigation)
  }, [])
  return (
    <div data-proof-mount={mountId}>
      <a
        href={`#${contentId}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:z-50 bg-white p-3 text-emerald-800"
      >
        Saltar al contenido
      </a>
      <WorkspaceNavigation activeView={view} />
      <main
        id={contentId}
        tabIndex={-1}
        className="mx-auto max-w-3xl p-3 pb-40"
      >
        <WorkspaceHeading view={view} />
        {view === "calendar" ? (
          <MonthGrid
            selectedDate={date}
            today="2026-10-21"
            counts={new Map([["2026-10-21", 2]])}
          />
        ) : null}
        <label className="block py-2">
          Texto de prueba
          <input name="proof" className="block w-full min-w-0 border p-2" />
        </label>
        <button
          type="button"
          className="min-h-11 rounded-lg border px-3"
          onClick={() => setDialogOpen(true)}
        >
          Abrir confirmación
        </button>
        <label className="ml-3">
          Apariencia de prueba
          <select
            className="border p-2"
            onChange={(event) => {
              document.documentElement.dataset.theme = event.target.value
            }}
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <button
          type="button"
          className="block min-h-11 border px-3"
          onClick={() => {
            document.documentElement.style.fontSize = "32px"
          }}
        >
          Ampliar texto al 200 %
        </button>
        {dialogOpen ? (
          <ConfirmationDialog
            heading="Confirmación de prueba"
            confirmLabel="Confirmar"
            pendingLabel="Confirmando…"
            failureMessage="No se pudo confirmar."
            busy={false}
            onClose={() => setDialogOpen(false)}
            onConfirm={async () => setDialogOpen(false)}
          >
            <p>Prueba aislada de foco y teclado. No escribe datos.</p>
          </ConfirmationDialog>
        ) : null}
      </main>
    </div>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Accessibility proof root is missing")
createRoot(root).render(
  <StrictMode>
    <WorkspaceAccessibilityProof />
  </StrictMode>
)
