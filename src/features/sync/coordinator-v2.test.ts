import { expect, test } from "bun:test"
import {
  type SyncCoordinatorPortsV2,
  SyncCoordinatorV2,
} from "@/features/sync/coordinator-v2"
import { SyncTransportError } from "@/features/sync/transport-error"
import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const owner = "mixed-coordinator-owner"
const timestamp = "2026-10-09T00:00:00.000Z"
const draft = {
  kind: "task" as const,
  title: "Own task",
  description: "",
  scheduledDate: "2026-10-09",
  status: "not_started" as const,
  checklist: [],
  recurrence: null,
}
function fixture() {
  let active = true
  let cursor: LocalPullCursor = { key: "pull-cursor", after: 0, through: null }
  const entries: OutboxEntry[] = []
  const items: CalendarItem[] = []
  const pushes: SyncOperation[] = []
  const released: [string, string][] = []
  const applied: RemoteOperationResultV2[] = []
  const calls = {
    identity: 0,
    recover: 0,
    cursor: 0,
    pull: 0,
    page: 0,
    queue: 0,
    claim: 0,
  }
  const task = (id: string, revision = 1) => ({
    ...draft,
    id,
    ownerId: owner,
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    completedAt: null,
  })
  function add(
    command: SyncCommand = {
      type: "item.create",
      itemId: crypto.randomUUID(),
      input: draft,
    },
    dependencies: OutboxEntry[] = [],
    state: OutboxEntry["state"] = "pending"
  ) {
    let entityKey =
      "tagId" in command && command.type.startsWith("tag.")
        ? `tag:${command.tagId}`
        : command.type === "item-view.set"
          ? `item-view:${command.itemId}`
          : "itemId" in command
            ? `item:${command.itemId}`
            : ""
    if (command.type === "task.move")
      entityKey = `task-placement:${JSON.stringify([command.occurrenceId ?? command.itemId, command.scope, command.scope === "overdue" ? "0001-01-01" : command.date])}`
    const entry = outboxEntrySchema.parse({
      userId: owner,
      entityKey,
      sequence: entries.length + 1,
      state,
      attempts: state === "sending" ? 1 : 0,
      lease:
        state === "sending"
          ? { ownerId: crypto.randomUUID(), expiresAt: timestamp }
          : null,
      dependencies: dependencies.map((parent) => parent.operation.operationId),
      createdAt: timestamp,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 0,
        command,
      },
    })
    entries.push(entry)
    if (
      "itemId" in command &&
      !items.some((item) => item.id === command.itemId)
    )
      items.push(task(command.itemId, 0))
    return entry
  }
  function result(operation: SyncOperation): RemoteOperationResultV2 {
    const command = operation.command
    if (remoteOperationKind(command) === "item") {
      if (!("itemId" in command)) throw new Error("Expected content identity")
      return {
        kind: "item",
        outcome: {
          operationId: operation.operationId,
          status: "applied",
          sequence: pushes.length,
          item: task(command.itemId, operation.baseRevision + 1),
        },
      }
    }
    const effect =
      command.type === "item-view.set"
        ? {
            store: "itemViews" as const,
            record: {
              userId: owner,
              itemId: command.itemId,
              primaryTagId: command.primaryTagId,
              revision: operation.baseRevision + 1,
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
            },
          }
        : "tagId" in command && command.tagId
          ? {
              store: "tags" as const,
              record: {
                id: command.tagId,
                userId: owner,
                name: "Remote",
                normalizedName: "remote",
                color: "#123456",
                position: 1024,
                revision: operation.baseRevision + 1,
                createdAt: timestamp,
                updatedAt: timestamp,
                deletedAt: null,
              },
            }
          : null
    if (!effect) throw new Error("Expected prepared personal identity")
    return {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: owner,
          operationId: operation.operationId,
          sequence: pushes.length,
          effects: [effect],
        },
      },
    }
  }
  const ports: SyncCoordinatorPortsV2 = {
    isActive: async () => active,
    readIdentity: async () => {
      calls.identity++
      return owner
    },
    recoverExpiredSends: async () => {
      calls.recover++
    },
    readCursor: async () => {
      calls.cursor++
      return structuredClone(cursor)
    },
    pull: async (query) => {
      calls.pull++
      expect(query.limit).toBe(50)
      return {
        version: 2,
        changes: [],
        nextAfter: query.after,
        through: query.after,
        hasMore: false,
      }
    },
    applyPage: async ({ query, page }) => {
      calls.page++
      expect(query.after).toBe(cursor.after)
      cursor = {
        key: "pull-cursor",
        after: page.nextAfter,
        through: page.hasMore ? page.through : null,
      }
    },
    readQueueState: async () => {
      calls.queue++
      return structuredClone({ entries, items })
    },
    claim: async (id, senderId) => {
      calls.claim++
      const entry = entries.find(
        (candidate) => candidate.operation.operationId === id
      )
      if (
        entry?.state !== "pending" ||
        entry.dependencies.some(
          (parentId) =>
            entries.find((parent) => parent.operation.operationId === parentId)
              ?.state !== "acknowledged"
        )
      )
        return null
      entry.state = "sending"
      entry.attempts++
      entry.lease = { ownerId: senderId, expiresAt: timestamp }
      return structuredClone(entry)
    },
    release: async (id, senderId) => {
      released.push([id, senderId])
      const entry = entries.find(
        (candidate) => candidate.operation.operationId === id
      )
      if (entry?.state === "sending" && entry.lease?.ownerId === senderId) {
        entry.state = "pending"
        entry.lease = null
      }
    },
    push: async (input) => {
      expect(input.transportVersion).toBe(2)
      expect(input.expectedUserId).toBe(owner)
      expect(input.operations).toHaveLength(1)
      pushes.push(structuredClone(input.operations[0]))
      return {
        transportVersion: 2,
        status: "complete",
        results: [result(input.operations[0])],
      }
    },
    applyResult: async ({ operation, result }) => {
      applied.push(structuredClone(result))
      const entry = entries.find(
        (candidate) => candidate.operation.operationId === operation.operationId
      )
      if (
        !entry ||
        JSON.stringify(entry.operation) !== JSON.stringify(operation)
      )
        throw new Error("Changed test intention")
      entry.state =
        result.outcome.status === "applied"
          ? "acknowledged"
          : result.outcome.status === "conflict"
            ? "conflict"
            : result.outcome.status === "unsupported"
              ? "pending"
              : "rejected"
      entry.lease = null
      if (result.outcome.status === "applied")
        for (const child of entries)
          if (
            child.state === "pending" &&
            child.attempts === 0 &&
            child.entityKey === entry.entityKey &&
            child.dependencies.includes(operation.operationId)
          )
            child.operation.baseRevision = operation.baseRevision + 1
    },
  }
  return {
    ports,
    entries,
    items,
    pushes,
    released,
    applied,
    calls,
    add,
    task,
    result,
    deactivate: () => {
      active = false
    },
  }
}

