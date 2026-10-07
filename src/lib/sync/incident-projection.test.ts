import { expect, test } from "bun:test"
import { projectSyncIncident } from "@/lib/sync/incident-projection"
import type { Task } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"

const userId = "incident-test"
const itemId = "00000000-0000-4000-8000-000000000001"
const operationId = "00000000-0000-4000-8000-000000000002"
const now = "2026-10-08T00:00:00.000Z"
function item(revision: number, title: string): Task {
  return {
    id: itemId,
    ownerId: userId,
    kind: "task",
    title,
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
    revision,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
function fixture() {
  const input = {
    kind: "task" as const,
    title: "Submitted draft",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started" as const,
    checklist: [],
    recurrence: null,
  }
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${itemId}`,
    operation: {
      protocolVersion: 1,
      operationId,
      baseRevision: 1,
      command: { type: "item.update", itemId, input },
    },
    sequence: 1,
    dependencies: [],
    state: "conflict",
    attempts: 1,
    createdAt: now,
    lease: null,
  }
  return {
    userId,
    entry,
    outcome: {
      key: `operation-outcome:${operationId}`,
      operation: entry.operation,
      result: {
        status: "conflict" as const,
        operationId,
        current: item(2, "Remote at conflict"),
      },
      local: item(1, "Draft at conflict"),
      base: item(2, "Remote at conflict"),
    },
    local: item(1, "Later local draft"),
    remote: item(3, "Later remote version"),
  }
}

test("incident projection preserves later drafts and separates outcome evidence from known remote data", () => {
  const input = fixture()
  const before = JSON.stringify(input)
  const result = projectSyncIncident(input)
  expect(result.reason).toBe("conflict")
  expect(result.local?.title).toBe("Later local draft")
  expect(result.localAtOutcome?.title).toBe("Draft at conflict")
  expect(result.shadowAtOutcome?.revision).toBe(2)
  expect(result.entry.operation.baseRevision).toBe(1)
  expect(result.remote?.revision).toBe(3)
  expect(JSON.stringify(input)).toBe(before)
})
test("remote and local tombstones stay visible without resurrecting either version", () => {
  const input = fixture()
  input.local.deletedAt = now
  input.remote.deletedAt = now
  const result = projectSyncIncident(input)
  expect(result.local?.deletedAt).toBe(now)
  expect(result.remote?.deletedAt).toBe(now)
})

test("a replayed conflict can precede the shadow downloaded before its late response", () => {
  const input = fixture()
  input.outcome.base = item(3, "Downloaded after original conflict")
  input.remote = item(4, "Current shadow")
  expect(projectSyncIncident(input).remote?.revision).toBe(4)
  expect(projectSyncIncident({ ...input, remote: null }).remote?.revision).toBe(
    3
  )
  expect(() =>
    projectSyncIncident({ ...input, remote: input.outcome.result.current })
  ).toThrow()
})
test("rejected operations retain evidence without inventing inaccessible remote data", () => {
  const input = fixture()
  const result = projectSyncIncident({
    ...input,
    entry: { ...input.entry, state: "rejected" },
    remote: null,
    outcome: {
      ...input.outcome,
      result: { operationId, status: "unavailable" },
      base: null,
    },
  })
  expect(result.reason).toBe("unavailable")
  expect(result.remote).toBeNull()
  expect(result.local?.title).toBe("Later local draft")
})
test("foreign identities, modified payloads, missing outcomes and contradictory results reject", () => {
  const input = fixture()
  for (const invalid of [
    { ...input, userId: "other" },
    { ...input, local: { ...input.local, id: crypto.randomUUID() } },
    { ...input, remote: { ...input.remote, ownerId: "other" } },
    { ...input, outcome: { ...input.outcome, key: "wrong" } },
    {
      ...input,
      outcome: {
        ...input.outcome,
        operation: { ...input.entry.operation, baseRevision: 99 },
      },
    },
    { ...input, outcome: null },
    { ...input, entry: { ...input.entry, state: "acknowledged" } },
    { ...input, entry: { ...input.entry, state: "rejected" } },
    { ...input, remote: item(1, "Older remote") },
    { ...input, remote: item(2, "Contradictory remote") },
    { ...input, remote: item(0, "Uncommitted") },
  ])
    expect(() => projectSyncIncident(invalid)).toThrow()
})
