import { expect, test } from "bun:test"
import {
  RecurringSyncCoordinator,
  type RecurringSyncCoordinatorPorts,
} from "@/features/sync/recurring-coordinator"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { planSchema } from "@/schemas/plan-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const actor = "recurring-coordinator-fixture",
  timestamp = "2026-10-11T09:00:00.000Z"
function fixture() {
  const series = planSchema.parse({
    kind: "plan",
    variant: "event",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Own series",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const items = [series],
    entries: OutboxEntry[] = [],
    sent: SyncOperation[] = [],
    applied: RemoteRecurringOperationResult[] = []
  const released: [string, string][] = []
  let active = true
  let cursor: LocalPullCursor = { key: "pull-cursor", after: 0, through: null }
  const calls = { identity: 0, recover: 0, pull: 0, page: 0, claim: 0 }
  function add(
    command: SyncCommand,
    dependencies: OutboxEntry[] = [],
    baseRevision = 0
  ) {
    const entry: OutboxEntry = {
      userId: actor,
      entityKey:
        command.type === "task.move"
          ? taskPlacementEntityKey(
              command.occurrenceId ?? command.itemId,
              command.scope,
              command.date
            )
          : command.type === "item-view.set"
            ? `item-view:${command.itemId}`
            : `item:${series.id}`,
      sequence: entries.length + 1,
      state: "pending",
      attempts: 0,
      lease: null,
      createdAt: timestamp,
      dependencies: dependencies.map((entry) => entry.operation.operationId),
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision,
        command,
      },
    }
    entries.push(entry)
    return entry
  }
  const appearance = (capture = true): SyncCommand => ({
    type: "plan.set-occurrence-status",
    itemId: series.id,
    occurrenceId: `${series.id}:2026-10-11`,
    ...(capture ? { expectedOccurrenceRevision: 0 } : {}),
    status: "in_progress",
  })
  function result(operation: SyncOperation): RemoteRecurringOperationResult {
    const command = operation.command
    if (command.type === "plan.set-occurrence-status") {
      const plan = planRemotePlanOccurrenceOperation({
        userId: actor,
        timestamp,
        series: items[0],
        current: null,
        operation,
      })
      if (plan.status !== "changes")
        throw new Error("Expected fixture appearance")
      return {
        kind: "plan-occurrence",
        userId: actor,
        outcome: {
          operationId: operation.operationId,
          status: "applied",
          occurrence: plan.record,
          seriesRevision: operation.baseRevision,
          sequence: sent.length,
        },
      }
    }
    if (command.type === "task.move")
      return {
        kind: "preference",
        outcome: {
          operationId: operation.operationId,
          status: "applied",
          effects: {
            version: 1,
            userId: actor,
            operationId: operation.operationId,
            sequence: sent.length,
            effects: [
              {
                store: "taskPlacements",
                record: {
                  userId: actor,
                  occurrenceId: command.occurrenceId ?? command.itemId,
                  scope: command.scope,
                  date: command.date,
                  tagId: command.tagId,
                  position: 0,
                  revision: 1,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                  deletedAt: null,
                },
              },
            ],
          },
        },
      }
    return {
      kind: "item",
      outcome: {
        operationId: operation.operationId,
        status: "applied",
        item: { ...series, revision: operation.baseRevision + 1 },
        sequence: sent.length,
      },
    }
  }
  const ports: RecurringSyncCoordinatorPorts = {
    isActive: async () => active,
    readIdentity: async () => {
      calls.identity++
      return actor
    },
    readCursor: async () => cursor,
    recoverExpiredSends: async () => {
      calls.recover++
    },
    readQueueState: async () => structuredClone({ entries, items }),
    claim: async (id, sender) => {
      calls.claim++
      const entry = entries.find((entry) => entry.operation.operationId === id)
      if (
        entry?.state !== "pending" ||
        entry.dependencies.some(
          (dep) =>
            entries.find((e) => e.operation.operationId === dep)?.state !==
            "acknowledged"
        )
      )
        return null
      entry.state = "sending"
      entry.attempts++
      entry.lease = { ownerId: sender, expiresAt: "2026-10-11T10:00:00.000Z" }
      return structuredClone(entry)
    },
    release: async (id, sender) => {
      released.push([id, sender])
      const entry = entries.find((entry) => entry.operation.operationId === id)
      if (entry?.state === "sending" && entry.lease?.ownerId === sender) {
        entry.state = "pending"
        entry.lease = null
      }
    },
    pull: async () => {
      calls.pull++
      return {
        version: 2,
        changes: [],
        nextAfter: 0,
        through: 0,
        hasMore: false,
      }
    },
    push: async (input) => {
      sent.push(structuredClone(input.operations[0]))
      return {
        transportVersion: 2,
        status: "complete",
        results: [result(input.operations[0])],
      }
    },
    applyPage: async (receipt) => {
      calls.page++
      cursor = {
        key: "pull-cursor",
        after: receipt.page.nextAfter,
        through: receipt.page.hasMore ? receipt.page.through : null,
      }
    },
    // These test ports simulate commits; actual IndexedDB/Mongo evidence is a separate acceptance criterion.
    applyResult: async (input) => {
      applied.push(input.result)
      const entry = entries.find(
        (entry) => entry.operation.operationId === input.operation.operationId
      )
      if (!entry) throw new Error("Missing fixture intention")
      entry.state = "acknowledged"
      entry.lease = null
      if (
        input.result.kind === "item" &&
        input.result.outcome.status === "applied" &&
        input.result.outcome.item.kind === "plan"
      )
        items[0] = input.result.outcome.item
    },
  }
  return {
    ports,
    items,
    series,
    entries,
    add,
    appearance,
    sent,
    applied,
    released,
    calls,
    result,
    deactivate: () => {
      active = false
    },
  }
}

test("future coordinator advances three families independently of preserved historical blockers", async () => {
  const f = fixture()
  const historical = f.add(f.appearance(false), [], 1)
  const blocked = f.add(
    { type: "item-view.set", itemId: f.series.id, primaryTagId: null },
    [historical]
  )
  const {
    id: _id,
    ownerId: _owner,
    revision: _revision,
    createdAt: _created,
    updatedAt: _updated,
    deletedAt: _deleted,
    completedAt: _completed,
    ...input
  } = f.series
  const root = f.add({ type: "item.create", itemId: f.series.id, input })
  const appearance = f.add(f.appearance(), [root], 1)
  const move = f.add(
    {
      type: "task.move",
      itemId: f.series.id,
      occurrenceId: `${f.series.id}:2026-10-11`,
      scope: "day",
      date: "2026-10-11",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
    [appearance]
  )
  const before = structuredClone([historical, blocked]),
    originals = [root, appearance, move].map((entry) =>
      structuredClone(entry.operation)
    )
  const coordinator = new RecurringSyncCoordinator(actor, f.ports)
  const run = coordinator.run()
  expect(coordinator.run()).toBe(run)
  const result = await run
  expect(result).toMatchObject({
    status: "settled",
    uploaded: 3,
    downloaded: 0,
  })
  expect(f.sent).toEqual(originals)
  expect(f.applied.map((result) => result.kind)).toEqual([
    "item",
    "plan-occurrence",
    "preference",
  ])
  expect([historical, blocked]).toEqual(before)
  expect(result.diagnostics?.unsupported).toHaveLength(1)
  expect(result.diagnostics?.blocked).toHaveLength(1)
  expect(f.released.map(([id]) => id)).toEqual(
    originals.map((operation) => operation.operationId)
  )
})

test("fresh context after claim prevents unsupported appearance transport and releases only its own lease", async () => {
  const f = fixture(),
    entry = f.add(f.appearance(), [], 1),
    original = structuredClone(entry.operation),
    claim = f.ports.claim
  f.ports.claim = async (id, sender) => {
    const value = await claim(id, sender)
    f.items.length = 0
    return value
  }
  const result = await new RecurringSyncCoordinator(actor, f.ports).run()
  expect(result.uploaded).toBe(0)
  expect(f.sent).toEqual([])
  expect(f.applied).toEqual([])
  expect(entry).toMatchObject({
    state: "pending",
    attempts: 1,
    lease: null,
    operation: original,
  })
  expect(f.released).toHaveLength(1)
  expect(f.released[0][0]).toBe(entry.operation.operationId)
})

test("account and stop guards after a network response prevent local ACK", async () => {
  for (const stop of [false, true]) {
    const f = fixture(),
      entry = f.add(f.appearance(), [], 1)
    f.items[0].revision = 1
    const coordinator = new RecurringSyncCoordinator(actor, f.ports),
      push = f.ports.push
    f.ports.push = async (input) => {
      const response = await push(input)
      if (stop) coordinator.stop()
      else f.deactivate()
      return response
    }
    expect((await coordinator.run()).status).toBe(
      stop ? "stopped" : "account_changed"
    )
    expect(f.applied).toEqual([])
    expect(entry.state).toBe("pending")
    expect(entry.operation.command).toMatchObject({
      expectedOccurrenceRevision: 0,
    })
    expect(f.released).toHaveLength(1)
  }
})

test("invalid appearance revisions and incompatible generation-four outcomes never reach the ACK port", async () => {
  for (const invalid of ["revision", "family"] as const) {
    const f = fixture(),
      entry = f.add(f.appearance(), [], 1)
    f.items[0].revision = 1
    f.ports.push = async (input) => {
      f.sent.push(structuredClone(input.operations[0]))
      const result = f.result(input.operations[0])
      if (
        result.kind !== "plan-occurrence" ||
        result.outcome.status !== "applied"
      )
        throw new Error("Expected appearance")
      return {
        transportVersion: 2,
        status: "complete",
        results: [
          invalid === "family"
            ? {
                kind: "item",
                outcome: {
                  operationId: entry.operation.operationId,
                  status: "unsupported",
                },
              }
            : {
                ...result,
                outcome: {
                  ...result.outcome,
                  occurrence: { ...result.outcome.occurrence, revision: 2 },
                },
              },
        ],
      }
    }
    expect(
      (await new RecurringSyncCoordinator(actor, f.ports).run()).status
    ).toBe("retry_later")
    expect(f.applied).toEqual([])
    expect(entry.state).toBe("pending")
    expect(entry.attempts).toBe(1)
  }
})

test("foreign download and changed account block before cursor writes or claims", async () => {
  const f = fixture()
  f.ports.pull = async () => ({
    version: 2,
    changes: [
      {
        version: 2,
        kind: "item",
        recipientUserId: "foreign",
        operationId: crypto.randomUUID(),
        sequence: 1,
        item: { ...f.series, revision: 1 },
      },
    ],
    nextAfter: 1,
    through: 1,
    hasMore: false,
  })
  expect(
    (await new RecurringSyncCoordinator(actor, f.ports).run()).status
  ).toBe("retry_later")
  expect(f.calls.page).toBe(0)
  expect(f.calls.claim).toBe(0)
  const switched = fixture()
  switched.ports.readIdentity = async () => "foreign"
  expect(
    (await new RecurringSyncCoordinator(actor, switched.ports).run()).status
  ).toBe("account_changed")
  expect(switched.calls).toMatchObject({ recover: 0, pull: 0, claim: 0 })
})
