import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ItemViewIncidentResolutionDialog } from "@/features/sync/components/item-view-incident-resolution-dialog"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { itemViewResolutionFixture } from "@/lib/backup/item-view-resolution-fixture"

for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`assignment ${variant} review shows exact plan and selected category, preserving guards`, () => {
    const f = itemViewResolutionFixture(variant),
      account = { userId: f.actor, epoch: crypto.randomUUID() }
    const card = renderToStaticMarkup(
      <PersonalIncidentCard account={account} incident={f.current.incident} />
    )
    expect(card).toContain("Revisar asignación")
    expect(card).not.toContain("Guardar asignación para enviar")
    for (const choice of ["adopt_remote", "retry_local"] as const) {
      const html = renderToStaticMarkup(
        <ItemViewIncidentResolutionDialog
          snapshot={f.current}
          actor={f.actor}
          choice={choice}
          busy={false}
          onSelect={() => {}}
          onConfirm={async () => {}}
          onClose={() => {}}
        />
      )
      for (const text of [
        "Existing content",
        "Keep unchanged",
        "2026-10-18",
        "historial se conserva",
        "No cambia el contenido",
        "Cancelar",
      ])
        expect(html).toContain(text)
      expect(html).toContain(
        choice === "adopt_remote"
          ? "Usar asignación remota"
          : "Guardar asignación para enviar"
      )
      if (choice === "retry_local") {
        expect(html).toContain("Local category")
        expect(html).toContain("#123456")
        expect(html).toContain("pendiente de confirmación")
      }
    }
    const foreign = renderToStaticMarkup(
      <PersonalIncidentCard
        account={{ ...account, userId: "foreign" }}
        incident={f.current.incident}
      />
    )
    expect(foreign).not.toContain("Revisar asignación")
    const blocked = renderToStaticMarkup(
      <PersonalIncidentCard
        account={account}
        incident={{ ...f.current.incident, blockedByRelatedIntentions: true }}
      />
    )
    expect(blocked).not.toContain("Revisar asignación")
  })
test("assignment dialog rejects foreign actor and unavailable retry, hides unknown colors and respects busy", () => {
  const f = itemViewResolutionFixture()
  function render(
    actor = f.actor,
    choice: "adopt_remote" | "retry_local" = "retry_local",
    busy = false
  ) {
    return renderToStaticMarkup(
      <ItemViewIncidentResolutionDialog
        snapshot={f.current}
        actor={actor}
        choice={choice}
        busy={busy}
        onSelect={() => {}}
        onConfirm={async () => {}}
        onClose={() => {}}
      />
    )
  }
  expect(render("foreign")).toBe("")
  expect(render(f.actor, "retry_local", true)).toContain("Guardando…")
  f.current.localTag = null
  expect(render()).toBe("")
  expect(render(f.actor, "adopt_remote")).not.toContain("#123456")
})

test("series assignment review uses the same dialog and keeps the recurring parent intact", () => {
  const f = itemViewResolutionFixture("note", "series-ui-owner", true)
  const html = renderToStaticMarkup(
    <ItemViewIncidentResolutionDialog
      snapshot={f.current}
      actor={f.actor}
      choice="retry_local"
      busy={false}
      onSelect={() => {}}
      onConfirm={async () => {}}
      onClose={() => {}}
    />
  )
  expect(html).toContain("Existing content")
  expect(html).toContain("Local category")
  expect(html).toContain("Guardar asignación para enviar")
  expect(f.current.parent.recurrence?.frequency).toBe("monthly")
})
