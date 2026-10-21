import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanOccurrenceCopyDialog } from "@/features/sync/components/plan-occurrence-copy-dialog"
import { canCopyPlanOccurrenceIncident } from "@/lib/sync/plan-occurrence-copy"
import { planOccurrenceCopyFixture } from "@/lib/sync/plan-occurrence-copy-fixture"

for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`${variant} copy review shows exact draft, cancellation and consequences`, () => {
    const f = planOccurrenceCopyFixture(variant)
    if (!f.snapshot.local) throw new Error("Copy preview local missing")
    f.snapshot.local.content = {
      title: "Título propio a copiar",
      description: "Descripción posterior",
    }
    f.snapshot.local.checklist = [
      { id: crypto.randomUUID(), text: "Paso conservado", completed: true },
    ]
    f.request.expected = f.snapshot
    const before = JSON.stringify(f),
      markup = renderToStaticMarkup(
        <PlanOccurrenceCopyDialog
          request={f.request}
          actor={f.userId}
          busy={false}
          onConfirm={async () => {}}
          onClose={() => {}}
        />
      )
    for (const label of [
      "Plan nuevo que crearás",
      "Título propio a copiar",
      "Descripción posterior",
      "Paso conservado",
      "Original que conservarás",
      "sin repetición, categoría ni orden manual",
      "no se copian otros días",
      "El historial se conserva",
      "pendiente de confirmación",
      "Cancelar",
      "Crear copia",
      "2026-10-18",
    ])
      expect(markup).toContain(label)
    expect(markup).not.toContain(f.request.copyItemId)
    expect(markup).not.toContain("Revisión 0")
    expect(JSON.stringify(f)).toBe(before)
    expect(canCopyPlanOccurrenceIncident(f.snapshot, f.userId)).toBe(true)
    expect(canCopyPlanOccurrenceIncident(f.snapshot, "foreign")).toBe(false)
  })

test("invalid or foreign copy review cannot render confirmation and busy disables actions", () => {
  const f = planOccurrenceCopyFixture(),
    props = {
      request: f.request,
      actor: f.userId,
      busy: false,
      onConfirm: async () => {},
      onClose: () => {},
    }
  expect(
    renderToStaticMarkup(
      <PlanOccurrenceCopyDialog {...props} actor="foreign" />
    )
  ).toBe("")
  expect(
    renderToStaticMarkup(
      <PlanOccurrenceCopyDialog
        {...props}
        request={{ ...f.request, expected: { ...f.snapshot, remote: null } }}
      />
    )
  ).toBe("")
  const markup = renderToStaticMarkup(
    <PlanOccurrenceCopyDialog {...props} busy />
  )
  expect(markup.match(/disabled=""/g)).toHaveLength(2)
  expect(markup).toContain("Guardando…")
})
