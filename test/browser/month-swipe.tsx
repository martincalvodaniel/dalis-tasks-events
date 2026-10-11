import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { useWorkspaceView } from "@/features/workspace/hooks/use-workspace-view"
import { handleWorkspaceNavigation } from "@/features/workspace/navigation"

if (location.hostname !== "127.0.0.1" || location.port !== "4255")
  throw new Error("Month swipe proof requires its isolated loopback origin")
const root = document.getElementById("root")
if (!root) throw new Error("Month swipe proof root is missing")
export function MonthSwipeProof() {
  const date = useCalendarDate() ?? "2026-10-11"
  const view = useWorkspaceView()
  const [mountId] = useState(() => crypto.randomUUID())
  useEffect(() => {
    document.addEventListener("click", handleWorkspaceNavigation)
    return () =>
      document.removeEventListener("click", handleWorkspaceNavigation)
  }, [])
  return (
    <>
      <p data-proof-mount={mountId}>{view}</p>
      <nav aria-label="Prueba de navegación">
        <a href="/workspace?view=calendar">Calendario</a>{" "}
        <a href="/workspace?view=tags">Categorías</a>{" "}
        <a href="/workspace?view=settings">Ajustes</a>
      </nav>
      <MonthGrid selectedDate={date} today="2026-10-11" counts={new Map()} />
    </>
  )
}
createRoot(root).render(<MonthSwipeProof />)
