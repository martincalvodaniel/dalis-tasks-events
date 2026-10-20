import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { MixedPlacementResolutionVersion } from "@/features/sync/components/mixed-placement-resolution-version"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { PlacementIncidentResolutionDialog } from "@/features/sync/components/placement-incident-resolution-dialog"
import { mixedPlacementDecisionFixture } from "@/lib/sync/mixed-placement-decision-fixture"
import { reviewPlacementGroup } from "@/lib/sync/placement-group-review"
import { captureMixedPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

function render(
  snapshot: PlacementResolutionSnapshot,
  actor: string,
  choice: PlacementResolutionRequest["choice"] = "adopt_remote",
  busy = false,
  reviewKind: "mixed_group" | null = "mixed_group"
) {
  return renderToStaticMarkup(
    <PlacementIncidentResolutionDialog
      snapshot={snapshot}
      actor={actor}
      choice={choice}
      reviewKind={reviewKind ?? undefined}
      busy={busy}
      onSelect={() => {}}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
}
for (const scope of ["day", "overdue"] as const)
  for (const choice of ["adopt_remote", "retry_latest_move"] as const)
    test(`mixed ${scope} ${choice} review contains every visible date and the complete consequences`, () => {
      const f = mixedPlacementDecisionFixture(undefined, scope),
        before = JSON.stringify(f.snapshot),
        html = render(f.snapshot, f.simple.actor, choice)
      for (const text of [
        "Resolver orden de planes",
        "planes repetidos",
        "Cada fecha conserva su contenido y su estado",
        "El historial se conserva",
        "No cambia fechas, contenido ni categorías asignadas",
        "última versión conocida",
        "Sin posición manual",
        "Repetición del 17 oct 2026",
        "18 oct 2026",
        "Cancelar",
      ])
        expect(html).toContain(text)
      for (const item of f.snapshot.observed.items)
        expect(html).toContain(item.title)
      expect(html.match(/Recurring peer/g)?.length).toBe(4)
      expect(html).toContain(
        choice === "adopt_remote"
          ? "No se enviará ningún movimiento"
          : "pendiente de confirmación"
      )
      expect(html.includes("Atrasadas; día de referencia")).toBe(
        scope === "overdue"
      )
      expect(html).not.toContain("0001-01-01")
      expect(JSON.stringify(f.snapshot)).toBe(before)
    })
test("mixed version follows production order including the implicit member and its exception title", () => {
  const f = mixedPlacementDecisionFixture(),
    occurrence = {
      ...f.moved,
      content: {
        title: "Moved occurrence title",
        description: "Known exception",
      },
    },
    snapshot = {
      ...f.snapshot,
      local: { ...f.snapshot.local, occurrences: [occurrence] },
      observed: { ...f.snapshot.observed, occurrences: [occurrence] },
    }
  const review = reviewPlacementGroup({
    userId: f.simple.actor,
    operation: f.simple.entry.operation,
    local: snapshot.local,
    observed: snapshot.observed,
  })
  const html = renderToStaticMarkup(
      <MixedPlacementResolutionVersion
        label="Order"
        snapshot={snapshot}
        placements={snapshot.local.placements}
      />
    ),
    positions = review.localOrder.map((id) =>
      html.indexOf(
        id === f.moved.id
          ? occurrence.content.title
          : id === f.implicit.id
            ? f.series.title
            : (snapshot.observed.items.find((item) => item.id === id)?.title ??
              "missing")
      )
    )
  expect(positions.every((value) => value >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
  expect(html.match(/<li /g)?.length).toBe(review.members.length)
})
test("a remote position tombstone keeps the plan visible in automatic order without claiming deletion", () => {
  const f = mixedPlacementDecisionFixture(),
    remote = {
      ...f.snapshot.observed.placements.find(
        (value) => value.occurrenceId === f.simple.items[0].id
      ),
      revision: 3,
      deletedAt: f.simple.now,
    }
  const snapshot = captureMixedPlacementResolutionSnapshot({
    ...f.capture,
    observed: {
      ...f.capture.observed,
      placements: f.capture.observed.placements.map((value) =>
        value.occurrenceId === f.simple.items[0].id ? remote : value
      ),
    },
    incident: {
      ...f.capture.incident,
      remote: [
        {
          entityKey: f.simple.entry.entityKey,
          record: { store: "taskPlacements", record: remote },
        },
      ],
    },
  })
  const html = render(snapshot, f.simple.actor)
  expect(html).toContain(f.simple.items[0].title)
  expect(html).toContain("Sin posición manual")
  expect(html).not.toContain("line-through")
  expect(html).not.toContain("Reaplicar mi último movimiento")
  expect(render(snapshot, f.simple.actor, "retry_latest_move")).toBe("")
})
test("mixed review validates the family, account and context before displaying choices", () => {
  const f = mixedPlacementDecisionFixture()
  expect(render(f.snapshot, "foreign")).toBe("")
  expect(render(f.snapshot, f.simple.actor, "adopt_remote", false, null)).toBe(
    ""
  )
  expect(
    render(
      { ...f.snapshot, observed: { ...f.snapshot.observed, occurrences: [] } },
      f.simple.actor
    )
  ).toBe("")
  expect(render(f.snapshot, f.simple.actor, "adopt_remote", true)).toContain(
    "Guardando…"
  )
})

test("mixed incident offers review without offering an unvalidated decision", () => {
  const f = mixedPlacementDecisionFixture(),
    account = { userId: f.simple.actor, epoch: crypto.randomUUID() }
  const html = renderToStaticMarkup(
    <PersonalIncidentCard account={account} incident={f.snapshot.incident} />
  )
  expect(html).toContain("Revisar orden de planes")
  expect(html).not.toContain("Usar orden remoto conocido")
  expect(html).not.toContain("Guardar movimiento para enviar")
  expect(
    renderToStaticMarkup(
      <PersonalIncidentCard
        account={{ ...account, userId: "foreign" }}
        incident={f.snapshot.incident}
      />
    )
  ).not.toContain("Revisar orden de planes")
})
