import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { SyncIncidentCard } from "@/features/sync/components/sync-incident-card"
import { SyncIncidentResolutionDialog } from "@/features/sync/components/sync-incident-resolution-dialog"
import type { Plan } from "@/types/plan-item"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

function fixture(variant: Plan["variant"]) {
  const now = "2026-10-17T19:20:00.000Z",
    actor = "common-plan-ui-owner"
  const plan: Plan = {
    kind: "plan",
    variant,
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Borrador completo",
    description: "Descripción a revisar",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-17",
      endDateExclusive: "2026-10-18",
    },
    status: "in_progress",
    checklist: [
      { id: crypto.randomUUID(), text: "Paso visible", completed: true },
    ],
    recurrence: null,
    completedAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const entry = {
    userId: actor,
    entityKey: `item:${plan.id}`,
    sequence: 1,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1 as const,
      baseRevision: 1,
      command: {
        type: "plan.set-status" as const,
        itemId: plan.id,
        status: "in_progress" as const,
      },
    },
    state: "conflict" as const,
    attempts: 1,
    dependencies: [],
    createdAt: now,
    lease: null,
  }
  const incident: SyncIncidentSnapshot = {
    entry,
    reason: "conflict",
    local: plan,
    remote: { ...plan, revision: 2, title: "Versión remota" },
    localAtOutcome: plan,
    shadowAtOutcome: null,
    intentions: [entry],
    blockedByRelatedIntentions: false,
  }
  return { incident, account: { userId: actor, epoch: crypto.randomUUID() } }
}
for (const variant of ["task", "event", "appointment", "note"] as const) {
  test(`${variant} offers only supported common choices with a full draft preview`, () => {
    const { incident, account } = fixture(variant)
    const html = renderToStaticMarkup(
      <SyncIncidentCard incident={incident} account={account} />
    )
    for (const label of [
      "Usar remoto conocido",
      "Enviar mi borrador",
      "Cambiar estado",
      "Paso visible",
      "Descripción a revisar",
    ])
      expect(html).toContain(label)
    expect(html).not.toContain("Crear copia de mi borrador")
    const dialog = renderToStaticMarkup(
      <SyncIncidentResolutionDialog
        incident={incident}
        choice="retry_local"
        busy={false}
        onConfirm={async () => {}}
        onClose={() => {}}
      />
    )
    for (const label of [
      "Borrador completo",
      "Paso visible",
      "2026-10-17",
      "no se fusionará automáticamente",
      "pendiente de confirmación",
    ])
      expect(dialog).toContain(label)
    const blocked = renderToStaticMarkup(
      <SyncIncidentCard
        incident={{ ...incident, blockedByRelatedIntentions: true }}
        account={account}
      />
    )
    expect(blocked).not.toContain("Usar remoto conocido")
    expect(blocked).toContain("cambios relacionados fuera")
    if (!incident.remote) throw new Error("Common fixture remote is missing")
    const deleted = renderToStaticMarkup(
      <SyncIncidentCard
        incident={{
          ...incident,
          remote: { ...incident.remote, deletedAt: "2026-10-17T20:00:00.000Z" },
        }}
        account={account}
      />
    )
    expect(deleted).toContain("Crear copia de mi borrador")
    expect(deleted).not.toContain("Enviar mi borrador")
  })
}
