import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlacementIncidentResolutionDialog } from "@/features/sync/components/placement-incident-resolution-dialog"
import { captureRecurringPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { recurringPlacementResolutionFixture } from "@/lib/sync/recurring-placement-resolution-fixture"
import { placementResolutionCaptureSchema } from "@/schemas/placement-resolution"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

function render(
  snapshot: PlacementResolutionSnapshot,
  actor: string,
  choice: PlacementResolutionRequest["choice"] = "adopt_remote",
  busy = false,
  reviewKind: "mixed_group" | "recurring_primary" = "recurring_primary"
) {
  return renderToStaticMarkup(
    <PlacementIncidentResolutionDialog
      snapshot={snapshot}
      actor={actor}
      choice={choice}
      busy={busy}
      reviewKind={reviewKind}
      onSelect={() => {}}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
}
for (const slot of ["moved", "implicit"] as const)
  for (const scope of ["day", "overdue"] as const)
    for (const choice of ["adopt_remote", "retry_latest_move"] as const)
      test(`recurring ${slot} ${scope} ${choice} review highlights its exact date and preserves every neighbor`, () => {
        const f = recurringPlacementResolutionFixture(slot, scope),
          before = JSON.stringify(f.snapshot),
          html = render(f.snapshot, f.simple.actor, choice)
        for (const text of [
          "Resolver orden de planes",
          "planes repetidos",
          "El historial se conserva",
          "No cambia fechas, contenido ni categorías asignadas",
          "última versión conocida",
          "18 oct 2026",
          "Repetición del 17 oct 2026",
          "Cancelar",
        ])
          expect(html).toContain(text)
        expect(html.match(/En revisión/g)?.length).toBe(2)
        expect(html.match(/Recurring peer/g)?.length).toBe(4)
        for (const item of f.snapshot.observed.items)
          expect(html).toContain(item.title)
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
test("recurring review never offers another family's or foreign account's decision", () => {
  const f = recurringPlacementResolutionFixture()
  expect(render(f.snapshot, "foreign")).toBe("")
  expect(
    render(f.snapshot, f.simple.actor, "adopt_remote", false, "mixed_group")
  ).toBe("")
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

test("a timed appearance review distinguishes its original hour from the new hour", () => {
  const f = recurringPlacementResolutionFixture(),
    targetId = `${f.series.id}:2026-10-17T09:00`,
    capture = placementResolutionCaptureSchema.parse(
      JSON.parse(
        JSON.stringify(f.capture)
          .replaceAll(f.targetId, targetId)
          .replaceAll('"slotKey":"2026-10-17"', '"slotKey":"2026-10-17T09:00"')
      )
    )
  for (const catalog of [capture.local, capture.observed]) {
    const parent = catalog.items.find((item) => item.id === f.series.id)
    if (parent?.kind !== "plan") throw new Error("Timed visual parent missing")
    parent.schedule = {
      mode: "timed",
      localStart: "2026-10-17T09:00",
      localEnd: "2026-10-17T10:00",
      timeZone: "Europe/Madrid",
    }
    const occurrence = catalog.occurrences.find(
      (value) => value.id === targetId
    )
    if (!occurrence) throw new Error("Timed visual occurrence missing")
    occurrence.slotKey = "2026-10-17T09:00"
    occurrence.schedule = {
      mode: "timed",
      localStart: "2026-10-18T11:30",
      localEnd: "2026-10-18T12:30",
      timeZone: "Europe/Madrid",
    }
  }
  const snapshot = captureRecurringPlacementResolutionSnapshot(capture),
    html = render(snapshot, f.simple.actor)
  expect(html).toContain("del 17 oct 2026 · 09:00")
  expect(html).toContain("11:30")
  expect(html.match(/En revisión/g)?.length).toBe(2)
})