test("fresh ACK snapshots unblock categories, views and content without sending historical moves", async () => {
  const value = fixture()
  const blockedMove = value.add({
    type: "task.move",
    itemId: crypto.randomUUID(),
    occurrenceId: null,
    scope: "overdue",
    date: "2026-10-09",
    tagId: null,
    beforeId: null,
    afterId: null,
  })
  const blockedTag = value.add(
    { type: "tag.delete", tagId: crypto.randomUUID() },
    [blockedMove]
  )
  const blockedView = value.add(
    { type: "item-view.set", itemId: crypto.randomUUID(), primaryTagId: null },
    [blockedTag]
  )
  const create = value.add()
  const category = value.add({
    type: "tag.save",
    tagId: crypto.randomUUID(),
    input: { name: "Local", color: "#123456", position: 0 },
  })
  const view = value.add(
    {
      type: "item-view.set",
      itemId:
        "itemId" in create.operation.command
          ? create.operation.command.itemId
          : "",
      primaryTagId:
        "tagId" in category.operation.command
          ? category.operation.command.tagId
          : null,
    },
    [create, category]
  )
  const result = await new SyncCoordinatorV2(owner, value.ports).run()
  expect(result.status).toBe("settled")
  expect(result.uploaded).toBe(3)
  expect(value.pushes.map((operation) => operation.operationId)).toEqual([
    create.operation.operationId,
    category.operation.operationId,
    view.operation.operationId,
  ])
  expect(
    [blockedMove, blockedTag, blockedView].map((entry) => entry.state)
  ).toEqual(["pending", "pending", "pending"])
  expect(result.diagnostics?.personalProjectionBlocked).toBe(true)
  expect(result.diagnostics?.blocked).toHaveLength(2)
  expect(value.calls.queue).toBeGreaterThanOrEqual(6)
})

