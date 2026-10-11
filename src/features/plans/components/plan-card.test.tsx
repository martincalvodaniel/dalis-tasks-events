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
    expect(html).toContain('aria-label="Empezar Common plan; Sin empezar"')
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
    expect(completed).toContain('aria-label="Reabrir Common plan; Completado"')
    expect(completed).toContain('stroke="#123abc"')
    expect(html.indexOf("Visible step")).toBeGreaterThan(
      html.indexOf("</details>")
    )
    expect(html).not.toContain("Subir")
    expect(html).not.toContain("Bajar")
  }
})

test("recurring parents point to appearance progress and disable per-occurrence progress", () => {
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
    "Gestiona el progreso de cada aparición en el calendario."
  )
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Empezar/)
  expect(html).not.toContain('type="checkbox"')
  expect(html).not.toContain('aria-label="Empezar Common plan"')
})

test("plan progress is a mixed accessible state and readonly or busy rows cannot change it", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const current = { ...plan(variant), status: "in_progress" as const }
    const html = renderToStaticMarkup(
      <PlanCard
        plan={current}
        categoryColor="#123abc"
        onStatusChange={() => undefined}
      />
    )
    expect(html).toContain('aria-pressed="mixed"')
    expect(html).toContain('aria-label="Completar Common plan; En progreso"')
    expect(html).toContain(
      variant === "appointment" ? 'd="M8 15h8"' : 'd="M8 12h8"'
    )
    expect(html).toContain("size-11")
    for (const props of [{ busy: true, onStatusChange: () => undefined }, {}]) {
      const disabled = renderToStaticMarkup(
        <PlanCard plan={current} {...props} />
      )
      expect(disabled).toMatch(
        /<button[^>]*aria-pressed="mixed"[^>]*disabled=""/
      )
    }
  }
})

test("checklist steps inherit the parent shape and color while keeping independent native state", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const parent = plan(variant)
    parent.checklist.push({
      id: crypto.randomUUID(),
      text: "Finished step",
      completed: true,
    })
    const html = renderToStaticMarkup(
      <PlanCard
        plan={parent}
        categoryColor="#123abc"
        busy
        onChecklistChange={() => undefined}
      />
    )
    const checklist = html.slice(html.indexOf('<ul aria-label="Checklist"'))
    expect((checklist.match(/stroke="#123abc"/g) ?? []).length).toBe(2)
    expect((checklist.match(/type="checkbox"/g) ?? []).length).toBe(2)
    expect((checklist.match(/checked=""/g) ?? []).length).toBe(1)
    expect((checklist.match(/disabled=""/g) ?? []).length).toBe(2)
    expect(checklist).toContain('aria-label="Completar paso: Visible step"')
    if (variant === "event")
      expect((checklist.match(/<circle/g) ?? []).length).toBe(2)
    if (variant === "note")
      expect((checklist.match(/M5 3h10l4 4v14H5z/g) ?? []).length).toBe(2)
    if (variant === "appointment")
      expect((checklist.match(/M3 9h18M7 3v4M17 3v4/g) ?? []).length).toBe(2)
    const readonly = renderToStaticMarkup(
      <PlanCard plan={parent} categoryColor="#123abc" />
    )
    expect(
      readonly.slice(readonly.indexOf('<ul aria-label="Checklist"'))
    ).not.toContain('type="checkbox"')
    expect(readonly).toContain('stroke="#123abc"')
  }
})
