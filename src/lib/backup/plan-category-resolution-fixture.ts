import {
  capturePlanCategoryResolutionSnapshot,
  planPlanCategoryIncidentResolution,
} from "@/lib/sync/plan-category-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { localItemOutcomeV2Schema } from "@/schemas/local-item-outcome-v2"
import { localRecurringBackupV3Schema } from "@/schemas/local-recurring-backup"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { tagSchema } from "@/schemas/preferences"

// Synthetic test data only; no deployed account or database is used.
export function planCategoryResolutionFixture(actor = "joint-backup-owner") {
  const now = "2026-10-18T10:30:00.000Z"
  const local = planSchema.parse({
    kind: "plan",
    variant: "note",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Local draft",
    description: "Complete local notes",
    status: "in_progress",
    completedAt: null,
    checklist: [{ id: crypto.randomUUID(), text: "Step", completed: true }],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-18",
      endDateExclusive: "2026-10-19",
    },
    recurrence: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const remote = { ...local, title: "Remote draft", revision: 5 }
  const tag = tagSchema.parse({
    id: crypto.randomUUID(),
    userId: actor,
    name: "Chosen",
    normalizedName: "chosen",
    color: "#123456",
    position: 20,
    revision: 3,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const view = {
    userId: actor,
    itemId: local.id,
    primaryTagId: tag.id,
    revision: 2,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const remoteView = { ...view, primaryTagId: null, revision: 7 }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `item:${local.id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "plan.set-status",
        itemId: local.id,
        status: "in_progress",
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
  const assignment = outboxEntrySchema.parse({
    ...child,
    entityKey: `item-view:${local.id}`,
    sequence: 3,
    dependencies: [child.operation.operationId],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 2,
      command: {
        type: "item-view.set",
        itemId: local.id,
        primaryTagId: tag.id,
      },
    },
  })
  const outcome = localItemOutcomeV2Schema.parse({
    version: 2,
    kind: "item",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "item",
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        current: remote,
      },
    },
    local,
    base: null,
  })
  const entries = [entry, child, assignment]
  const input = {
    userId: actor,
    items: [local],
    occurrences: [],
    tags: [tag],
    itemViews: [view],
    taskPlacements: [],
    settings: [],
    entries,
    outcomes: [outcome],
    shadows: [],
  }
  const found = projectRecurringSettingsSyncIncidentOverview(input).find(
    (value) => value.kind === "item"
  )
  if (found?.kind !== "item") throw new Error("Joint fixture incident missing")
  const capture = {
    userId: actor,
    incident: found.incident,
    entries,
    localView: view,
    remoteView,
    localTag: tag,
  }
  const request = {
    userId: actor,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    viewOperationId: crypto.randomUUID(),
    choice: "retry_local" as const,
    createdAt: now,
    expected: capturePlanCategoryResolutionSnapshot(capture),
  }
  function backup(choice: "adopt_remote" | "retry_local" = "retry_local") {
    const record = planPlanCategoryIncidentResolution(
      {
        ...request,
        choice,
        operationId: choice === "retry_local" ? request.operationId : null,
        viewOperationId:
          choice === "retry_local" ? request.viewOperationId : null,
      },
      capture
    )
    const replacements =
      record.replacement && record.viewReplacement
        ? [record.replacement, record.viewReplacement].map((operation, index) =>
            outboxEntrySchema.parse({
              userId: actor,
              entityKey: index ? `item-view:${local.id}` : `item:${local.id}`,
              operation,
              state: "pending",
              attempts: 0,
              lease: null,
              sequence: 4 + index,
              createdAt: now,
              dependencies: index ? [record.replacement?.operationId] : [],
            })
          )
        : []
    return localRecurringBackupV3Schema.parse({
      format: "dalis-local-backup",
      version: 3,
      protocolVersion: 1,
      databaseVersion: 2,
      userId: actor,
      exportedAt: now,
      stores: {
        items: [record.local],
        occurrences: [],
        tags: [tag],
        itemViews: [record.view],
        taskPlacements: [],
        settings: [],
        memberships: [],
        invitations: [],
        remoteShadows: [],
        outbox: [
          ...entries.map((value) => ({
            ...value,
            state: "superseded",
            lease: null,
          })),
          ...replacements,
        ],
        syncMetadata: [
          { key: "outbox-sequence", value: 3 + replacements.length },
          outcome,
          record,
        ],
      },
    })
  }
  return {
    actor,
    now,
    local,
    remote,
    tag,
    view,
    remoteView,
    entry,
    child,
    assignment,
    outcome,
    capture,
    request,
    backup,
  }
}