test("claimed fresh bases are transported and requested identity is released for null, malformed or foreign claims", async () => {
  const valid = fixture()
  const entry = valid.add({ type: "tag.delete", tagId: crypto.randomUUID() })
  const claim = valid.ports.claim
  valid.ports.claim = async (id, sender) => {
    const claimed = await claim(id, sender)
    if (!claimed) return null
    entry.operation.baseRevision = 7
    claimed.operation.baseRevision = 7
    return claimed
  }
  expect((await new SyncCoordinatorV2(owner, valid.ports).run()).uploaded).toBe(
    1
  )
  expect(valid.pushes[0].baseRevision).toBe(7)
  for (const mutation of [
    "null",
    "id",
    "actor",
    "entity",
    "sender",
    "shape",
  ] as const) {
    const value = fixture()
    const requested = value.add()
    const acquire = value.ports.claim
    const foreignId = crypto.randomUUID()
    value.ports.claim = async (id, sender) => {
      const claimed = await acquire(id, sender)
      if (!claimed) throw new Error("Expected claim")
      if (mutation === "null") return null
      if (mutation === "id") claimed.operation.operationId = foreignId
      if (mutation === "actor") claimed.userId = "foreign"
      if (mutation === "entity") claimed.entityKey = `item:${foreignId}`
      if (mutation === "sender" && claimed.lease)
        claimed.lease.ownerId = foreignId
      if (mutation === "shape")
        return { ...claimed, extra: true } as OutboxEntry
      return claimed
    }
    await new SyncCoordinatorV2(owner, value.ports).run()
    expect(value.pushes).toEqual([])
    expect(value.released.map(([id]) => id)).toEqual([
      requested.operation.operationId,
    ])
    expect(value.released.some(([id]) => id === foreignId)).toBe(false)
    expect(requested.state).toBe("pending")
  }
})

test("post-claim unsupported family or changed dependency cannot send an intention", async () => {
  for (const mutation of ["family", "dependency"] as const) {
    const value = fixture()
    const parent = value.add(undefined, [], "acknowledged")
    const entry = value.add(
      {
        type: "item.delete",
        itemId:
          "itemId" in parent.operation.command
            ? parent.operation.command.itemId
            : "",
      },
      [parent]
    )
    const acquire = value.ports.claim
    value.ports.claim = async (id, sender) => {
      const claimed = await acquire(id, sender)
      if (!claimed) return null
      if (mutation === "family") {
        const command = entry.operation.command
        if (!("itemId" in command)) throw new Error("Expected item")
        entry.operation.command = {
          type: "task.move",
          itemId: command.itemId,
          occurrenceId: `${command.itemId}:2026-10-09`,
          scope: "day",
          date: "2026-10-09",
          tagId: null,
          beforeId: null,
          afterId: null,
        }
        claimed.operation = structuredClone(entry.operation)
      } else parent.state = "superseded"
      return claimed
    }
    expect(
      (await new SyncCoordinatorV2(owner, value.ports).run()).uploaded
    ).toBe(0)
    expect(value.pushes).toEqual([])
    expect(entry.state).toBe("pending")
    expect(value.released).toHaveLength(1)
  }
})

