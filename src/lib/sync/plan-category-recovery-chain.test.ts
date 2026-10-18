import { expect, test } from "bun:test"
import { availableSyncIncidentResolutionChoices } from "@/lib/sync/incident-resolution"
import { readPlanCategoryRecoveryChain } from "@/lib/sync/plan-category-recovery-chain"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import type { OutboxEntry } from "@/types/local-sync"
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

function cohort(variant: Plan["variant"] = "task") {
  const { local, current } = fixture(variant)
  current.blockedByRelatedIntentions = true
  const view = outboxEntrySchema.parse({
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
        primaryTagId: crypto.randomUUID(),
      },
    },
  })
  const input = {
    userId: local.ownerId,
    incident: current,
    entries: [...current.intentions, view],
  }
  return { input, view, local }
}
for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`${variant} joint chain includes content and linked view without mutating frozen evidence`, () => {
    const { input, view } = cohort(variant),
      before = JSON.stringify(input)
    expect(
      availableSyncIncidentResolutionChoices(input.incident, true)
    ).toEqual([])
    const chain = readPlanCategoryRecoveryChain(input)
    expect(
      chain.intentions.map((entry) => entry.operation.operationId)
    ).toEqual(input.entries.map((entry) => entry.operation.operationId))
    expect(chain.views).toEqual([view])
    expect(
      availableSyncIncidentResolutionChoices(chain.incident, true)
    ).toEqual(["adopt_remote", "retry_local"])
    expect(JSON.stringify(input)).toBe(before)
  })

test("joint chain rejects missing or changed content, foreign identities and incomplete dependency graphs", () => {
  for (const change of [
    (v: ReturnType<typeof cohort>["input"]) => {
      v.entries.pop()
    },
    (v: ReturnType<typeof cohort>["input"]) => {
      v.entries = v.entries.slice(1)
    },
    (v: ReturnType<typeof cohort>["input"]) => {
      v.entries[2].dependencies = [crypto.randomUUID()]
    },
    (v: ReturnType<typeof cohort>["input"]) => {
      v.entries[2].dependencies = [v.entries[2].operation.operationId]
    },
    (v: ReturnType<typeof cohort>["input"]) => {
      v.entries[2].userId = "foreign"
    },
    (v: ReturnType<typeof cohort>["input"]) => {
      v.entries.push(structuredClone(v.entries[2]))
    },
    (v: ReturnType<typeof cohort>["input"]) => {
      v.incident.intentions = v.incident.intentions.slice(0, 1)
    },
  ]) {
    const { input } = cohort()
    change(input)
    expect(() => readPlanCategoryRecoveryChain(input)).toThrow()
  }
})

test("only untouched pending views and supported simple content can enter the reviewed cohort", () => {
  for (const state of [
    "sending",
    "conflict",
    "rejected",
    "acknowledged",
    "superseded",
  ] as const) {
    const { input } = cohort()
    input.entries[2].state = state
    if (state === "sending")
      input.entries[2].lease = {
        ownerId: crypto.randomUUID(),
        expiresAt: input.entries[2].createdAt,
      }
    expect(() => readPlanCategoryRecoveryChain(input)).toThrow()
  }
  const { input } = cohort()
  input.entries[2].attempts = 1
  expect(() => readPlanCategoryRecoveryChain(input)).toThrow()
  for (const change of [
    (v: Plan) => {
      v.deletedAt = v.updatedAt
    },
    (v: Plan) => {
      v.ownerId = "foreign"
    },
    (v: Plan) => {
      v.recurrence = {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-17",
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      }
    },
  ]) {
    const { input } = cohort()
    if (input.incident.local?.kind !== "plan")
      throw new Error("Missing fixture plan")
    change(input.incident.local)
    expect(() => readPlanCategoryRecoveryChain(input)).toThrow()
  }
})

test("unreviewed dependents and unresolved prerequisites block the whole cohort while ACKed prerequisites are retained", () => {
  const { input, view } = cohort()
  const independent: OutboxEntry = {
    ...view,
    sequence: 4,
    dependencies: [],
    entityKey: `item-view:${crypto.randomUUID()}`,
    operation: { ...view.operation, operationId: crypto.randomUUID() },
  }
  if (independent.operation.command.type !== "item-view.set")
    throw new Error("View fixture missing")
  independent.operation.command = {
    ...independent.operation.command,
    itemId: independent.entityKey.slice(10),
  }
  expect(
    readPlanCategoryRecoveryChain({
      ...input,
      entries: [...input.entries, independent],
    }).intentions.length
  ).toBe(3)
  expect(() =>
    readPlanCategoryRecoveryChain({
      ...input,
      entries: [
        ...input.entries,
        { ...independent, dependencies: [view.operation.operationId] },
      ],
    })
  ).toThrow("external dependent")
  const ancestor = {
    ...independent,
    sequence: 1,
    state: "acknowledged" as const,
  }
  const shifted = input.entries.map((entry) => ({
    ...entry,
    sequence: entry.sequence + 1,
    dependencies:
      entry.sequence === 1
        ? [ancestor.operation.operationId]
        : entry.dependencies,
  }))
  const joined = {
    ...input,
    incident: {
      ...input.incident,
      entry: shifted[0],
      intentions: shifted.slice(0, 2),
    },
    entries: [ancestor, ...shifted],
  }
  expect(readPlanCategoryRecoveryChain(joined).intentions.length).toBe(3)
  expect(() =>
    readPlanCategoryRecoveryChain({
      ...joined,
      entries: [{ ...ancestor, state: "pending" }, ...shifted],
    })
  ).toThrow("external prerequisite")
  expect(() =>
    readPlanCategoryRecoveryChain({
      ...joined,
      entries: [{ ...ancestor, state: "superseded" }, ...shifted],
    })
  ).toThrow("external prerequisite")
})

test("a movement on the same plan remains protected even without a dependency edge", () => {
  const { input, view, local } = cohort()
  const movement = outboxEntrySchema.parse({
    ...view,
    entityKey: taskPlacementEntityKey(local.id, "day", "2026-10-17"),
    sequence: 4,
    dependencies: [],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "task.move",
        itemId: local.id,
        occurrenceId: null,
        scope: "day",
        date: "2026-10-17",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
    },
  })
  expect(() =>
    readPlanCategoryRecoveryChain({
      ...input,
      entries: [...input.entries, movement],
    })
  ).toThrow("same plan")
})

test("interleaved content and category assignments retain their exact original ordering", () => {
  const { input, view } = cohort()
  const content = { ...input.entries[1], sequence: 3 }
  const firstView = {
    ...view,
    sequence: 2,
    dependencies: [input.entries[0].operation.operationId],
  }
  const lastView = {
    ...view,
    sequence: 4,
    dependencies: [
      content.operation.operationId,
      firstView.operation.operationId,
    ],
    operation: { ...view.operation, operationId: crypto.randomUUID() },
  }
  const chain = readPlanCategoryRecoveryChain({
    ...input,
    incident: { ...input.incident, intentions: [input.entries[0], content] },
    entries: [lastView, content, input.entries[0], firstView],
  })
  expect(chain.intentions.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4])
  expect(chain.views).toEqual([firstView, lastView])
  const disconnected = { ...lastView, dependencies: [] }
  expect(() =>
    readPlanCategoryRecoveryChain({
      ...input,
      entries: [input.entries[0], input.entries[1], disconnected],
    })
  ).toThrow("disconnected")
})
