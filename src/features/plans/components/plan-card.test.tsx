import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanCard } from "@/features/plans/components/plan-card"
import { applyPlanCommand } from "@/lib/calendar/plan-command"

function plan(variant: "task" | "event" | "appointment" | "note") {
  return applyPlanCommand(
    null,
    {
      type: "item.create",
      itemId: "00000000-0000-4000-8000-000000000001",
      input: {
        kind: "plan",
        variant,
        title: "Common plan",
        description: "Details",
        schedule: {
          mode: "timed",
          localStart: "2026-10-10T14:30",
          localEnd: null,
          timeZone: "Europe/Madrid",
        },
        status: "not_started",
        checklist: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            text: "Visible step",
            completed: false,
          },
        ],
        recurrence: null,
      },
    },
    "owner",
    "2026-10-10T09:00:00.000Z"
  )
}

test("all variants render category-colored completion shapes and visible checklist outside details", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const html = renderToStaticMarkup(
      <PlanCard
        plan={plan(variant)}
        categoryColor="#123abc"
        onStatusChange={() => undefined}
        onChecklistChange={() => undefined}
      />
    )
    expect(html).toContain('aria-label="Completar Common plan"')
    expect(html).toContain('stroke="#123abc"')
    expect(html).toContain("14:30")
    expect(html).toContain('aria-pressed="false"')
    const completed = renderToStaticMarkup(
      <PlanCard
        plan={{
          ...plan(variant),
          status: "completed",
          completedAt: "2026-10-10T09:30:00.000Z",
        }}
        categoryColor="#123abc"
        onStatusChange={() => undefined}
      />
    )
    expect(completed).toContain('aria-pressed="true"')
    expect(completed).toContain('aria-label="Reabrir Common plan"')
    expect(completed).toContain('stroke="#123abc"')
    expect(html.indexOf("Visible step")).toBeGreaterThan(
      html.indexOf("</details>")
    )
    expect(html).not.toContain("Subir")
    expect(html).not.toContain("Bajar")
  }
})

test("recurring parents show an explicit limitation and disable per-occurrence progress", () => {
  const parent = {
    ...plan("note"),
    recurrence: {
      frequency: "daily" as const,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      interval: 1,
      end: { type: "never" as const },
    },
  }
  const html = renderToStaticMarkup(
    <PlanCard
      plan={parent}
      onStatusChange={() => undefined}
      onChecklistChange={() => undefined}
    />
  )
  expect(html).toContain(
    "Sus apariciones y progreso todavía no están disponibles aquí."
  )
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Completar/)
  expect(html).not.toContain('type="checkbox"')
  expect(html).not.toContain('aria-label="Empezar')
})
