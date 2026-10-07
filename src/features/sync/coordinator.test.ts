import { describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import {
  SyncCoordinator,
  type SyncCoordinatorPorts,
} from "@/features/sync/coordinator"
import { SyncTransportError } from "@/features/sync/transport-error"
import type { Task } from "@/types/calendar-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"
import type { RemoteOperationResult } from "@/types/remote-sync"

const owner = "test-actor"
const now = "2026-10-08T00:00:00.000Z"
function fixture() {
  const id = randomUUID()
  const task: Task = {
    kind: "task",
    id,
    ownerId: owner,
    title: "Test task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const entries: OutboxEntry[] = []
  const pushed: OutboxEntry["operation"][] = []
  let cursor: LocalPullCursor = { key: "pull-cursor", after: 0, through: null }
  const add = (sequence: number, itemId = id) => {
    const {
      id: _id,
      ownerId,
      revision,
      createdAt,
      updatedAt,
      deletedAt,
      completedAt,
      ...input
    } = task
    const entry: OutboxEntry = {
      userId: owner,
      entityKey: `item:${itemId}`,
      sequence,
      state: "pending",
      attempts: 0,
      lease: null,
      dependencies: [],
      createdAt: now,
      operation: {
        operationId: randomUUID(),
        protocolVersion: 1,
        baseRevision: 0,
        command: { type: "item.create", itemId, input },
      },
    }
    entries.push(entry)
    return entry
  }
  const ports: SyncCoordinatorPorts = {
    isActive: async () => true,
    readIdentity: async () => owner,
    pull: async () => ({
      changes: [],
      nextAfter: cursor.after,
      through: cursor.after,
      hasMore: false,
    }),
    push: async (input) => {
      expect(input.expectedUserId).toBe(owner)
      expect(input.operations).toHaveLength(1)
      pushed.push(structuredClone(input.operations[0]))
      return {
        status: "complete",
        results: [
          {
            status: "applied",
            operationId: input.operations[0].operationId,
            sequence: pushed.length,
            item: {
              ...task,
              revision: input.operations[0].baseRevision + 1,
              id:
                "itemId" in input.operations[0].command
                  ? input.operations[0].command.itemId
                  : id,
            },
          },
        ],
      }
    },
    readCursor: async () => cursor,
    applyPage: async (input) => {
      const page = input as {
        page: { nextAfter: number; through: number; hasMore: boolean }
      }
      cursor = {
        key: "pull-cursor",
        after: page.page.nextAfter,
        through: page.page.hasMore ? page.page.through : null,
      }
    },
    listEntries: async () => structuredClone(entries),
    readItem: async (itemId) => ({ ...task, id: itemId }),
    recoverExpiredSends: async () => undefined,
    claim: async (operationId, senderId) => {
      const entry = entries.find(
        (item) => item.operation.operationId === operationId
      )
      if (
        entry?.state !== "pending" ||
        entry.dependencies.some(
          (dep) =>
            entries.find((item) => item.operation.operationId === dep)
              ?.state !== "acknowledged"
        )
      )
        return null
      entry.state = "sending"
      entry.attempts++
      entry.lease = { ownerId: senderId, expiresAt: now }
      return structuredClone(entry)
    },
    release: async (operationId, senderId) => {
      const entry = entries.find(
        (item) => item.operation.operationId === operationId
      )
      if (entry?.state === "sending" && entry.lease?.ownerId === senderId) {
        entry.state = "pending"
        entry.lease = null
      }
    },
    applyResult: async ({ operation, result }) => {
      const entry = entries.find(
        (item) => item.operation.operationId === operation.operationId
      )
      if (!entry) throw new Error("Missing test entry")
      entry.state = result.status === "applied" ? "acknowledged" : "conflict"
      entry.lease = null
      if (result.status === "applied")
        for (const candidate of entries)
          if (candidate.dependencies.includes(operation.operationId))
            candidate.operation.baseRevision = result.item.revision
    },
  }
  return { ports, entries, pushed, task, add }
}

describe("bounded sync coordinator", () => {
  test("authentication and future cursor transport errors stop before claims", async () => {
    for (const reason of [
      "unauthorized",
      "account_changed",
      "recovery_required",
    ] as const) {
      const value = fixture()
      const entry = value.add(1)
      value.ports.pull = async () => {
        throw new SyncTransportError(reason)
      }
      expect((await new SyncCoordinator(owner, value.ports).run()).status).toBe(
        reason
      )
      expect(entry.attempts).toBe(0)
    }
  })
  test("missing or changed identity never claims or uploads local data", async () => {
    for (const identity of [null, "other-actor"]) {
      const value = fixture()
      value.add(1)
      value.ports.readIdentity = async () => identity
      const result = await new SyncCoordinator(owner, value.ports).run()
      expect(result.status).toBe(identity ? "account_changed" : "unauthorized")
      expect(value.pushed).toEqual([])
      expect(value.entries[0].attempts).toBe(0)
    }
  })
  test("rereads dependent bases after ACK and never sends unsupported occurrences", async () => {
    const value = fixture()
    const first = value.add(1)
    const next = value.add(2)
    next.operation.command = {
      type: "task.set-status",
      itemId: value.task.id,
      occurrenceId: null,
      status: "completed",
    }
    next.dependencies = [first.operation.operationId]
    const unsupported = value.add(3)
    unsupported.operation.command = {
      type: "task.set-status",
      itemId: value.task.id,
      occurrenceId: `${value.task.id}:2026-10-08`,
      status: "completed",
    }
    const result = await new SyncCoordinator(owner, value.ports).run()
    expect(result.uploaded).toBe(2)
    expect(value.pushed.map((item) => item.baseRevision)).toEqual([0, 1])
    expect(unsupported.state).toBe("pending")
    expect(unsupported.attempts).toBe(0)
  })
  test("lost responses release the lease and preserve the exact payload on retry", async () => {
    const value = fixture()
    const first = value.add(1)
    const send = value.ports.push
    const attempts: unknown[] = []
    value.ports.push = async (input) => {
      attempts.push(structuredClone(input))
      if (attempts.length === 1) throw new Error("Response was lost")
      return send(input)
    }
    const coordinator = new SyncCoordinator(owner, value.ports)
    expect((await coordinator.run()).status).toBe("retry_later")
    expect(first.state).toBe("pending")
    expect(first.attempts).toBe(1)
    expect((await coordinator.run()).uploaded).toBe(1)
    expect(attempts[0]).toEqual(attempts[1])
  })
  test("concurrent runs coalesce and stop prevents effects after a pending request", async () => {
    const value = fixture()
    value.add(1)
    let resume: (value: string) => void = () => {
      throw new Error("Deferred identity is not ready")
    }
    const identity = new Promise<string>((resolve) => {
      resume = resolve
    })
    let reads = 0
    value.ports.readIdentity = async () => {
      reads++
      return identity
    }
    const coordinator = new SyncCoordinator(owner, value.ports)
    const first = coordinator.run()
    const second = coordinator.run()
    expect(first).toBe(second)
    await Promise.resolve()
    coordinator.stop()
    resume(owner)
    expect((await first).status).toBe("stopped")
    expect(reads).toBe(1)
    expect(value.entries[0].attempts).toBe(0)
    expect(value.pushed).toEqual([])
  })
  test("stop during an asynchronous account check prevents the identity request", async () => {
    const value = fixture()
    let resume: (current: boolean) => void = () => {
      throw new Error("Deferred account is not ready")
    }
    const active = new Promise<boolean>((resolve) => {
      resume = resolve
    })
    value.ports.isActive = async () => active
    value.ports.readIdentity = async () => {
      throw new Error("Identity request must not run after stop")
    }
    const coordinator = new SyncCoordinator(owner, value.ports)
    const work = coordinator.run()
    coordinator.stop()
    resume(true)
    expect((await work).status).toBe("stopped")
  })

  test("large downloads stop after four pages before claiming pending writes", async () => {
    const value = fixture()
    value.add(1)
    let pages = 0
    value.ports.pull = async (cursor) => {
      pages++
      return {
        changes: [
          {
            recipientUserId: owner,
            sequence: cursor.after + 1,
            operationId: randomUUID(),
            item: { ...value.task, revision: cursor.after + 1 },
          },
        ],
        nextAfter: cursor.after + 1,
        through: 100,
        hasMore: true,
      }
    }
    const result = await new SyncCoordinator(owner, value.ports).run()
    expect(result).toEqual({ status: "more_work", uploaded: 0, downloaded: 4 })
    expect(pages).toBe(4)
    expect(value.entries[0].attempts).toBe(0)
  })
  test("the operation budget and conflicts preserve independent progress", async () => {
    const value = fixture()
    for (let index = 1; index <= 6; index++) value.add(index, randomUUID())
    const result = await new SyncCoordinator(owner, value.ports).run()
    expect(result.status).toBe("more_work")
    expect(value.pushed).toHaveLength(5)
    expect(value.entries[5].state).toBe("pending")
    const conflict = fixture()
    const parent = conflict.add(1)
    const dependent = conflict.add(2)
    dependent.dependencies = [parent.operation.operationId]
    dependent.operation.command = {
      type: "item.delete",
      itemId: conflict.task.id,
    }
    const independent = conflict.add(3, randomUUID())
    const normalSend = conflict.ports.push
    conflict.ports.push = async (input) =>
      input.operations[0].operationId === parent.operation.operationId
        ? {
            status: "complete",
            results: [
              {
                status: "conflict",
                operationId: parent.operation.operationId,
                current: { ...conflict.task, revision: 2 },
              } satisfies RemoteOperationResult,
            ],
          }
        : normalSend(input)
    expect(
      (await new SyncCoordinator(owner, conflict.ports).run()).uploaded
    ).toBe(1)
    expect(parent.state).toBe("conflict")
    expect(dependent.state).toBe("pending")
    expect(independent.state).toBe("acknowledged")
  })
})
