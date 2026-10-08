import { expect, test } from "bun:test"
import {
  availableSyncIncidentResolutionChoices,
  planSyncIncidentResolution,
} from "@/lib/sync/incident-resolution"
import {
  syncResolutionRecordSchema,
  syncResolutionRequestSchema,
} from "@/schemas/sync-resolution"
import type { Task } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

function fixture() {
  const userId = "resolution-test"
  const now = "2026-10-08T00:00:00.000Z"
  const local: Task = {
    id: crypto.randomUUID(),
    ownerId: userId,
    kind: "task",
    title: "Latest draft",
    description: "Preserved notes",
    scheduledDate: "2026-10-08",
    status: "in_progress",
    checklist: [
      { id: crypto.randomUUID(), text: "Local point", completed: true },
    ],
    recurrence: null,
    completedAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${local.id}`,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: {
        type: "task.set-status",
        itemId: local.id,
        occurrenceId: null,
        status: "in_progress",
      },
    },
    sequence: 1,
    dependencies: [],
    state: "conflict",
    attempts: 1,
    createdAt: now,
    lease: null,
  }
  const dependent: OutboxEntry = {
    ...entry,
    operation: { ...entry.operation, operationId: crypto.randomUUID() },
    sequence: 2,
    dependencies: [entry.operation.operationId],
    attempts: 0,
    state: "pending",
  }
  const remote = {
    ...local,
    title: "Latest remote",
    revision: 3,
    checklist: [],
    status: "not_started" as const,
  }
  const current = {
    entry,
    reason: "conflict",
    local,
    localAtOutcome: { ...local, title: "Older draft" },
    shadowAtOutcome: { ...remote, revision: 2 },
    remote,
    intentions: [entry, dependent],
    blockedByRelatedIntentions: false,
  } satisfies SyncIncidentSnapshot
  const request = {
    userId,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    choice: "retry_local" as const,
    createdAt: "2026-10-08T00:30:00.000Z",
    expected: current,
  }
  return { current, request, now }
}

test("remote adoption preserves original intentions as evidence without inventing a server ACK", () => {
  const { current, request } = fixture()
  const before = JSON.stringify(current)
  const record = planSyncIncidentResolution(
    { ...request, choice: "adopt_remote", operationId: null },
    current
  )
  expect(record.local).toEqual(current.remote)
  expect(record.replacement).toBeNull()
  expect(record.expected.intentions[0].state).toBe("conflict")
  expect(record.expected.intentions[1].state).toBe("pending")
  expect(record.supersededOperationIds).toEqual(
    current.intentions.map((entry) => entry.operation.operationId)
  )
  expect(JSON.stringify(current)).toBe(before)
})

test("explicit full draft retry creates a fresh operation on the newest known remote revision", () => {
  const { current, request } = fixture()
  const record = planSyncIncidentResolution(request, current)
  expect(record.replacement?.operationId).toBe(request.operationId)
  expect(record.replacement?.baseRevision).toBe(3)
  expect(record.replacement?.command).toMatchObject({
    type: "item.update",
    input: {
      title: "Latest draft",
      status: "in_progress",
      checklist: current.local?.kind === "task" ? current.local.checklist : [],
    },
  })
  expect(record.local.revision).toBe(3)
  expect(record.local.createdAt).toBe(current.remote?.createdAt)
  expect(record.local.updatedAt).toBe(request.createdAt)
  expect(record.expected.entry.operation.baseRevision).toBe(1)
})

test("local deletion creates a fresh delete and remote tombstones can only be adopted", () => {
  const { current, request, now } = fixture()
  const deleted = { ...current, local: { ...current.local, deletedAt: now } }
  const record = planSyncIncidentResolution(
    { ...request, expected: deleted },
    deleted
  )
  expect(record.replacement?.command.type).toBe("item.delete")
  expect(record.local.deletedAt).toBe(request.createdAt)
  const remoteDeleted = {
    ...current,
    remote: { ...current.remote, deletedAt: now },
  }
  expect(() =>
    planSyncIncidentResolution(
      { ...request, expected: remoteDeleted },
      remoteDeleted
    )
  ).toThrow("resurrected")
  expect(
    planSyncIncidentResolution(
      {
        ...request,
        expected: remoteDeleted,
        choice: "adopt_remote",
        operationId: null,
      },
      remoteDeleted
    ).local.deletedAt
  ).toBe(now)
})

test("unseen edits or remote advances invalidate the exact expected comparison", () => {
  const { current, request } = fixture()
  for (const changed of [
    { ...current, local: { ...current.local, title: "New edit" } },
    { ...current, remote: { ...current.remote, revision: 4 } },
    { ...current, intentions: [current.entry] },
  ])
    expect(() => planSyncIncidentResolution(request, changed)).toThrow(
      "changed"
    )
})

test("foreign, active, unsupported or reused identities cannot produce a resolution plan", () => {
  const { current, request } = fixture()
  const invalid = [
    {
      ...current,
      reason: "unavailable",
      entry: { ...current.entry, state: "rejected" },
    },
    { ...current, remote: null },
    { ...current, local: { ...current.local, ownerId: "other" } },
    { ...current, remote: { ...current.remote, revision: 0 } },
    {
      ...current,
      intentions: [
        current.entry,
        {
          ...current.intentions[1],
          state: "sending",
          lease: { ownerId: crypto.randomUUID(), expiresAt: request.createdAt },
        },
      ],
    },
    { ...current, intentions: [current.entry, current.entry] },
    { ...current, intentions: [current.intentions[1]] },
    { ...current, intentions: [{ ...current.entry, userId: "other" }] },
    {
      ...current,
      intentions: [
        {
          ...current.entry,
          operation: {
            ...current.entry.operation,
            command: {
              type: "task.cancel-occurrence",
              itemId: current.local.id,
              occurrenceId: crypto.randomUUID(),
            },
          },
        },
      ],
    },
  ]
  for (const changed of invalid)
    expect(() =>
      planSyncIncidentResolution({ ...request, expected: changed }, changed)
    ).toThrow()
  expect(() =>
    planSyncIncidentResolution(
      { ...request, operationId: current.entry.operation.operationId },
      current
    )
  ).toThrow("new")
  expect(() =>
    planSyncIncidentResolution(
      { ...request, resolutionId: current.entry.operation.operationId },
      current
    )
  ).toThrow("new")
  expect(() =>
    planSyncIncidentResolution(
      { ...request, operationId: request.resolutionId },
      current
    )
  ).toThrow("distinct")
  expect(() =>
    planSyncIncidentResolution({ ...request, choice: "adopt_remote" }, current)
  ).toThrow()
})

test("a dependent operation with an uncertain earlier send cannot be superseded", () => {
  const { current, request } = fixture()
  const changed = {
    ...current,
    intentions: [current.entry, { ...current.intentions[1], attempts: 1 }],
  }
  expect(() =>
    planSyncIncidentResolution({ ...request, expected: changed }, changed)
  ).toThrow()
})

test("UI choices follow the executor contract for tombstones, related intentions and unsupported incidents", () => {
  const { current, request, now } = fixture()
  expect(availableSyncIncidentResolutionChoices(current)).toEqual([
    "adopt_remote",
    "retry_local",
  ])
  expect(
    availableSyncIncidentResolutionChoices({
      ...current,
      remote: { ...current.remote, deletedAt: now },
    })
  ).toEqual(["adopt_remote"])
  const blocked = { ...current, blockedByRelatedIntentions: true }
  expect(availableSyncIncidentResolutionChoices(blocked)).toEqual([])
  expect(() =>
    planSyncIncidentResolution({ ...request, expected: blocked }, blocked)
  ).toThrow("related")
  expect(
    availableSyncIncidentResolutionChoices({ ...current, remote: null })
  ).toEqual([])
  expect(
    availableSyncIncidentResolutionChoices({
      ...current,
      reason: "unavailable",
    })
  ).toEqual([])
})

test("explicit copy uses a fresh item and operation while preserving the original remote tombstone", () => {
  const { current, request, now } = fixture()
  const deleted = { ...current, remote: { ...current.remote, deletedAt: now } }
  const input = {
    ...request,
    expected: deleted,
    choice: "copy_local",
    copyItemId: crypto.randomUUID(),
  }
  const before = JSON.stringify(deleted)
  const record = planSyncIncidentResolution(input, deleted)
  expect(record.local).toEqual(deleted.remote)
  expect(record.copy?.id).toBe(input.copyItemId)
  expect(record.copy?.deletedAt).toBeNull()
  expect(record.copy?.revision).toBe(0)
  expect(record.copy?.title).toBe("Latest draft")
  expect(record.copy?.kind === "task" ? record.copy.checklist : []).toEqual(
    current.local.checklist
  )
  expect(record.replacement).toMatchObject({
    operationId: input.operationId,
    baseRevision: 0,
    command: { type: "item.create", itemId: input.copyItemId },
  })
  expect(record.supersededOperationIds).toEqual(
    current.intentions.map((entry) => entry.operation.operationId)
  )
  expect(JSON.stringify(deleted)).toBe(before)
})

test("copy refuses live remote records, deleted drafts and reused copy identities", () => {
  const { current, request, now } = fixture()
  const deleted = { ...current, remote: { ...current.remote, deletedAt: now } }
  const input = {
    ...request,
    expected: deleted,
    choice: "copy_local",
    copyItemId: crypto.randomUUID(),
  }
  for (const changed of [
    current,
    { ...deleted, local: { ...deleted.local, deletedAt: now } },
  ])
    expect(() =>
      planSyncIncidentResolution({ ...input, expected: changed }, changed)
    ).toThrow()
  for (const copyItemId of [
    current.local.id,
    request.resolutionId,
    request.operationId,
    current.entry.operation.operationId,
    null,
  ])
    expect(() =>
      planSyncIncidentResolution({ ...input, copyItemId }, deleted)
    ).toThrow()
  expect(() =>
    planSyncIncidentResolution(
      { ...request, copyItemId: crypto.randomUUID() },
      current
    )
  ).toThrow()
})

test("nullable copy defaults preserve request and durable evidence compatibility", () => {
  const { current, request } = fixture()
  const record = planSyncIncidentResolution(request, current)
  const { copy: _copy, copyItemId: _copyItemId, ...legacy } = record
  expect(syncResolutionRecordSchema.parse(legacy).copy).toBeNull()
  expect(syncResolutionRecordSchema.parse(legacy).copyItemId).toBeNull()
  expect(syncResolutionRequestSchema.parse(request).copyItemId).toBeNull()
  expect(
    syncResolutionRecordSchema.safeParse({ ...record, copy: current.local })
      .success
  ).toBe(false)
})