test("epoch changes after every asynchronous port stop before the next effect and clear diagnostic claims", async () => {
  for (const point of [
    "readIdentity",
    "readCursor",
    "pull",
    "applyPage",
    "recoverExpiredSends",
    "readQueueState",
    "claim",
    "push",
    "applyResult",
  ] as const) {
    const value = fixture()
    const entry = value.add()
    const original = value.ports[point] as (
      ...args: never[]
    ) => Promise<unknown>
    value.ports[point] = (async (...args: never[]) => {
      const result = await original(...args)
      value.deactivate()
      return result
    }) as never
    const result = await new SyncCoordinatorV2(owner, value.ports).run()
    expect(result.status).toBe("account_changed")
    expect(result.diagnostics).toBeNull()
    expect(value.applied).toHaveLength(point === "applyResult" ? 1 : 0)
    expect(result.uploaded).toBe(point === "applyResult" ? 1 : 0)
    expect(value.calls.page).toBe(
      [
        "applyPage",
        "recoverExpiredSends",
        "readQueueState",
        "claim",
        "push",
        "applyResult",
      ].includes(point) && point !== "recoverExpiredSends"
        ? 1
        : 0
    )
    if (point === "claim" || point === "push" || point === "applyResult")
      expect(value.released.map(([id]) => id)).toEqual([
        entry.operation.operationId,
      ])
  }
})

test("a lost or malformed push response preserves intent and lease recovery while empty retry is valid without ACK", async () => {
  for (const mutation of [
    "lost",
    "empty",
    "foreign",
    "family",
    "missing",
    "extra",
    "store",
  ] as const) {
    const value = fixture()
    const entry = value.add({ type: "tag.delete", tagId: crypto.randomUUID() })
    const before = structuredClone(entry.operation)
    value.ports.push = async (request) => {
      if (mutation === "lost") throw new Error("Response lost")
      if (mutation === "empty")
        return {
          transportVersion: 2,
          status: "retry_later",
          results: [],
          failedOperationId: request.operations[0].operationId,
        }
      const result = value.result(request.operations[0])
      if (result.kind !== "preference" || result.outcome.status !== "applied")
        throw new Error("Expected personal result")
      if (mutation === "foreign") result.outcome.effects.userId = "foreign"
      if (mutation === "store")
        result.outcome.effects.effects.push({
          store: "settings",
          record: {
            userId: owner,
            timeZone: "Europe/Madrid",
            locale: "es-ES",
            weekStartsOn: 1,
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          },
        })
      if (mutation === "family")
        return {
          transportVersion: 2,
          status: "complete",
          results: [
            {
              kind: "item",
              outcome: {
                operationId: entry.operation.operationId,
                status: "unsupported",
              },
            },
          ],
        }
      return {
        transportVersion: 2,
        status: "complete",
        results: mutation === "missing" ? [] : [result],
        ...(mutation === "extra" ? { extra: true } : {}),
      }
    }
    const result = await new SyncCoordinatorV2(owner, value.ports).run()
    expect(result.status).toBe("retry_later")
    expect(result.uploaded).toBe(0)
    expect(value.applied).toEqual([])
    expect(entry.operation).toEqual(before)
    expect(entry.state).toBe("pending")
    expect(entry.lease).toBeNull()
  }
})

