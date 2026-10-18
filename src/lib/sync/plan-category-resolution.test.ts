import { expect, test } from "bun:test"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { planRemoteItemViewOperation } from "@/lib/preferences/remote-item-view-plan"
import {
  availablePlanCategoryResolutionChoices,
  capturePlanCategoryResolutionSnapshot,
  planPlanCategoryIncidentResolution,
  validatePlanCategoryResolutionRecord,
} from "@/lib/sync/plan-category-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import type { Plan } from "@/types/plan-item"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

function fixture(variant: Plan["variant"] = "task") {
  const now = "2026-10-17T19:20:00.000Z",
    userId = "plan-resolution-owner"
  const local: Plan = {
    kind: "plan",
    variant,
    id: crypto.randomUUID(),
    ownerId: userId,
    title: "Complete local draft",
    description: "Local notes",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-17",
      endDateExclusive: "2026-10-19",
    },
    status: "in_progress",
    completedAt: null,
    checklist: [
      { id: crypto.randomUUID(), text: "Local step", completed: true },
    ],
    recurrence: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const entry = {
    userId,
    entityKey: `item:${local.id}`,
    operation: {
      protocolVersion: 1 as const,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: {
        type: "plan.set-status" as const,
        itemId: local.id,
        status: "in_progress" as const,
      },
    },
    sequence: 1,
    dependencies: [],
    state: "conflict" as const,
    attempts: 1,
    createdAt: now,
    lease: null,
  }
  const dependent = {
    ...entry,
    sequence: 2,
    state: "pending" as const,
    attempts: 0,
    dependencies: [entry.operation.operationId],
    operation: {
      ...entry.operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "plan.set-checklist-entry" as const,
        itemId: local.id,
        entryId: local.checklist[0].id,
        completed: true,
      },
    },
  }
  const remote: Plan = {
    ...local,
    title: "Known remote",
    status: "not_started",
    checklist: [],
    revision: 5,
  }
  const current: SyncIncidentSnapshot = {
    entry,
    reason: "conflict",
    local,
    remote,
    localAtOutcome: { ...local, title: "Old local draft" },
    shadowAtOutcome: { ...remote, revision: 4 },
    intentions: [entry, dependent],
    blockedByRelatedIntentions: false,
  }
  // Current remote must be newer than observed history; this is not an ancestor used for merging.
  const request = {
    userId,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    choice: "retry_local" as const,
    createdAt: now,
    expected: current,
  }
  return { local, remote, current, request }
}

