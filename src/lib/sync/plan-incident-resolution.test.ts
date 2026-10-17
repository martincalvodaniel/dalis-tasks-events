import { expect, test } from "bun:test"
import {
  availableSyncIncidentResolutionChoices,
  planSyncIncidentResolution,
} from "@/lib/sync/incident-resolution"
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

for (const variant of ["task", "event", "appointment", "note"] as const) {
  test(`${variant} recovery keeps every common field and requires explicit opt-in`, () => {
    const { local, remote, current, request } = fixture(variant),
      before = JSON.stringify(current)
    expect(availableSyncIncidentResolutionChoices(current)).toEqual([])
    expect(() => planSyncIncidentResolution(request, current)).toThrow()
    expect(availableSyncIncidentResolutionChoices(current, true)).toEqual([
      "adopt_remote",
      "retry_local",
    ])
    const adopt = planSyncIncidentResolution(
      { ...request, choice: "adopt_remote", operationId: null },
      current,
      true
    )
    expect(adopt.local).toEqual(remote)
    expect(adopt.replacement).toBeNull()
    expect(adopt.supersededOperationIds).toEqual(
      current.intentions.map((e) => e.operation.operationId)
    )
    const retry = planSyncIncidentResolution(request, current, true)
    expect(retry.replacement?.baseRevision).toBe(5)
    expect(retry.replacement?.command.type).toBe("item.update")
    expect(retry.local.kind).toBe("plan")
    expect({
      ...retry.local,
      updatedAt: local.updatedAt,
      revision: local.revision,
    }).toEqual(local)
    expect(JSON.stringify(current)).toBe(before)
  })
  test(`${variant} remote deletion creates a distinct copy without resurrection`, () => {
    const { current, request, local, remote } = fixture(variant)
    current.remote = { ...remote, deletedAt: request.createdAt }
    expect(availableSyncIncidentResolutionChoices(current, true)).toEqual([
      "adopt_remote",
      "copy_local",
    ])
    const copyId = crypto.randomUUID()
    const result = planSyncIncidentResolution(
      { ...request, choice: "copy_local", copyItemId: copyId },
      current,
      true
    )
    expect(result.local).toEqual(current.remote)
    expect(result.copy).toMatchObject({
      id: copyId,
      kind: "plan",
      variant,
      status: local.status,
      checklist: local.checklist,
      schedule: local.schedule,
      revision: 0,
      deletedAt: null,
    })
    expect(result.replacement).toMatchObject({
      baseRevision: 0,
      command: { type: "item.create", itemId: copyId },
    })
    expect(() => planSyncIncidentResolution(request, current, true)).toThrow()
  })
}

test("plan recovery rejects series, personal commands, foreign identities and uncertain chains", () => {
  for (const change of [
    (v: SyncIncidentSnapshot) => {
      v.blockedByRelatedIntentions = true
    },
    (v: SyncIncidentSnapshot) => {
      v.intentions[1].attempts = 1
    },
    (v: SyncIncidentSnapshot) => {
      v.intentions[1].state = "sending"
      v.intentions[1].lease = {
        ownerId: crypto.randomUUID(),
        expiresAt: "2026-10-17T20:00:00.000Z",
      }
    },
    (v: SyncIncidentSnapshot) => {
      v.intentions[1].operation.command = {
        type: "settings.update",
        input: { timeZone: "UTC", locale: "es-ES", weekStartsOn: 1 },
      }
    },
    (v: SyncIncidentSnapshot) => {
      v.intentions[1].operation.command = {
        type: "plan.set-status",
        itemId: crypto.randomUUID(),
        status: "completed",
      }
    },
    (v: SyncIncidentSnapshot) => {
      if (!v.local) throw new Error("Plan fixture is missing")
      v.local.ownerId = "another-owner"
    },
    (v: SyncIncidentSnapshot) => {
      if (v.local?.kind !== "plan") throw new Error("Plan fixture changed kind")
      v.local.recurrence = {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-17",
        timeZone: "Europe/Madrid",
        end: { type: "count", count: 3 },
      }
    },
  ]) {
    const { current, request } = fixture()
    change(current)
    expect(availableSyncIncidentResolutionChoices(current, true)).toEqual([])
    expect(() => planSyncIncidentResolution(request, current, true)).toThrow()
  }
})

test("changed plan snapshot rejects adoption and a deleted local draft retries a real delete", () => {
  const { current, request, local, remote } = fixture()
  expect(() =>
    planSyncIncidentResolution(
      request,
      { ...current, remote: { ...remote, revision: 6 } },
      true
    )
  ).toThrow("changed")
  current.local = { ...local, deletedAt: request.createdAt }
  const result = planSyncIncidentResolution(request, current, true)
  expect(result.replacement).toMatchObject({
    baseRevision: 5,
    command: { type: "item.delete", itemId: current.local.id },
  })
  expect(result.local.deletedAt).toBe(request.createdAt)
})
