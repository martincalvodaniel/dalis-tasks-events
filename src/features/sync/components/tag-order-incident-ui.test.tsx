import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { TagOrderIncidentResolutionDialog } from "@/features/sync/components/tag-order-incident-resolution-dialog"
import { TagOrderResolutionVersion } from "@/features/sync/components/tag-order-resolution-version"
import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import { captureTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import type {
  TagOrderResolutionRequest,
  TagOrderResolutionSnapshot,
} from "@/types/tag-order-resolution"

function render(
  snapshot: TagOrderResolutionSnapshot,
  actor: string,
  choice: TagOrderResolutionRequest["choice"] = "adopt_remote",
  busy = false
) {
  return renderToStaticMarkup(
    <TagOrderIncidentResolutionDialog
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
  test(`order ${choice} dialog shows complete reviewed catalogs and explains its effects`, () => {
    const f = tagOrderResolutionFixture(),
      html = render(f.snapshot, f.actor, choice)
    for (const text of [
      "Resolver orden de categorías",
      "Tu catálogo actual",
      "Reaplicar mi último movimiento",
      "Usar orden remoto conocido",
      "El historial se conserva",
      "No cambia planes, asignaciones",
      "nombres, colores y eliminaciones",
      "Cancelar",
      "#123456",
      "En revisión",
    ])
      expect(html).toContain(text)
    for (const tag of f.local) expect(html).toContain(tag.name)
    expect(html).toContain(
      choice === "adopt_remote"
        ? "No se enviará ningún movimiento"
        : "pendiente de confirmación"
    )
  })
test("order version follows visible rank rather than UUID enumeration and keeps tombstones and colors", () => {
  const f = tagOrderResolutionFixture(),
    extra = {
      ...f.observed[0],
      id: crypto.randomUUID(),
      name: "Deleted category",
      deletedAt: f.now,
      color: "#abcdef",
    },
    html = renderToStaticMarkup(
      <TagOrderResolutionVersion
        label="Preview"
        tags={[extra, ...f.observed]}
        primaryId={f.original[0].id}
      />
    )
  expect(html.indexOf(f.original[1].name)).toBeLessThan(
    html.indexOf(f.original[0].name)
  )
  expect(html.indexOf(f.original[0].name)).toBeLessThan(
    html.indexOf(f.original[2].name)
  )
  for (const text of [
    "Deleted category",
    "Eliminada",
    "#abcdef",
    "max-h-48",
    "overflow-y-auto",
  ])
    expect(html).toContain(text)
})
test("order dialog refuses foreign and unsupported choices, including removed neighbors", () => {
  const f = tagOrderResolutionFixture()
  expect(render(f.snapshot, "foreign")).toBe("")
  const snapshot = captureTagOrderResolutionSnapshot({
    ...f.capture,
    observedTags: f.observed.map((tag, index) =>
      index === 2 ? { ...tag, deletedAt: f.now } : tag
    ),
  })
  expect(render(snapshot, f.actor)).not.toContain(
    "Reaplicar mi último movimiento"
  )
  expect(render(snapshot, f.actor, "retry_latest_move")).toBe("")
  expect(render(f.snapshot, f.actor, "adopt_remote", true)).toContain(
    "Guardando…"
  )
  expect(render(f.snapshot, f.actor, "adopt_remote", true)).toContain(
    "disabled"
  )
})

test("order action remains presentation-only and protects foreign, rejected and related incidents", () => {
  const f = tagOrderResolutionFixture(),
    account = { userId: f.actor, epoch: crypto.randomUUID() }
  const render = (actor = account.userId, incident = f.snapshot.incident) =>
    renderToStaticMarkup(
      <PersonalIncidentCard
        account={{ ...account, userId: actor }}
        incident={incident}
      />
    )
  expect(render()).toContain("Revisar orden")
  expect(render()).not.toContain("Guardar movimiento para enviar")
  expect(render("foreign")).not.toContain("Revisar orden")
  expect(
    render(account.userId, {
      ...f.snapshot.incident,
      blockedByRelatedIntentions: true,
    })
  ).not.toContain("Revisar orden")
  expect(
    render(account.userId, {
      ...f.snapshot.incident,
      reason: "invalid_command",
    })
  ).not.toContain("Revisar orden")
})
