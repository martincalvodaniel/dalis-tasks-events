import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { captureTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"

export function tagOrderResolutionFixture(actor = "category-order-owner") {
  const now = "2026-10-18T20:24:00.000Z"
  const original = [0, 1, 2].map((index) =>
    tagSchema.parse({
      id: crypto.randomUUID(),
      userId: actor,
      name: `Category ${index}`,
      normalizedName: `category ${index}`,
      color: "#123456",
      position: index * 1024,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  )
  const observed = original.map((tag, index) =>
    index === 0 ? { ...tag, position: 1536, revision: 2 } : tag
  )
  const local = original.map((tag, index) =>
    index === 0 ? { ...tag, position: 3072 } : tag
  )
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `tag:${original[0].id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "tag.move",
        tagId: original[0].id,
        beforeId: original[1].id,
        afterId: null,
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
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [entry.operation.operationId],
    operation: {
      ...entry.operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "tag.move",
        tagId: original[0].id,
        beforeId: null,
        afterId: original[2].id,
      },
    },
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
        current: { store: "tags", record: observed[0] },
      },
    },
    local: [
      {
        entityKey: entry.entityKey,
        record: { store: "tags", record: local[0] },
      },
    ],
    base: [
      {
        entityKey: entry.entityKey,
        record: { store: "tags", record: original[0] },
      },
    ],
  })
  const input = {
    userId: actor,
    items: [],
    occurrences: [],
    tags: local,
    itemViews: [],
    taskPlacements: [],
    settings: [],
    entries: [entry, child],
    outcomes: [outcome],
    shadows: observed.map((tag) => ({
      version: 2 as const,
      kind: "preference" as const,
      entityKey: `tag:${tag.id}`,
      record: { store: "tags" as const, record: tag },
    })),
  }
  const projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Category order fixture incident is missing")
  const capture = {
    userId: actor,
    incident: projected.incident,
    entries: input.entries,
    localTags: local,
    observedTags: observed,
  }
  const snapshot = captureTagOrderResolutionSnapshot(capture)
  return {
    actor,
    now,
    original,
    observed,
    local,
    entry,
    child,
    outcome,
    input,
    capture,
    snapshot,
  }
}
