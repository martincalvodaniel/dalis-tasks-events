import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanForm } from "@/features/plans/components/plan-form"
import type { PlanDraft } from "@/types/plan-item"

const initial: PlanDraft = {
  kind: "plan",
  variant: "note",
  title: "Shared content",
  description: "Retained description",
  status: "in_progress",
  schedule: {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-12",
  },
  checklist: [{ id: "step-one", text: "Retained step", completed: true }],
  recurrence: null,
}

test("prepared common editor names icon actions and exposes identical options in every variant", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const html = renderToStaticMarkup(
      <PlanForm
        scheduledDate="2026-10-10"
        timeZone="Europe/Madrid"
        initialPlan={{ ...initial, variant }}
        initialTagId="blue"
        tags={[{ id: "blue", name: "Personal", color: "#123abc" }]}
        onSave={async () => undefined}
        onCancel={() => undefined}
      />
    )
    for (const text of [
      "Tarea",
      "Evento",
      "Cita",
      "Nota",
      "Todo el día",
      "Categoría",
      "Checklist",
      "Estado",
      "Repetir",
    ])
      expect(html).toContain(text)
    expect(html).toContain('aria-label="Cancelar"')
    expect(html).toContain('aria-label="Guardar"')
    expect(html).toContain(`name="variant" value="${variant}"`)
    expect(html).toContain("background-color:#123abc")
    expect(html).toContain("Retained description")
    expect(html).toContain("Retained step")
    expect(html).toContain('value="2026-10-11"')
    expect(html).not.toContain('type="datetime-local"')
    expect(html).not.toContain('name="startDate"')
    expect(html).not.toContain('name="lastDate"')
    expect(html.match(/<input[^>]*name="localStartDate"/g)?.length).toBe(1)
    expect(html.match(/<input[^>]*name="localEndDate"/g)?.length).toBe(1)
    expect(html.match(/<input[^>]*name="localStartTime"[^>]*>/)?.[0]).toContain(
      'hidden=""'
    )
    expect(html.match(/<input[^>]*name="localEndTime"[^>]*>/)?.[0]).toContain(
      'hidden=""'
    )
    for (const name of [
      "localStartDate",
      "localStartTime",
      "localEndDate",
      "localEndTime",
    ])
      expect(html).toContain(`name="${name}"`)
  }
})
