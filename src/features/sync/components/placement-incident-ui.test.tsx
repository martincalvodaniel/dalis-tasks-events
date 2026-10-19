import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { PlacementIncidentResolutionDialog } from "@/features/sync/components/placement-incident-resolution-dialog"
import { PlacementResolutionVersion } from "@/features/sync/components/placement-resolution-version"
import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import { capturePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

function render(
  snapshot: PlacementResolutionSnapshot,
  actor: string,
  choice: PlacementResolutionRequest["choice"] = "adopt_remote",
  busy = false
) {
  return renderToStaticMarkup(
    <PlacementIncidentResolutionDialog
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
for (const choice of ["adopt_remote", "retry_latest_move"] as const)
  test(`placement ${choice} review explains the actual scope and preserves unrelated fields`, () => {
    const f = placementResolutionFixture(),
      html = render(f.snapshot, f.actor, choice)
    for (const text of [
      "Resolver orden de planes",
      "Sin categoría",
      "Tu orden actual",
      "Usar orden remoto conocido",
      "Reaplicar mi último movimiento",
      "El historial se conserva",
      "No cambia fechas, contenido ni categorías asignadas",
      "última versión conocida",
      "Cancelar",
      "En revisión",
    ])
      expect(html).toContain(text)
    for (const item of f.items) expect(html).toContain(item.title)
    expect(html).toContain(
      choice === "adopt_remote"
        ? "No se enviará ningún movimiento"
        : "pendiente de confirmación"
    )
  })
test("placement version follows ranks and retains a deleted primary without claiming its plan was deleted", () => {
  const f = placementResolutionFixture(),
    html = renderToStaticMarkup(
      <PlacementResolutionVersion
        label="Preview"
        snapshot={f.snapshot}
        placements={f.local.placements}
      />
    )
  expect(html.indexOf(f.items[1].title)).toBeLessThan(
    html.indexOf(f.items[0].title)
  )
  expect(html.indexOf(f.items[2].title)).toBeLessThan(
    html.indexOf(f.items[0].title)
  )
  const remote = { ...f.observed.placements[0], revision: 3, deletedAt: f.now },
    snapshot = capturePlacementResolutionSnapshot({
      ...f.capture,
      observed: {
        ...f.observed,
        placements: [remote, ...f.observed.placements.slice(1)],
      },
      incident: {
        ...f.capture.incident,
        remote: [
          {
            entityKey: f.entry.entityKey,
            record: { store: "taskPlacements", record: remote },
          },
        ],
      },
    })
  expect(render(snapshot, f.actor)).toContain("Posición eliminada")
  expect(render(snapshot, f.actor)).not.toContain(
    "Reaplicar mi último movimiento"
  )
  expect(render(snapshot, f.actor, "retry_latest_move")).toBe("")
})
test("overdue review shows the declared reference day rather than its storage sentinel", () => {
  const f = placementResolutionFixture(undefined, "note", "overdue"),
    html = render(f.snapshot, f.actor)
  expect(html).toContain("Atrasadas; día de referencia")
  expect(html).toContain("19 oct 2026")
  expect(html).not.toContain("0001-01-01")
})
test("foreign or changed comparison has no choices and busy controls cannot confirm again", () => {
  const f = placementResolutionFixture()
  expect(render(f.snapshot, "foreign")).toBe("")
  expect(
    render(
      { ...f.snapshot, observed: { ...f.observed, placements: [] } },
      f.actor
    )
  ).toBe("")
  const html = render(f.snapshot, f.actor, "adopt_remote", true)
  expect(html).toContain("disabled")
  expect(html).toContain("Guardando…")
})
test("placement action offers a review only for its own simple conflict without related changes", () => {
  const f = placementResolutionFixture(),
    account = { userId: f.actor, epoch: crypto.randomUUID() },
    render = (actor = account.userId, incident = f.snapshot.incident) =>
      renderToStaticMarkup(
        <PersonalIncidentCard
          account={{ ...account, userId: actor }}
          incident={incident}
        />
      )
  expect(render()).toContain("Revisar orden de planes")
  expect(render()).not.toContain("Guardar movimiento para enviar")
  expect(render("foreign")).not.toContain("Revisar orden de planes")
  expect(
    render(account.userId, {
      ...f.snapshot.incident,
      reason: "invalid_command",
    })
  ).not.toContain("Revisar orden de planes")
  expect(
    render(account.userId, {
      ...f.snapshot.incident,
      blockedByRelatedIntentions: true,
    })
  ).not.toContain("Revisar orden de planes")
})
