import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanOccurrenceCohortResolutionDialog } from "@/features/sync/components/plan-occurrence-cohort-resolution-dialog"
import { PlanOccurrenceIncidentCard } from "@/features/sync/components/plan-occurrence-incident-card"
import { capturePlanOccurrenceCohortComparison } from "@/lib/sync/plan-occurrence-cohort-comparison"
import { planOccurrenceCohortFixture } from "@/lib/sync/plan-occurrence-cohort-fixture"
import { availablePlanOccurrenceCohortResolutionChoices } from "@/lib/sync/plan-occurrence-cohort-resolution"
import { canReviewPlanOccurrenceCohort } from "@/lib/sync/plan-occurrence-cohort-review"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import type { PlanOccurrenceCohortComparison } from "@/types/plan-occurrence-cohort-comparison"

function render(
  snapshot: PlanOccurrenceCohortComparison,
  choice: "adopt_remote" | "retry_local" = "adopt_remote",
  actor = snapshot.source.userId,
  busy = false
) {
  return renderToStaticMarkup(
    <PlanOccurrenceCohortResolutionDialog
      snapshot={snapshot}
      actor={actor}
      choice={choice}
      busy={busy}
      onSelect={() => {}}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
}

test("reviewed multi-slot choices validate the entire snapshot and account", () => {
  const snapshot = capturePlanOccurrenceCohortComparison(
    planOccurrenceCohortFixture()
  )
  expect(
    availablePlanOccurrenceCohortResolutionChoices(
      snapshot,
      snapshot.source.userId
    )
  ).toEqual(["adopt_remote", "retry_local"])
  expect(
    availablePlanOccurrenceCohortResolutionChoices(snapshot, "foreign")
  ).toEqual([])
  for (const changed of [
    {},
    { ...snapshot, operationIds: snapshot.operationIds.slice(1) },
    { ...snapshot, slots: snapshot.slots.toReversed() },
  ])
    expect(
      availablePlanOccurrenceCohortResolutionChoices(
        changed,
        snapshot.source.userId
      )
    ).toEqual([])
})
test("joint dialog shows both complete slots and the exact consequences of adoption", () => {
  const snapshot = capturePlanOccurrenceCohortComparison(
      planOccurrenceCohortFixture()
    ),
    html = render(snapshot)
  for (const text of [
    "Resolver fechas relacionadas",
    "2 fechas",
    "3 cambios relacionados",
    "2026-10-18",
    "2026-10-19",
    "Tu versión",
    "Remota conocida",
    "Completada",
    "En proceso",
    "revisión",
    "No cambia la serie ni las fechas fuera de esta revisión",
    "el historial se conserva",
    "no envía cambios al servidor",
    "últimas conocidas",
    "Cancelar",
    "Usar versiones remotas",
  ])
    expect(html).toContain(text)
  expect(html).not.toContain("No cambia la serie ni otros días")
  expect(html).not.toContain("Quedarán pendientes de confirmación")
})
test("retry preview includes exception content, moved schedule, checklist and cancellation without implying an ACK", () => {
  const raw = planOccurrenceCohortFixture(),
    local = raw.occurrences[0]
  raw.occurrences[0] = {
    ...local,
    content: { title: "Chosen title", description: "Chosen description" },
    schedule: {
      mode: "timed",
      localStart: "2026-10-20T10:15",
      localEnd: "2026-10-20T11:45",
      timeZone: "Europe/Madrid",
    },
    checklist: [
      { id: crypto.randomUUID(), text: "Chosen step", completed: true },
    ],
    cancelled: true,
  }
  const snapshot = capturePlanOccurrenceCohortComparison(raw),
    html = render(snapshot, "retry_local")
  for (const text of [
    "Chosen title",
    "Chosen description",
    "10:15",
    "11:45",
    "Chosen step",
    "Cancelada",
    "Enviarás tu borrador completo",
    "no se fusionarán automáticamente",
    "pendientes de confirmación",
    "estado intermedio",
    "Guardar apariciones para enviar",
    "en conjunto",
  ])
    expect(html).toContain(text)
  expect(html).not.toContain("La elección no envía cambios al servidor")
})
test("foreign or altered reviews render no confirmation dialog", () => {
  const snapshot = capturePlanOccurrenceCohortComparison(
    planOccurrenceCohortFixture()
  )
  expect(render(snapshot, "adopt_remote", "foreign")).toBe("")
  expect(render({ ...snapshot, operationIds: [] })).toBe("")
})
for (const reason of ["missing", "cancelled", "deleted", "overflow"] as const)
  test(`joint review retains adoption only for ${reason}`, () => {
    const raw = planOccurrenceCohortFixture()
    if (reason === "missing") raw.occurrences = [raw.occurrences[0]]
    else
      raw.shadows[1] = {
        ...raw.shadows[1],
        record: {
          ...raw.shadows[1].record,
          cancelled: reason === "cancelled",
          deletedAt: reason === "deleted" ? raw.series.updatedAt : null,
          revision:
            reason === "overflow"
              ? Number.MAX_SAFE_INTEGER
              : raw.shadows[1].record.revision,
        },
      }
    const snapshot = capturePlanOccurrenceCohortComparison(raw)
    expect(
      availablePlanOccurrenceCohortResolutionChoices(
        snapshot,
        snapshot.source.userId
      )
    ).toEqual(["adopt_remote"])
    const html = render(snapshot)
    expect(html).toContain("Usar versiones remotas")
    expect(html).not.toContain("Enviar todos mis borradores")
    expect(render(snapshot, "retry_local")).toBe("")
  })
test("busy joint review disables choices and both dialog actions", () => {
  const snapshot = capturePlanOccurrenceCohortComparison(
      planOccurrenceCohortFixture()
    ),
    html = render(snapshot, "retry_local", snapshot.source.userId, true)
  expect(html).toContain('<fieldset disabled=""')
  expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(2)
  expect(html).toContain("Guardando…")
})

test("only the own first multi-slot conflict offers a fresh review, never unreviewed decisions", () => {
  const f = planOccurrenceCohortFixture()
  const incident = projectPlanOccurrenceSyncIncidents({
    userId: f.userId,
    items: [f.series],
    occurrences: f.occurrences,
    entries: f.entries,
    shadows: f.shadows,
    outcomes: f.outcomes,
  })[0]
  expect(canReviewPlanOccurrenceCohort(incident, f.userId)).toBe(true)
  const html = renderToStaticMarkup(
    <PlanOccurrenceIncidentCard
      incident={incident}
      account={{ userId: f.userId, epoch: crypto.randomUUID() }}
    />
  )
  expect(html).toContain("Revisar fechas relacionadas")
  expect(html).not.toContain("Usar todas las versiones remotas")
  expect(html).not.toContain("Enviar todos mis borradores")
  for (const changed of [
    { ...incident, reason: "unavailable" },
    {
      ...incident,
      entry: { ...incident.entry, operation: f.entries[1].operation },
    },
    {
      ...incident,
      series: { ...incident.series, deletedAt: f.series.updatedAt },
    },
    { ...incident, blockedByRelatedIntentions: false },
  ])
    expect(canReviewPlanOccurrenceCohort(changed, f.userId)).toBe(false)
  expect(canReviewPlanOccurrenceCohort(incident, "foreign")).toBe(false)
  expect(canReviewPlanOccurrenceCohort({}, f.userId)).toBe(false)
})
