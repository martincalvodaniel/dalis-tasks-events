import { captureItemViewResolutionSnapshot } from "@/lib/sync/item-view-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"

export function itemViewResolutionFixture(
  variant: "task" | "event" | "appointment" | "note" = "task",
  actorInput = "view-resolution-owner",
  recurring = false
) {
  const actor = actorInput,
    now = "2026-10-18T15:50:00.000Z"
  const parent = planSchema.parse({
    kind: "plan",
    variant,
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Existing content",
    description: "Keep unchanged",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-18",
      endDateExclusive: "2026-10-19",
    },
    status: "in_progress",
    completedAt: null,
    checklist: [],
    recurrence: recurring
      ? {
          frequency: "monthly",
          interval: 1,
          anchorDate: "2026-10-18",
          timeZone: "Europe/Madrid",
          end: { type: "never" },
        }
      : null,
    revision: 3,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const tag = tagSchema.parse({
    id: crypto.randomUUID(),
    userId: actor,
    name: "Local category",
    normalizedName: "local category",
    color: "#123456",
    position: 50,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const local = itemViewSchema.parse({
    userId: actor,
    itemId: parent.id,
    primaryTagId: tag.id,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const remote = { ...local, primaryTagId: null, revision: 2 }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `item-view:${parent.id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "item-view.set",
        itemId: parent.id,
        primaryTagId: tag.id,
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
        current: { store: "itemViews", record: remote },
      },
    },
    local: [
      {
        entityKey: entry.entityKey,
        record: { store: "itemViews", record: local },
      },
    ],
    base: [{ entityKey: entry.entityKey, record: null }],
  })
  const input = {
    userId: actor,
    items: [parent],
    occurrences: [],
    tags: [tag],
    itemViews: [local],
    taskPlacements: [],
    settings: [],
    entries: [entry, child],
    outcomes: [outcome],
    shadows: [],
  }
  const incident = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (incident.kind !== "preference")
    throw new Error("Assignment fixture did not project a personal incident")
  const capture = {
    userId: actor,
    parent,
    localTag: tag,
    entries: input.entries,
    incident: incident.incident,
  }
  const current = captureItemViewResolutionSnapshot(capture)
  const request = {
    userId: actor,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    choice: "retry_local" as const,
    createdAt: now,
    expected: current,
  }
  return {
    actor,
    now,
    parent,
    tag,
    local,
    remote,
    entry,
    child,
    outcome,
    input,
    capture,
    current,
    request,
  }
}
