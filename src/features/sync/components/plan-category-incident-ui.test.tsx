import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanCategoryIncidentResolutionDialog } from "@/features/sync/components/plan-category-incident-resolution-dialog"
import { SyncIncidentActions } from "@/features/sync/components/sync-incident-actions"
import { planCategoryResolutionFixture } from "@/lib/backup/plan-category-resolution-fixture"
import { capturePlanCategoryResolutionSnapshot } from "@/lib/sync/plan-category-resolution"

function render(
  snapshot: ReturnType<
    typeof planCategoryResolutionFixture
  >["request"]["expected"],
  actor: string,
  choice: "adopt_remote" | "retry_local",
  busy = false
) {
  return renderToStaticMarkup(
    <PlanCategoryIncidentResolutionDialog
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
for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`${variant} joint preview shows the exact selected content and assignment without claiming ACK`, () => {
    const f = planCategoryResolutionFixture(),
      raw = structuredClone(f.capture)
    if (
      raw.incident.local?.kind !== "plan" ||
      raw.incident.remote?.kind !== "plan"
    )
      throw new Error("Plan fixture required")
    raw.incident.local.variant = variant
    raw.incident.remote.variant = variant
    if (raw.incident.localAtOutcome?.kind === "plan")
      raw.incident.localAtOutcome.variant = variant
    const snapshot = capturePlanCategoryResolutionSnapshot(raw)
    const retry = render(snapshot, f.actor, "retry_local"),
      adopt = render(snapshot, f.actor, "adopt_remote")
    for (const text of [
      "Local draft",
      "Complete local notes",
      "Step",
      "Chosen",
      "#123456",
      "3",
      "pendientes de confirmación",
      "primero el contenido",
      "Cancelar",
      "Guardar ambos para enviar",
    ])
      expect(retry).toContain(text)
    expect(retry).toContain("background-color:#123456")
    for (const text of [
      "Remote draft",
      "sin categoría",
      "Usar ambos remotos",
      "últimas conocidas",
      "El historial se conserva",
    ])
      expect(adopt).toContain(text)
    expect(adopt).not.toContain("Chosen")
  })

test("joint dialog rejects foreign snapshots and unsupported retries before exposing a confirmation", () => {
  const f = planCategoryResolutionFixture(),
    snapshot = { ...f.request.expected, localTag: null }
  expect(render(snapshot, "foreign", "adopt_remote")).toBe("")
  expect(render(snapshot, f.actor, "retry_local")).toBe("")
  const adopt = render(snapshot, f.actor, "adopt_remote", true)
  expect(adopt).toContain("Guardando…")
  expect(adopt).not.toContain("Enviar mi plan y categoría")
  expect(adopt).toContain("disabled")
})

test("joint preview labels an unknown remote category rather than inventing a name or color", () => {
  const f = planCategoryResolutionFixture(),
    snapshot = {
      ...f.request.expected,
      remoteView: { ...f.remoteView, primaryTagId: crypto.randomUUID() },
    }
  const html = render(snapshot, f.actor, "adopt_remote")
  expect(html).toContain("Categoría: no disponible")
  expect(html).not.toContain("Chosen")
  expect(html).not.toContain("#123456")
})

test("joint review trigger is available only for its own simple related conflict and never exposes choices before capture", () => {
  const f = planCategoryResolutionFixture(),
    incident = f.capture.incident
  const account = { userId: f.actor, epoch: crypto.randomUUID() }
  const render = (value = incident, actor = account) =>
    renderToStaticMarkup(
      <SyncIncidentActions account={actor} incident={value} />
    )
  expect(render()).toContain("Revisar plan y categoría")
  expect(render()).not.toContain("Usar ambos remotos")
  expect(render()).not.toContain("Guardar ambos para enviar")
  expect(render(incident, { ...account, userId: "foreign" })).not.toContain(
    "Revisar plan y categoría"
  )
  expect(render({ ...incident, remote: null })).not.toContain(
    "Revisar plan y categoría"
  )
  expect(render({ ...incident, reason: "unavailable" })).not.toContain(
    "Revisar plan y categoría"
  )
  expect(
    render({ ...incident, local: { ...f.local, deletedAt: f.now } })
  ).not.toContain("Revisar plan y categoría")
})
