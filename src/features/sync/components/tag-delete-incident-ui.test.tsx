import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { TagDeletionIncidentResolutionDialog } from "@/features/sync/components/tag-delete-incident-resolution-dialog"
import { tagDeletionResolutionFixture } from "@/lib/backup/tag-delete-resolution-fixture"
import { previewTagDeletionResolutionChoice } from "@/lib/sync/tag-delete-decision"
import { captureTagDeletionResolutionSnapshot } from "@/lib/sync/tag-delete-resolution"
import type {
  TagDeletionResolutionRequest,
  TagDeletionResolutionSnapshot,
} from "@/types/tag-delete-resolution"

function render(
  snapshot: TagDeletionResolutionSnapshot,
  actor: string,
  choice: TagDeletionResolutionRequest["choice"] = "adopt_remote",
  busy = false
) {
  return renderToStaticMarkup(
    <TagDeletionIncidentResolutionDialog
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
for (const choice of ["adopt_remote", "retry_delete"] as const)
  test(`deletion ${choice} review explains restored visibility and preserved assignments`, () => {
    const f = tagDeletionResolutionFixture(),
      html = render(f.snapshot, f.actor, choice)
    for (const text of [
      "Resolver eliminación de categoría",
      "Usar categoría remota conocida",
      "Volver a solicitar la eliminación",
      "Tu catálogo actual",
      "El historial se conserva",
      "No modifica planes ni sus asignaciones",
      "última versión conocida",
      "Cancelar",
      "Eliminada",
      "#123456",
    ])
      expect(html).toContain(text)
    expect(html).toContain(
      choice === "adopt_remote"
        ? "volverán a agruparse"
        : "pendiente de confirmación"
    )
    for (const tag of f.local) expect(html).toContain(tag.name)
  })
test("deletion preview uses exact planner fields without persisting an identity or inventing a revision", () => {
  const f = tagDeletionResolutionFixture(),
    before = JSON.stringify(f.snapshot),
    tags = previewTagDeletionResolutionChoice(
      f.snapshot,
      f.actor,
      "retry_delete"
    )
  expect(JSON.stringify(f.snapshot)).toBe(before)
  const primary = tags.find((tag) => tag.id === f.original[0].id)
  expect(primary?.deletedAt).toBe(f.entry.createdAt)
  expect(primary?.revision).toBe(f.observed[0].revision)
  expect(
    previewTagDeletionResolutionChoice(f.snapshot, f.actor, "adopt_remote")
  ).toEqual(f.observed.toSorted((a, b) => a.id.localeCompare(b.id)))
})
test("remote tombstone offers only adoption and never promises restoration", () => {
  const f = tagDeletionResolutionFixture(),
    remote = { ...f.observed[0], revision: 3, deletedAt: f.now },
    snapshot = captureTagDeletionResolutionSnapshot({
      ...f.capture,
      observedTags: [remote, ...f.observed.slice(1)],
      incident: {
        ...f.capture.incident,
        remote: [
          {
            entityKey: f.entry.entityKey,
            record: { store: "tags", record: remote },
          },
        ],
      },
    })
  const html = render(snapshot, f.actor)
  expect(html).toContain("seguirá eliminada")
  expect(html).not.toContain("Volver a solicitar")
  expect(html).not.toContain("volverán a agruparse")
  expect(render(snapshot, f.actor, "retry_delete")).toBe("")
})
test("deletion review rejects foreign/stale evidence and disables controls while committing", () => {
  const f = tagDeletionResolutionFixture()
  expect(render(f.snapshot, "foreign")).toBe("")
  expect(render({ ...f.snapshot, observedTags: [] }, f.actor)).toBe("")
  const html = render(f.snapshot, f.actor, "adopt_remote", true)
  expect(html).toContain("Guardando…")
  expect(html).toContain("disabled")
})
test("deletion incident offers only a review entry and protects rejected or related histories", () => {
  const f = tagDeletionResolutionFixture(),
    account = { userId: f.actor, epoch: crypto.randomUUID() }
  const render = (actor = account.userId, incident = f.snapshot.incident) =>
    renderToStaticMarkup(
      <PersonalIncidentCard
        account={{ ...account, userId: actor }}
        incident={incident}
      />
    )
  expect(render()).toContain("Revisar eliminación")
  expect(render()).not.toContain("Guardar eliminación para enviar")
  expect(render("foreign")).not.toContain("Revisar eliminación")
  expect(
    render(account.userId, {
      ...f.snapshot.incident,
      blockedByRelatedIntentions: true,
    })
  ).not.toContain("Revisar eliminación")
  expect(
    render(account.userId, {
      ...f.snapshot.incident,
      reason: "invalid_command",
    })
  ).not.toContain("Revisar eliminación")
})
