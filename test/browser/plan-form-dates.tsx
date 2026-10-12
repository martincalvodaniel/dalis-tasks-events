import { useState } from "react"
import { createRoot } from "react-dom/client"
import { PlanForm } from "@/features/plans/components/plan-form"
import type { PlanDraft } from "@/types/plan-item"

if (location.hostname !== "127.0.0.1" || location.port !== "4266")
  throw new Error("Plan date UI proof requires its isolated loopback origin")
const timed = new URLSearchParams(location.search).get("mode") === "timed"
const initialPlan: PlanDraft = {
  kind: "plan",
  variant: "task",
  title: "Plan de prueba",
  description: "",
  checklist: [],
  status: "not_started",
  schedule: timed
    ? {
        mode: "timed",
        localStart: "2026-10-12T22:15",
        localEnd: "2026-10-14T08:45",
        timeZone: "Europe/Madrid",
      }
    : {
        mode: "all_day",
        startDate: "2026-10-12",
        endDateExclusive: "2026-10-15",
      },
  recurrence: null,
}
export function PlanDateFixture() {
  const [saved, setSaved] = useState<PlanDraft | null>(null)
  return (
    <main className="mx-auto max-w-sm">
      <PlanForm
        scheduledDate="2026-10-12"
        timeZone="Europe/Madrid"
        initialPlan={
          new URLSearchParams(location.search).has("create")
            ? undefined
            : initialPlan
        }
        tags={[]}
        onCancel={() => setSaved(null)}
        onSave={async ({ input }) => {
          setSaved(input)
        }}
      />
      <pre role="status" className="mt-3 whitespace-pre-wrap break-all text-xs">
        {saved
          ? JSON.stringify(saved, null, 2)
          : "Prueba aislada; no guarda datos en ninguna base."}
      </pre>
    </main>
  )
}
const root = document.getElementById("root")
if (!root) throw new Error("Plan date fixture root is missing")
createRoot(root).render(<PlanDateFixture />)
