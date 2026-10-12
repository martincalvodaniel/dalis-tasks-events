import { expect, test } from "bun:test"
import { readSettingsSyncQueueSummary } from "@/features/sync/mixed-sync-summary"
import {
  RecurringSyncCoordinator,
  type RecurringSyncCoordinatorPorts,
} from "@/features/sync/recurring-coordinator"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import { recurringSyncCapabilityPolicy } from "@/lib/sync/recurring-sync-capabilities"
import {
  settingsSyncCapabilityPolicy,
  settingsSyncCapabilityRegistry,
} from "@/lib/sync/settings-sync-capabilities"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"

const actor = "settings-coordinator-owner",
  now = "2026-10-12T12:00:00.000Z"
function fixture() {
  const entries: OutboxEntry[] = [
    outboxEntrySchema.parse({
      userId: actor,
      entityKey: userSettingsEntityKey(actor),
      sequence: 1,
      dependencies: [],
      state: "pending",
      attempts: 0,
      lease: null,
      createdAt: now,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 0,
        command: {
          type: "settings.update",
          input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
        },
      },
    }),
  ]
  const calls = { push: 0, claim: 0, apply: 0, pages: 0, release: 0 },
    sent: unknown[] = []
  let active = true,
    cursor: LocalPullCursor = { key: "pull-cursor", after: 0, through: null }
  const ports: RecurringSyncCoordinatorPorts = {
    isActive: async () => active,
    readIdentity: async () => actor,
    readCursor: async () => cursor,
    recoverExpiredSends: async () => {},
    readQueueState: async () => structuredClone({ entries, items: [] }),
    claim: async (id, sender) => {
      calls.claim++
      const entry = entries.find((value) => value.operation.operationId === id)
      if (entry?.state !== "pending") return null
      entry.state = "sending"
      entry.attempts++
      entry.lease = { ownerId: sender, expiresAt: "2026-10-12T12:01:00.000Z" }
      return structuredClone(entry)
    },
    release: async (id, sender) => {
      calls.release++
      const entry = entries.find((value) => value.operation.operationId === id)
      if (entry?.state === "sending" && entry.lease?.ownerId === sender) {
        entry.state = "pending"
        entry.lease = null
      }
    },
    pull: async () => ({
      version: 2,
      changes: [],
      nextAfter: cursor.after,
      through: cursor.after,
      hasMore: false,
    }),
    push: async (input) => {
      calls.push++
      sent.push(structuredClone(input.operations[0]))
      const operation = input.operations[0]
      return {
        transportVersion: 2,
        status: "complete",
        results: [
          {
            kind: "preference",
            outcome: {
              operationId: operation.operationId,
              status: "applied",
              effects: {
                version: 1,
                userId: actor,
                operationId: operation.operationId,
                sequence: 1,
                effects: [
                  {
                    store: "settings",
                    record: {
                      userId: actor,
                      timeZone: "UTC",
                      weekStartsOn: 1,
                      locale: "es-ES",
                      revision: 1,
                      createdAt: now,
                      updatedAt: now,
                      deletedAt: null,
                    },
                  },
                ],
              },
            },
          },
        ],
      }
    },
    // Test ports simulate durable consumers; IndexedDB and Mongo evidence are separate.
    applyResult: async (input) => {
      calls.apply++
      const entry = entries.find(
        (value) => value.operation.operationId === input.operation.operationId
      )
      if (!entry) throw new Error("Missing settings fixture intention")
      entry.state = "acknowledged"
      entry.lease = null
    },
    applyPage: async (receipt) => {
      calls.pages++
      cursor = {
        key: "pull-cursor",
        after: receipt.page.nextAfter,
        through: receipt.page.hasMore ? receipt.page.through : null,
      }
    },
  }
  return {
    entries,
    ports,
    calls,
    sent,
    deactivate: () => {
      active = false
    },
  }
}
test("prepared settings policy is frozen, preserves other capability decisions and keeps generation five strict", () => {
  const value = fixture(),
    command = value.entries[0].operation.command
  expect(recurringSyncCapabilityPolicy.readCommand(command).supported).toBe(
    false
  )
  expect(settingsSyncCapabilityPolicy.readCommand(command)).toMatchObject({
    kind: "preference",
    store: "settings",
    supported: true,
    requiresRemoteValidation: true,
  })
  expect(
    Object.isFrozen(settingsSyncCapabilityRegistry.commands["settings.update"])
  ).toBe(true)
  expect(settingsSyncCapabilityPolicy.stores).toContain("settings")
  const old = {
    type: "task.cancel-occurrence",
    itemId: crypto.randomUUID(),
    occurrenceId: `${crypto.randomUUID()}:2026-10-12`,
  } as const
  expect(settingsSyncCapabilityPolicy.readCommand(old)).toEqual(
    recurringSyncCapabilityPolicy.readCommand(old)
  )
  expect(() =>
    settingsSyncCapabilityPolicy.readCommand({
      ...command,
      input: { timeZone: "Invalid/Zone", weekStartsOn: 1, locale: "es-ES" },
    })
  ).toThrow()
})
test("diagnostic and summary select the same settings policy independently of blocked category", async () => {
  const value = fixture(),
    tagId = crypto.randomUUID()
  value.entries.push(
    outboxEntrySchema.parse({
      ...value.entries[0],
      entityKey: `tag:${tagId}`,
      sequence: 2,
      state: "conflict",
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 0,
        command: { type: "tag.delete", tagId },
      },
    })
  )
  const state = { userId: actor, items: [], entries: value.entries }
  expect(
    diagnosePersonalQueue(state, settingsSyncCapabilityPolicy).ready
  ).toHaveLength(1)
  expect(
    diagnosePersonalQueue(state, recurringSyncCapabilityPolicy).unsupported
  ).toHaveLength(1)
  let closed = 0
  const summary = await readSettingsSyncQueueSummary(
    { userId: actor, epoch: crypto.randomUUID() },
    {
      requireActive: async () => {},
      openStore: async () => ({
        readQueueState: async () => state,
        close: () => {
          closed++
        },
      }),
    }
  )
  expect(summary.ready).toBe(1)
  expect(closed).toBe(1)
})
test("default coordinator never claims settings; explicit future coordinator preserves payload and processes its consumer", async () => {
  const old = fixture(),
    future = fixture(),
    operation = structuredClone(future.entries[0].operation)
  await new RecurringSyncCoordinator(actor, old.ports).run()
  expect(old.calls.claim).toBe(0)
  expect(old.calls.push).toBe(0)
  const pass = await new RecurringSyncCoordinator(
    actor,
    future.ports,
    undefined,
    true
  ).run()
  expect(pass.uploaded).toBe(1)
  expect(future.sent).toEqual([operation])
  expect(future.calls.apply).toBe(1)
})
test("changed operation after claim is released without sending or applying a result", async () => {
  const value = fixture(),
    claim = value.ports.claim
  value.ports.claim = async (id, sender) => {
    const entry = await claim(id, sender)
    return entry
      ? { ...entry, operation: { ...entry.operation, baseRevision: 7 } }
      : null
  }
  await new RecurringSyncCoordinator(actor, value.ports, undefined, true).run()
  expect(value.calls.push).toBe(0)
  expect(value.calls.apply).toBe(0)
  expect(value.calls.release).toBeGreaterThan(0)
  expect(value.entries[0].state).toBe("pending")
})
test("account closure during an in-flight settings response preserves pending intention and releases only its lease", async () => {
  const value = fixture(),
    push = value.ports.push,
    operation = structuredClone(value.entries[0].operation)
  value.ports.push = async (input) => {
    const response = await push(input)
    value.deactivate()
    return response
  }
  const pass = await new RecurringSyncCoordinator(
    actor,
    value.ports,
    undefined,
    true
  ).run()
  expect(pass.status).toBe("account_changed")
  expect(value.calls.apply).toBe(0)
  expect(value.entries[0].state).toBe("pending")
  expect(value.entries[0].operation).toEqual(operation)
})
