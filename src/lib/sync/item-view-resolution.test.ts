import { expect, test } from "bun:test"
import { planRemoteItemViewOperation } from "@/lib/preferences/remote-item-view-plan"
import {
  availableItemViewResolutionChoices,
  captureItemViewResolutionSnapshot,
  planItemViewIncidentResolution,
  validateItemViewResolutionRecord,
} from "@/lib/sync/item-view-resolution"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import type { ItemViewResolutionSnapshot } from "@/types/item-view-resolution"

function fixture(variant: "task" | "event" | "appointment" | "note" = "task") {
  const actor = "view-resolution-owner",
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
    recurrence: null,
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
for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`isolated ${variant} assignment adopts or retries without modifying plan, category or order`, () => {
    const f = fixture(variant),
      before = JSON.stringify(f)
    expect(availableItemViewResolutionChoices(f.current, f.actor)).toEqual([
      "adopt_remote",
      "retry_local",
    ])
    const adopt = planItemViewIncidentResolution(
      { ...f.request, choice: "adopt_remote", operationId: null },
      f.current
    )
    expect(adopt.local).toEqual(f.remote)
    expect(adopt.replacement).toBeNull()
    const retry = planItemViewIncidentResolution(f.request, f.current)
    expect(retry.local).toMatchObject({ primaryTagId: f.tag.id, revision: 2 })
    expect(retry.replacement).toEqual({
      operationId: f.request.operationId,
      protocolVersion: 1,
      baseRevision: 2,
      command: {
        type: "item-view.set",
        itemId: f.parent.id,
        primaryTagId: f.tag.id,
      },
    })
    expect(retry.supersededOperationIds).toEqual([
      f.entry.operation.operationId,
      f.child.operation.operationId,
    ])
    expect(validateItemViewResolutionRecord(retry, f.actor)).toEqual(retry)
    expect(
      planRemoteItemViewOperation(
        {
          userId: f.actor,
          timestamp: f.now,
          operation: retry.replacement,
          item: f.parent,
          current: f.remote,
          tag: f.tag,
        },
        true
      )
    ).toMatchObject({
      status: "changes",
      effects: [
        { store: "itemViews", record: { primaryTagId: f.tag.id, revision: 3 } },
      ],
    })
    expect(JSON.stringify(f)).toBe(before)
  })
test("assignment rejects stale, foreign, missing, contradictory and uncertain evidence", () => {
  const changes: ((v: ItemViewResolutionSnapshot) => void)[] = [
    (v) => {
      v.parent.ownerId = "foreign"
    },
    (v) => {
      v.parent.deletedAt = "2026-10-18T16:00:00.000Z"
    },
    (v) => {
      v.incident.blockedByRelatedIntentions = true
    },
    (v) => {
      v.incident.entry.userId = "foreign"
    },
    (v) => {
      v.incident.intentions[1].attempts = 1
    },
    (v) => {
      v.incident.remote[0].record = null
    },
    (v) => {
      const r = v.incident.remote[0].record
      if (r) r.record.deletedAt = "2026-10-18T16:00:00.000Z"
    },
    (v) => {
      const r = v.incident.remote[0].record
      if (r) r.record.revision = 1
    },
    (v) => {
      const r = v.incident.remote[0].record
      if (r?.store === "itemViews") r.record.primaryTagId = crypto.randomUUID()
    },
    (v) => {
      if (!v.localTag) throw new Error("Fixture category is missing")
      v.localTag = { ...v.localTag, userId: "foreign" }
    },
    (v) => {
      v.incident.intentions = []
    },
    (v) => {
      v.incident.intentions.reverse()
    },
  ]
  for (const change of changes) {
    const f = fixture()
    change(f.current)
    expect(availableItemViewResolutionChoices(f.current, f.actor)).toEqual([])
    expect(() =>
      planItemViewIncidentResolution(
        { ...f.request, expected: f.current },
        f.current
      )
    ).toThrow()
  }
  const f = fixture(),
    later = structuredClone(f.current)
  later.parent.title = "Later edit"
  expect(() => planItemViewIncidentResolution(f.request, later)).toThrow(
    "changed"
  )
})
test("unknown, deleted or uncommitted categories and exhausted remote revisions disable retry but preserve adoption", () => {
  for (const kind of ["missing", "deleted", "uncommitted", "exhausted"]) {
    const f = fixture()
    if (kind === "missing") f.current.localTag = null
    if (kind === "deleted" && f.current.localTag)
      f.current.localTag.deletedAt = f.now
    if (kind === "uncommitted" && f.current.localTag)
      f.current.localTag.revision = 0
    if (kind === "exhausted") {
      const r = f.current.incident.remote[0].record
      if (r) r.record.revision = Number.MAX_SAFE_INTEGER
    }
    expect(availableItemViewResolutionChoices(f.current, f.actor)).toEqual([
      "adopt_remote",
    ])
    expect(() =>
      planItemViewIncidentResolution(
        { ...f.request, expected: f.current },
        f.current
      )
    ).toThrow("unavailable")
  }
  const f = fixture()
  f.current.localTag = null
  const r = f.current.incident.local[0].record
  if (r?.store === "itemViews") r.record.primaryTagId = null
  f.current.incident.intentions[1].operation.command = {
    type: "item-view.set",
    itemId: f.parent.id,
    primaryTagId: null,
  }
  expect(availableItemViewResolutionChoices(f.current, f.actor)).toEqual([
    "adopt_remote",
    "retry_local",
  ])
})
test("full assignment capture rejects omitted queues, semantic plan edits, external dependencies and duplicate identities", () => {
  const f = fixture()
  expect(() =>
    captureItemViewResolutionSnapshot({ ...f.capture, entries: [f.entry] })
  ).toThrow("complete exact")
  const other = outboxEntrySchema.parse({
    ...f.child,
    entityKey: `item:${f.parent.id}`,
    sequence: 3,
    dependencies: [],
    operation: {
      ...f.child.operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "plan.set-status",
        itemId: f.parent.id,
        status: "completed",
      },
    },
  })
  expect(() =>
    captureItemViewResolutionSnapshot({
      ...f.capture,
      entries: [...f.capture.entries, other],
    })
  ).toThrow("another unresolved")
  expect(() =>
    captureItemViewResolutionSnapshot({
      ...f.capture,
      entries: [
        ...f.capture.entries,
        { ...other, dependencies: [f.entry.operation.operationId] },
      ],
    })
  ).toThrow("external dependent")
  expect(() =>
    captureItemViewResolutionSnapshot({
      ...f.capture,
      entries: [...f.capture.entries, f.child],
    })
  ).toThrow("duplicate")
  expect(() =>
    captureItemViewResolutionSnapshot({
      ...f.capture,
      entries: [f.entry, { ...f.child, dependencies: [crypto.randomUUID()] }],
    })
  ).toThrow("complete ordered")
})
test("assignment decision identities and durable record cannot be reused or altered", () => {
  const f = fixture()
  for (const id of [f.request.resolutionId, f.entry.operation.operationId])
    expect(() =>
      planItemViewIncidentResolution(
        { ...f.request, operationId: id },
        f.current
      )
    ).toThrow("identities")
  const record = planItemViewIncidentResolution(f.request, f.current)
  expect(() =>
    validateItemViewResolutionRecord(
      { ...record, local: { ...record.local, primaryTagId: null } },
      f.actor
    )
  ).toThrow("contradicts")
  expect(() => validateItemViewResolutionRecord(record, "foreign")).toThrow(
    "another account"
  )
})