test("captured pull checkpoints and supported stores validate before applying any page", async () => {
  for (const mutation of ["checkpoint", "owner", "future", "store"] as const) {
    const value = fixture()
    value.add()
    value.ports.readCursor = async () => ({
      key: "pull-cursor",
      after: 0,
      through: 1,
    })
    value.ports.pull = async (query) => {
      const id = crypto.randomUUID()
      const change =
        mutation === "store"
          ? {
              version: 2,
              kind: "preference",
              recipientUserId: owner,
              operationId: id,
              sequence: 1,
              effects: {
                version: 1,
                userId: owner,
                operationId: id,
                sequence: 1,
                effects: [
                  {
                    store: "settings",
                    record: {
                      userId: owner,
                      timeZone: "Europe/Madrid",
                      locale: "es-ES",
                      weekStartsOn: 1,
                      revision: 1,
                      createdAt: timestamp,
                      updatedAt: timestamp,
                      deletedAt: null,
                    },
                  },
                ],
              },
            }
          : {
              version: mutation === "future" ? 3 : 2,
              kind: "item",
              recipientUserId: mutation === "owner" ? "foreign" : owner,
              operationId: id,
              sequence: 1,
              item: value.task(crypto.randomUUID()),
            }
      return {
        version: 2,
        changes: [change],
        nextAfter: query.after + 1,
        through: mutation === "checkpoint" ? 2 : 1,
        hasMore: mutation === "checkpoint",
      }
    }
    expect((await new SyncCoordinatorV2(owner, value.ports).run()).status).toBe(
      "retry_later"
    )
    expect(value.calls.page).toBe(0)
    expect(value.calls.claim).toBe(0)
  }
})

test("the four page budget is global even when uploading after a fourth caught-up page", async () => {
  for (const initialCaughtUp of [false, true]) {
    const value = fixture()
    value.add()
    let pulls = 0
    value.ports.pull = async (query) => {
      pulls++
      const through = initialCaughtUp ? 4 : 100
      return {
        version: 2,
        changes: [
          {
            version: 2,
            kind: "item",
            recipientUserId: owner,
            operationId: crypto.randomUUID(),
            sequence: query.after + 1,
            item: value.task(crypto.randomUUID()),
          },
        ],
        nextAfter: query.after + 1,
        through,
        hasMore: query.after + 1 < through,
      }
    }
    const result = await new SyncCoordinatorV2(owner, value.ports).run()
    expect(pulls).toBe(4)
    expect(result.downloaded).toBe(4)
    expect(result.status).toBe("more_work")
    expect(result.uploaded).toBe(initialCaughtUp ? 1 : 0)
  }
})

test("five attempts bound a pass and conflicts or unsupported outcomes do not count as uploads", async () => {
  const value = fixture()
  for (let index = 0; index < 6; index++) value.add()
  expect((await new SyncCoordinatorV2(owner, value.ports).run()).status).toBe(
    "more_work"
  )
  expect(value.pushes).toHaveLength(5)
  expect(value.entries[5].state).toBe("pending")
  for (const status of ["conflict", "unsupported"] as const) {
    const blocked = fixture()
    const parent = blocked.add()
    const dependent = blocked.add(
      {
        type: "item-view.set",
        itemId:
          "itemId" in parent.operation.command
            ? parent.operation.command.itemId
            : "",
        primaryTagId: null,
      },
      [parent]
    )
    const independent = blocked.add()
    const send = blocked.ports.push
    blocked.ports.push = async (request) => {
      const operation = request.operations[0]
      if (operation.operationId !== parent.operation.operationId)
        return send(request)
      return {
        transportVersion: 2,
        status: "complete",
        results: [
          {
            kind: "item",
            outcome:
              status === "conflict"
                ? {
                    operationId: operation.operationId,
                    status,
                    current: blocked.task(
                      "itemId" in operation.command
                        ? operation.command.itemId
                        : "",
                      2
                    ),
                  }
                : { operationId: operation.operationId, status },
          },
        ],
      }
    }
    expect(
      (await new SyncCoordinatorV2(owner, blocked.ports).run()).uploaded
    ).toBe(1)
    expect(dependent.state).toBe("pending")
    expect(independent.state).toBe("acknowledged")
    expect(parent.state).toBe(status === "conflict" ? "conflict" : "pending")
  }
})

