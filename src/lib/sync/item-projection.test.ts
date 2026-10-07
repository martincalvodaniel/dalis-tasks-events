import { describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { planRemoteItemProjection } from "@/lib/sync/item-projection"
import type { Task } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"

const now = "2026-10-08T00:00:00.000Z"
const id = randomUUID()
const remote: Task = {
  id,
  ownerId: "test-actor",
  kind: "task",
  title: "Remote task",
  description: "",
  scheduledDate: "2026-10-08",
  status: "not_started",
  checklist: [],
  recurrence: null,
  completedAt: null,
  revision: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
function entry(): OutboxEntry {
  return {
    userId: remote.ownerId,
    entityKey: `item:${id}`,
    operation: {
      operationId: randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "task.set-status",
        itemId: id,
        occurrenceId: null,
        status: "completed",
      },
    },
    sequence: 1,
    dependencies: [],
    state: "pending",
    attempts: 0,
    createdAt: now,
    lease: null,
  }
}
function input() {
  return {
    userId: remote.ownerId,
    local: remote,
    shadow: remote,
    incoming: { ...remote, revision: 2, title: "Other device edit" },
    entries: [] as OutboxEntry[],
  }
}

describe("conservative remote item projection", () => {
  test("without pending work adopts newer remote state and tombstones", () => {
    const value = input()
    expect(planRemoteItemProjection(value)).toEqual({
      local: value.incoming,
      shadow: value.incoming,
      pending: false,
    })
    const deleted = { ...value.incoming, deletedAt: now }
    expect(
      planRemoteItemProjection({ ...value, incoming: deleted }).local
    ).toEqual(deleted)
    expect(
      planRemoteItemProjection({ ...value, local: null, shadow: null }).local
    ).toEqual(value.incoming)
  })
  test("preserves the complete optimistic record for every unacknowledged state", () => {
    const local = {
      ...remote,
      title: "Local draft",
      description: "Pending detail",
      status: "completed" as const,
      completedAt: now,
    }
    for (const state of [
      "pending",
      "conflict",
      "rejected",
      "sending",
    ] as const) {
      const operation = {
        ...entry(),
        state,
        lease:
          state === "sending"
            ? { ownerId: randomUUID(), expiresAt: now }
            : null,
      }
      const value = { ...input(), local, entries: [operation] }
      const original = JSON.stringify(value)
      expect(planRemoteItemProjection(value)).toEqual({
        local,
        shadow: value.incoming,
        pending: true,
      })
      expect(JSON.stringify(value)).toBe(original)
    }
    const deleted = { ...local, deletedAt: now }
    expect(
      planRemoteItemProjection({
        ...input(),
        local: deleted,
        entries: [entry()],
      }).local
    ).toEqual(deleted)
    const created = { ...local, revision: 0 }
    expect(
      planRemoteItemProjection({
        ...input(),
        local: created,
        shadow: null,
        entries: [entry()],
      }).local
    ).toEqual(created)
    expect(
      planRemoteItemProjection({ ...input(), local: null, entries: [entry()] })
        .local
    ).toBeNull()
  })
  test("acknowledged history does not block projection and older responses cannot regress shadow", () => {
    const value = input()
    expect(
      planRemoteItemProjection({
        ...value,
        entries: [{ ...entry(), state: "acknowledged" }],
      }).pending
    ).toBe(false)
    expect(
      planRemoteItemProjection({
        ...value,
        shadow: value.incoming,
        incoming: remote,
      }).shadow
    ).toEqual(value.incoming)
    expect(
      planRemoteItemProjection({
        ...value,
        shadow: value.incoming,
        incoming: remote,
      }).local
    ).toEqual(value.incoming)
    expect(
      planRemoteItemProjection({ ...value, incoming: remote }).shadow
    ).toEqual(remote)
    expect(() =>
      planRemoteItemProjection({
        ...value,
        incoming: { ...remote, title: "Contradictory record" },
      })
    ).toThrow("same revision")
  })
  test("rejects foreign, corrupt, mismatched and duplicated records before returning a projection", () => {
    const value = input()
    const pending = entry()
    for (const invalid of [
      { ...value, incoming: { ...remote, ownerId: "other" } },
      { ...value, local: { ...remote, id: randomUUID() } },
      { ...value, shadow: { ...remote, title: 123 } },
      { ...value, incoming: { ...remote, revision: 0 } },
      { ...value, entries: [{ ...pending, userId: "other" }] },
      { ...value, entries: [pending, pending] },
      { ...value, entries: [pending, { ...entry(), sequence: 1 }] },
    ]) {
      expect(() => planRemoteItemProjection(invalid)).toThrow()
    }
  })
})