test("capture retains the complete transitive acknowledged prerequisite closure and rejects unconfirmed history", () => {
  const f = fixture(),
    ancestorId = crypto.randomUUID(),
    dependencyId = crypto.randomUUID()
  const ancestor = outboxEntrySchema.parse({
    ...f.entry,
    sequence: 1,
    state: "acknowledged",
    dependencies: [],
    operation: { ...f.entry.operation, operationId: ancestorId },
  })
  const dependency = outboxEntrySchema.parse({
    ...ancestor,
    sequence: 2,
    dependencies: [ancestorId],
    operation: { ...ancestor.operation, operationId: dependencyId },
  })
  const chain = [
    { ...f.entry, sequence: 3, dependencies: [dependencyId] },
    { ...f.child, sequence: 4 },
  ]
  const capture = {
    ...f.capture,
    entries: [ancestor, dependency, ...chain],
    incident: { ...f.capture.incident, intentions: chain, entry: chain[0] },
  }
  const snapshot = captureItemViewResolutionSnapshot(capture)
  expect(snapshot.acknowledgedDependencies).toEqual([ancestor, dependency])
  expect(availableItemViewResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
    "retry_local",
  ])
  expect(() =>
    captureItemViewResolutionSnapshot({
      ...capture,
      entries: [{ ...ancestor, state: "superseded" }, dependency, ...chain],
    })
  ).toThrow("acknowledged")
  const truncated = { ...snapshot, acknowledgedDependencies: [dependency] }
  expect(availableItemViewResolutionChoices(truncated, f.actor)).toEqual([])
  expect(() =>
    planItemViewIncidentResolution(
      { ...f.request, expected: truncated },
      truncated
    )
  ).toThrow()
})
test("unrelated acknowledged history and independent pending categories do not enlarge the compact assignment review", () => {
  const f = fixture(),
    id = crypto.randomUUID()
  const independent = outboxEntrySchema.parse({
    ...f.child,
    sequence: 3,
    dependencies: [],
    entityKey: `tag:${id}`,
    operation: {
      ...f.child.operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "tag.save",
        tagId: id,
        input: { name: "Independent", color: "#ffffff", position: 90 },
      },
    },
  })
  const captured = captureItemViewResolutionSnapshot({
    ...f.capture,
    entries: [...f.capture.entries, independent],
    incident: {
      ...f.capture.incident,
      intentions: [...f.capture.incident.intentions, independent],
    },
  })
  expect(captured).toEqual(f.current)
  const extra = {
    ...captured,
    acknowledgedDependencies: [{ ...independent, state: "acknowledged" }],
  }
  expect(availableItemViewResolutionChoices(extra, f.actor)).toEqual([])
})
