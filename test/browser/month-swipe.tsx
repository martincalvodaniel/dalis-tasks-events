import { createRoot } from "react-dom/client"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import { calendarDateFromSearch } from "@/features/calendar/month-view"

if (location.hostname !== "127.0.0.1" || location.port !== "4255")
  throw new Error("Month swipe proof requires its isolated loopback origin")
const root = document.getElementById("root")
if (!root) throw new Error("Month swipe proof root is missing")
createRoot(root).render(
  <MonthGrid
    selectedDate={calendarDateFromSearch(location.search) ?? "2026-10-11"}
    today="2026-10-11"
    counts={new Map()}
  />
)
