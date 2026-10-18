import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { TagIncidentResolutionDialog } from "@/features/sync/components/tag-incident-resolution-dialog"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"

function fixture() {
  const actor = "category-resolution-owner",
    id = crypto.randomUUID(),
    now = "2026-10-18T05:40:00.000Z"
  const tag = tagSchema.parse({
    id,
    userId: actor,
    name: "Local",
    normalizedName: "local",
    color: "#123456",
    position: 80,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const remote = {
    ...tag,
    name: "Remote",
    normalizedName: "remote",
    color: "#654321",
    position: 20,
    revision: 2,
  }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `tag:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "tag.save",
        tagId: id,
        input: { name: tag.name, color: tag.color, position: tag.position },
      },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: now,
  })
  const child = outboxEntrySchema.parse({
    ...entry,
    operation: { ...entry.operation, operationId: crypto.randomUUID() },
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [entry.operation.operationId],
  })
  const outcome = localPreferenceOutcomeV2Schema.parse({
    version: 2,
    kind: "preference",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "preference",
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        current: { store: "tags", record: remote },
      },
    },
    local: [
      { entityKey: entry.entityKey, record: { store: "tags", record: tag } },
    ],
    base: [{ entityKey: entry.entityKey, record: null }],
  })
  const input = {
    userId: actor,
    items: [],
    occurrences: [],
    tags: [tag],
    itemViews: [],
    taskPlacements: [],
    settings: [],
    entries: [entry, child],
    outcomes: [outcome],
    shadows: [],
  }
  const projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Category fixture is missing")
  const current: PersonalSyncIncidentSnapshot = JSON.parse(
    JSON.stringify(projected.incident)
  )
  const request = {
    userId: actor,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    choice: "retry_local" as const,
    createdAt: now,
    expected: current,
  }
  return { actor, tag, remote, entry, child, outcome, input, current, request }
}

test("category safe choices show only for the owning account and preserve guarded evidence", () => {
  const { current, actor } = fixture(),
    account = { userId: actor, epoch: crypto.randomUUID() }
  const html = renderToStaticMarkup(
    <PersonalIncidentCard incident={current} account={account} />
  )
  for (const text of [
    "Usar categoría remota",
    "Enviar mi categoría",
    "Local",
    "Remote",
    "#123456",
    "#654321",
    "background-color:#123456",
  ])
    expect(html).toContain(text)
  for (const incident of [
    { ...current, blockedByRelatedIntentions: true },
    {
      ...current,
      remote: current.remote.map((entry) => ({ ...entry, record: null })),
    },
  ]) {
    const protectedHtml = renderToStaticMarkup(
      <PersonalIncidentCard incident={incident} account={account} />
    )
    expect(protectedHtml).not.toContain("Enviar mi categoría")
    expect(protectedHtml).not.toContain("Usar categoría remota")
    expect(protectedHtml).toContain("se conservan")
  }
  const foreign = renderToStaticMarkup(
    <PersonalIncidentCard
      incident={current}
      account={{ ...account, userId: "foreign" }}
    />
  )
  expect(foreign).not.toContain("Enviar mi categoría")
  expect(foreign).not.toContain("Usar categoría remota")
})

test("category preview preserves remote order while explaining name/color, retained history and pending confirmation", () => {
  const { current } = fixture()
  for (const choice of ["adopt_remote", "retry_local"] as const) {
    const html = renderToStaticMarkup(
      <TagIncidentResolutionDialog
        incident={current}
        choice={choice}
        busy={false}
        onConfirm={async () => {}}
        onClose={() => {}}
      />
    )
    for (const text of [
      "posición 20",
      "El historial se conserva",
      "no cambia tus planes ni sus asignaciones",
      "Cancelar",
    ])
      expect(html).toContain(text)
    expect(html).not.toContain("posición 80")
    expect(html).toContain(choice === "retry_local" ? "#123456" : "#654321")
    expect(html).toContain(
      choice === "retry_local" ? "pendiente de confirmación" : "última conocida"
    )
    if (choice === "retry_local") expect(html).toContain("conservando el orden")
  }
})
