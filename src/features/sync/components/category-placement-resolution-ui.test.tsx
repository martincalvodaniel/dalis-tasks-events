import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { CategoryPlacementIncidentResolutionDialog } from "@/features/sync/components/category-placement-resolution-dialog"
import { categoryPlacementResolutionFixture } from "@/lib/sync/category-placement-resolution-fixture"
import { captureCategoryPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
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
    <CategoryPlacementIncidentResolutionDialog
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
for (const primary of ["simple", "moved", "implicit"] as const)
  for (const scope of ["day", "overdue"] as const)
    for (const choice of ["adopt_remote", "retry_latest_move"] as const)
      test(`category ${primary} ${scope} ${choice} review explains parent scope and exact chosen groups`, () => {
        const f = categoryPlacementResolutionFixture(primary, scope),
          before = JSON.stringify(f.snapshot),
          html = render(f.snapshot, f.actor, choice)
        for (const text of [
          "Resolver categoría y orden",
          "Source",
          "Destination",
          "#123456",
          "#abcdef",
          "La categoría pertenece a todo el plan y cambia en todas sus fechas.",
          "Las posiciones manuales de otras fechas se conservan.",
          "El historial se conserva.",
          "última versión conocida",
          "Cancelar",
        ])
          expect(html).toContain(text)
        expect(html.match(/En revisión/g)?.length).toBe(2)
        if (primary !== "simple") {
          expect(html).toContain("Mismo plan")
          expect(html).toContain("Repetición")
        }
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
test("category dialog hides foreign or stale choices and retry without complete positions", () => {
  const f = categoryPlacementResolutionFixture("moved"),
    unknown = categoryPlacementResolutionFixture("moved", "day", false)
  expect(render(f.snapshot, "foreign")).toBe("")
  const stale = structuredClone(f.snapshot)
  stale.local.items[0].title += " changed"
  expect(render(stale, f.actor)).toBe("")
  expect(render(unknown.snapshot, unknown.actor, "retry_latest_move")).toBe("")
  expect(render(unknown.snapshot, unknown.actor)).not.toContain(
    "Reaplicar mi último movimiento"
  )
  expect(render(f.snapshot, f.actor, "adopt_remote", true)).toContain(
    "Guardando…"
  )
})

test("an adopted position tombstone remains visible in automatic order", () => {
  const f = categoryPlacementResolutionFixture("moved"),
    capture = structuredClone(f.capture),
    remote = capture.observed.placements.find(
      (record) => record.occurrenceId === f.targetId
    )
  if (!remote) throw new Error("Category visual fixture rank missing")
  remote.deletedAt = f.now
  remote.revision++
  capture.incident.remote = [
    {
      entityKey: f.entry.entityKey,
      record: { store: "taskPlacements", record: remote },
    },
  ]
  const snapshot = captureCategoryPlacementResolutionSnapshot(capture),
    html = render(snapshot, f.actor)
  expect(html).toContain("Sin posición manual")
  expect(html.match(/En revisión/g)?.length).toBe(2)
  expect(html).not.toContain("Reaplicar mi último movimiento")
  expect(html).not.toContain("line-through")
})