test("single-flight and stop during a deferred identity or push prevent subsequent effects and release owned leases", async () => {
  for (const point of ["identity", "push"] as const) {
    const value = fixture()
    const entry = value.add()
    let resume: (result: unknown) => void = () => {
      throw new Error("Deferred request is not ready")
    }
    let started: () => void = () => {
      throw new Error("Deferred request was not entered")
    }
    const reached = new Promise<void>((resolve) => {
      started = resolve
    })
    const deferred = new Promise<unknown>((resolve) => {
      resume = resolve
    })
    if (point === "identity")
      value.ports.readIdentity = async () => {
        started()
        return (await deferred) as string
      }
    else
      value.ports.push = async () => {
        started()
        return deferred
      }
    const coordinator = new SyncCoordinatorV2(owner, value.ports)
    const first = coordinator.run()
    expect(coordinator.run()).toBe(first)
    await reached
    coordinator.stop()
    resume(
      point === "identity"
        ? owner
        : {
            transportVersion: 2,
            status: "retry_later",
            results: [],
            failedOperationId: entry.operation.operationId,
          }
    )
    const result = await first
    expect(result.status).toBe("stopped")
    expect(result.diagnostics).toBeNull()
    expect(value.applied).toEqual([])
    expect(value.released).toHaveLength(point === "push" ? 1 : 0)
  }
})

test("transport statuses and invalid identity stop without claiming or fabricating progress", async () => {
  for (const reason of [
    "unauthorized",
    "account_changed",
    "recovery_required",
    "update_required",
    "retry_later",
  ] as const) {
    const value = fixture()
    value.add()
    value.ports.pull = async () => {
      throw new SyncTransportError(reason)
    }
    expect((await new SyncCoordinatorV2(owner, value.ports).run()).status).toBe(
      reason
    )
    expect(value.calls.claim).toBe(0)
  }
  for (const identity of [null, "foreign"]) {
    const value = fixture()
    value.ports.readIdentity = async () => identity
    expect((await new SyncCoordinatorV2(owner, value.ports).run()).status).toBe(
      identity === null ? "unauthorized" : "account_changed"
    )
    expect(value.calls.recover).toBe(0)
  }
})

test("mutable transport arguments cannot change captured checkpoints or submitted intentions", async () => {
  const download = fixture()
  download.ports.readCursor = async () => ({
    key: "pull-cursor",
    after: 0,
    through: 1,
  })
  download.ports.pull = async (query) => {
    query.through = 2
    return {
      version: 2,
      changes: [
        {
          version: 2,
          kind: "item",
          recipientUserId: owner,
          operationId: crypto.randomUUID(),
          sequence: 1,
          item: download.task(crypto.randomUUID()),
        },
      ],
      nextAfter: 1,
      through: 2,
      hasMore: true,
    }
  }
  expect(
    (await new SyncCoordinatorV2(owner, download.ports).run()).status
  ).toBe("retry_later")
  expect(download.calls.page).toBe(0)
  const upload = fixture()
  const entry = upload.add({ type: "tag.delete", tagId: crypto.randomUUID() })
  const before = structuredClone(entry.operation)
  upload.ports.push = async (request) => {
    request.operations[0].operationId = crypto.randomUUID()
    request.operations[0].baseRevision = 999
    upload.pushes.push(request.operations[0])
    return {
      transportVersion: 2,
      status: "complete",
      results: [upload.result(request.operations[0])],
    }
  }
  expect((await new SyncCoordinatorV2(owner, upload.ports).run()).status).toBe(
    "retry_later"
  )
  expect(upload.applied).toEqual([])
  expect(entry.operation).toEqual(before)
})

test("null claims are bounded globally and release only the five requested identities", async () => {
  const value = fixture()
  for (let index = 0; index < 9; index++) value.add()
  value.ports.claim = async () => {
    value.calls.claim++
    return null
  }
  const result = await new SyncCoordinatorV2(owner, value.ports).run()
  expect(result.status).toBe("more_work")
  expect(value.calls.claim).toBe(5)
  expect(value.released.map(([id]) => id)).toEqual(
    value.entries.slice(0, 5).map((entry) => entry.operation.operationId)
  )
  expect(value.pushes).toEqual([])
  expect(value.entries.every((entry) => entry.state === "pending")).toBe(true)
})