function comparison(variant: Plan["variant"] = "task") {
  const { current, request, local, remote } = fixture(variant)
  current.blockedByRelatedIntentions = true
  const tag = tagSchema.parse({
    id: crypto.randomUUID(),
    userId: request.userId,
    name: "Chosen",
    normalizedName: "chosen",
    color: "#123456",
    position: 30,
    revision: 3,
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
    deletedAt: null,
  })
  const view = {
    userId: request.userId,
    itemId: local.id,
    primaryTagId: tag.id,
    revision: 2,
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
    deletedAt: null,
  }
  const viewEntry = outboxEntrySchema.parse({
    ...current.intentions[1],
    entityKey: `item-view:${local.id}`,
    sequence: 3,
    dependencies: [current.intentions[1].operation.operationId],
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
  const raw = {
    userId: request.userId,
    incident: current,
    entries: [...current.intentions, viewEntry],
    localView: view,
    remoteView: { ...view, primaryTagId: null, revision: 7 },
    localTag: tag,
  }
  const expected = capturePlanCategoryResolutionSnapshot(raw)
  const choice = { ...request, viewOperationId: crypto.randomUUID(), expected }
  return { raw, request: choice, local, remote, viewEntry, tag }
}
for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`${variant} joint choice plans full content and category with independent CAS and no invented ACK`, () => {
    const { raw, request, local, remote, tag } = comparison(variant),
      before = JSON.stringify(raw)
    expect(availablePlanCategoryResolutionChoices(raw)).toEqual([
      "adopt_remote",
      "retry_local",
    ])
    const adopt = planPlanCategoryIncidentResolution(
      {
        ...request,
        operationId: null,
        viewOperationId: null,
        choice: "adopt_remote",
      },
      raw
    )
    expect(adopt.local).toEqual(remote)
    expect(adopt.view).toEqual(raw.remoteView)
    expect(adopt.replacement).toBeNull()
    expect(adopt.viewReplacement).toBeNull()
    const retry = planPlanCategoryIncidentResolution(request, raw)
    expect(retry.replacement?.baseRevision).toBe(remote.revision)
    expect(retry.viewReplacement).toMatchObject({
      operationId: request.viewOperationId,
      baseRevision: 7,
      command: {
        type: "item-view.set",
        itemId: local.id,
        primaryTagId: tag.id,
      },
    })
    expect(retry.local).toMatchObject({
      variant,
      title: local.title,
      description: local.description,
      status: local.status,
      checklist: local.checklist,
      schedule: local.schedule,
      revision: remote.revision,
    })
    expect(retry.view).toMatchObject({ primaryTagId: tag.id, revision: 7 })
    expect(retry.supersededOperationIds).toEqual(
      raw.entries.map((entry) => entry.operation.operationId)
    )
    expect(validatePlanCategoryResolutionRecord(retry, request.userId)).toEqual(
      retry
    )
    if (retry.replacement?.command.type !== "item.update")
      throw new Error("Missing content update replacement")
    const item = {
      ...applyItemCommand(
        remote,
        retry.replacement.command,
        request.userId,
        request.createdAt
      ),
      revision: remote.revision + 1,
    }
    const changed = planRemoteItemViewOperation(
      {
        userId: request.userId,
        timestamp: request.createdAt,
        operation: retry.viewReplacement,
        item,
        current: raw.remoteView,
        tag,
      },
      true
    )
    expect(changed).toMatchObject({
      status: "changes",
      effects: [
        { store: "itemViews", record: { primaryTagId: tag.id, revision: 8 } },
      ],
    })
    expect(JSON.stringify(raw)).toBe(before)
  })

test("joint comparison stays compact across independent activity but detects local view, remote revision and category changes", () => {
  const { raw, request, viewEntry } = comparison()
  const id = crypto.randomUUID()
  const independent = outboxEntrySchema.parse({
    ...viewEntry,
    entityKey: `item-view:${id}`,
    sequence: 4,
    dependencies: [],
    operation: {
      ...viewEntry.operation,
      operationId: crypto.randomUUID(),
      command: { type: "item-view.set", itemId: id, primaryTagId: null },
    },
  })
  expect(
    capturePlanCategoryResolutionSnapshot({
      ...raw,
      entries: [...raw.entries, independent],
    })
  ).toEqual(request.expected)
  expect(
    planPlanCategoryIncidentResolution(request, {
      ...raw,
      entries: [...raw.entries, independent],
    }).replacement
  ).not.toBeNull()
  for (const changed of [
    { ...raw, remoteView: { ...raw.remoteView, revision: 8 } },
    { ...raw, localTag: { ...raw.localTag, color: "#ffffff" } },
  ])
    expect(() => planPlanCategoryIncidentResolution(request, changed)).toThrow(
      "changed"
    )
  expect(() =>
    planPlanCategoryIncidentResolution(
      { ...request, operationId: independent.operation.operationId },
      { ...raw, entries: [...raw.entries, independent] }
    )
  ).toThrow("already in use")
})

test("unknown, deleted or uncommitted category limits retry; missing or foreign remote view permits no choice", () => {
  const { raw } = comparison()
  for (const localTag of [
    null,
    { ...raw.localTag, deletedAt: raw.localTag.updatedAt },
    { ...raw.localTag, revision: 0 },
  ]) {
    const changed = { ...raw, localTag },
      expected = capturePlanCategoryResolutionSnapshot(changed)
    expect(availablePlanCategoryResolutionChoices(changed)).toEqual([
      "adopt_remote",
    ])
    const request = {
      userId: raw.userId,
      resolutionId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      viewOperationId: crypto.randomUUID(),
      choice: "retry_local",
      createdAt: raw.localTag.updatedAt,
      expected,
    }
    expect(() => planPlanCategoryIncidentResolution(request, changed)).toThrow(
      "committed category"
    )
  }
  for (const remoteView of [
    null,
    { ...raw.remoteView, revision: 0 },
    { ...raw.remoteView, userId: "foreign" },
    { ...raw.remoteView, deletedAt: raw.localTag.updatedAt },
  ])
    expect(
      availablePlanCategoryResolutionChoices({ ...raw, remoteView })
    ).toEqual([])
})

test("joint capture retains actual ACK prerequisite evidence and rejects unreviewed outside dependents", () => {
  const { raw, viewEntry, request } = comparison()
  const id = crypto.randomUUID()
  const ancestor = outboxEntrySchema.parse({
    ...viewEntry,
    entityKey: `item-view:${id}`,
    sequence: 1,
    state: "acknowledged",
    attempts: 1,
    dependencies: [],
    operation: {
      ...viewEntry.operation,
      operationId: crypto.randomUUID(),
      command: { type: "item-view.set", itemId: id, primaryTagId: null },
    },
  })
  const entries = raw.entries.map((entry) => ({
    ...entry,
    sequence: entry.sequence + 1,
    dependencies:
      entry.sequence === 1
        ? [ancestor.operation.operationId]
        : entry.dependencies,
  }))
  const changed = {
    ...raw,
    entries: [ancestor, ...entries],
    incident: {
      ...raw.incident,
      entry: entries[0],
      intentions: entries.slice(0, 2),
    },
  }
  const expected = capturePlanCategoryResolutionSnapshot(changed)
  expect(expected.acknowledgedDependencies).toEqual([ancestor])
  expect(
    validatePlanCategoryResolutionRecord(
      planPlanCategoryIncidentResolution({ ...request, expected }, changed),
      raw.userId
    ).expected
  ).toEqual(expected)
  expect(() =>
    capturePlanCategoryResolutionSnapshot({
      ...changed,
      entries: [
        ...changed.entries,
        {
          ...ancestor,
          sequence: 5,
          state: "pending",
          attempts: 0,
          dependencies: [viewEntry.operation.operationId],
          operation: {
            ...ancestor.operation,
            operationId: crypto.randomUUID(),
          },
        },
      ],
    })
  ).toThrow("external dependent")
})

test("joint receipt cannot reuse IDs, change a chosen version or weaken its preserved ACK prerequisites", () => {
  const { raw, request } = comparison()
  for (const viewOperationId of [
    request.operationId,
    request.resolutionId,
    raw.entries[2].operation.operationId,
  ])
    expect(() =>
      planPlanCategoryIncidentResolution({ ...request, viewOperationId }, raw)
    ).toThrow()
  const record = planPlanCategoryIncidentResolution(request, raw)
  expect(() =>
    validatePlanCategoryResolutionRecord(
      { ...record, view: { ...record.view, primaryTagId: null } },
      raw.userId
    )
  ).toThrow("contradicts")
  expect(() => validatePlanCategoryResolutionRecord(record, "foreign")).toThrow(
    "another account"
  )
  const corrupt = structuredClone(record)
  corrupt.expected.viewIntentions[0].attempts = 1
  expect(() =>
    validatePlanCategoryResolutionRecord(corrupt, raw.userId)
  ).toThrow("uncertain")
})

test("exhausted remote revisions remain adoption-only without creating an unsendable retry", () => {
  const { raw } = comparison()
  expect(
    availablePlanCategoryResolutionChoices({
      ...raw,
      remoteView: { ...raw.remoteView, revision: Number.MAX_SAFE_INTEGER },
    })
  ).toEqual(["adopt_remote"])
  expect(
    availablePlanCategoryResolutionChoices({
      ...raw,
      incident: {
        ...raw.incident,
        remote: { ...raw.incident.remote, revision: Number.MAX_SAFE_INTEGER },
      },
    })
  ).toEqual(["adopt_remote"])
})
