import { expect, test } from "bun:test"
import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import {
  availablePlacementResolutionChoices,
  planPlacementIncidentResolution,
  previewPlacementResolutionChoice,
  validatePlacementResolutionRecord,
} from "@/lib/sync/placement-decision"
import { capturePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { planVariantSchema } from "@/schemas/plan-item"
import type {
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"

function request(
  expected: PlacementResolutionSnapshot,
  retry = true
): PlacementResolutionRequest {
  return {
    userId: expected.incident.entry.userId,
    resolutionId: crypto.randomUUID(),
    operationId: retry ? crypto.randomUUID() : null,
    choice: retry ? "retry_latest_move" : "adopt_remote",
    createdAt: "2026-10-19T03:25:00.000Z",
    expected,
  }
}
for (const variant of planVariantSchema.options)
  test(`${variant} retries the exact last movement with a new primary CAS and no invented ACK`, () => {
    const f = placementResolutionFixture(undefined, variant),
      input = request(f.snapshot),
      before = JSON.stringify(f.snapshot),
      record = planPlacementIncidentResolution(input, f.snapshot)
    expect(availablePlacementResolutionChoices(f.snapshot, f.actor)).toEqual([
      "adopt_remote",
      "retry_latest_move",
    ])
    expect(record.replacement?.command).toEqual(f.child.operation.command)
    expect(record.replacement?.operationId ?? null).toBe(input.operationId)
    expect(record.replacement?.baseRevision).toBe(2)
    expect(record.supersededOperationIds).toEqual([
      f.entry.operation.operationId,
      f.child.operation.operationId,
    ])
    expect(
      record.placements.find((record) => record.occurrenceId === f.items[0].id)
    ).toMatchObject({ position: 3072, revision: 2 })
    for (const peer of f.observed.placements.slice(1))
      expect(
        record.placements.find(
          (record) => record.occurrenceId === peer.occurrenceId
        )
      ).toEqual(peer)
    expect(validatePlacementResolutionRecord(record, f.actor)).toEqual(record)
    expect(JSON.stringify(f.snapshot)).toBe(before)
  })
test("adoption keeps the complete observed placement catalog and produces no operation", () => {
  const f = placementResolutionFixture(),
    record = planPlacementIncidentResolution(
      request(f.snapshot, false),
      f.snapshot
    )
  expect(record.placements).toEqual(f.snapshot.observed.placements)
  expect(record.replacement).toBeNull()
  expect(record.operationId).toBeNull()
  expect(record.supersededOperationIds).toHaveLength(2)
  expect(validatePlacementResolutionRecord(record, f.actor)).toEqual(record)
})
test("overdue retry preserves the exact declared civil date, not a new wall clock", () => {
  const f = placementResolutionFixture(undefined, "note", "overdue"),
    input = request(f.snapshot),
    record = planPlacementIncidentResolution(input, f.snapshot)
  expect(record.replacement?.command).toEqual(f.child.operation.command)
  expect(record.replacement?.command).toMatchObject({
    date: "2026-10-19",
    scope: "overdue",
  })
  expect(record.placements.every((value) => value.date === "0001-01-01")).toBe(
    true
  )
  const remote = planRemoteTaskPlacementOperation(
    {
      userId: f.actor,
      timestamp: "2030-01-01T00:00:00.000Z",
      operation: record.replacement,
      ...f.observed,
    },
    true
  )
  expect(remote.status).toBe("changes")
})
test("deleted primary, exhausted revision or stale neighbors offer adoption without restoring or fabricating a move", () => {
  const f = placementResolutionFixture()
  for (const patch of [
    { deletedAt: f.now, revision: 3 },
    { revision: Number.MAX_SAFE_INTEGER },
  ]) {
    const remote = { ...f.observed.placements[0], ...patch },
      snapshot = capturePlacementResolutionSnapshot({
        ...f.capture,
        observed: {
          ...f.observed,
          placements: [remote, ...f.observed.placements.slice(1)],
        },
        incident: {
          ...f.capture.incident,
          remote: [
            {
              entityKey: f.entry.entityKey,
              record: { store: "taskPlacements", record: remote },
            },
          ],
        },
      })
    expect(availablePlacementResolutionChoices(snapshot, f.actor)).toEqual([
      "adopt_remote",
    ])
    expect(() =>
      planPlacementIncidentResolution(request(snapshot), snapshot)
    ).toThrow()
    expect(
      planPlacementIncidentResolution(request(snapshot, false), snapshot)
        .placements
    ).toEqual(snapshot.observed.placements)
  }
  const child = {
      ...f.child,
      operation: {
        ...f.child.operation,
        command: { ...f.child.operation.command, afterId: crypto.randomUUID() },
      },
    },
    snapshot = capturePlacementResolutionSnapshot({
      ...f.capture,
      entries: [f.entry, child],
      incident: { ...f.capture.incident, intentions: [f.entry, child] },
    })
  expect(availablePlacementResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
  ])
  expect(() =>
    previewPlacementResolutionChoice(snapshot, f.actor, "retry_latest_move")
  ).toThrow()
})
test("reranking uses multiple independent remote effects and retains acknowledged local revisions", () => {
  const f = placementResolutionFixture(),
    peers = f.items.slice(1).toSorted((a, b) => a.id.localeCompare(b.id)),
    child = {
      ...f.child,
      operation: {
        ...f.child.operation,
        command: {
          ...f.child.operation.command,
          beforeId: peers[1].id,
          afterId: peers[0].id,
        },
      },
    },
    equal = (placements: typeof f.original) =>
      placements.map((record) =>
        peers.some((item) => item.id === record.occurrenceId)
          ? { ...record, position: 1024 }
          : record
      ),
    snapshot = capturePlacementResolutionSnapshot({
      ...f.capture,
      local: { ...f.local, placements: equal(f.local.placements) },
      observed: { ...f.observed, placements: equal(f.observed.placements) },
      entries: [f.entry, child],
      incident: { ...f.capture.incident, intentions: [f.entry, child] },
    }),
    record = planPlacementIncidentResolution(request(snapshot), snapshot),
    remote = planRemoteTaskPlacementOperation(
      {
        userId: f.actor,
        timestamp: record.createdAt,
        operation: record.replacement,
        ...snapshot.observed,
      },
      true
    )
  expect(remote.status).toBe("changes")
  if (remote.status !== "changes") throw new Error("Expected reranking effects")
  expect(remote.effects.length).toBeGreaterThan(1)
  for (const effect of remote.effects) {
    expect(effect.store).toBe("taskPlacements")
    if (effect.store !== "taskPlacements")
      throw new Error("Unexpected view mutation")
    const optimistic = record.placements.find(
      (value) => value.occurrenceId === effect.record.occurrenceId
    )
    expect(optimistic).toEqual({
      ...effect.record,
      revision: effect.record.revision - 1,
    })
  }
  expect(validatePlacementResolutionRecord(record, f.actor)).toEqual(record)
})
test("decisions reject changed snapshots, foreign identity, reused IDs and tampered evidence", () => {
  const f = placementResolutionFixture(),
    input = request(f.snapshot)
  expect(() =>
    planPlacementIncidentResolution({ ...input, userId: "foreign" }, f.snapshot)
  ).toThrow()
  expect(() =>
    planPlacementIncidentResolution(
      {
        ...input,
        expected: {
          ...f.snapshot,
          incident: { ...f.snapshot.incident, tagNames: { fake: "Injected" } },
        },
      },
      f.snapshot
    )
  ).toThrow()
  for (const ids of [
    { resolutionId: input.operationId },
    { resolutionId: f.entry.operation.operationId },
    { operationId: f.child.operation.operationId },
  ])
    expect(() =>
      planPlacementIncidentResolution({ ...input, ...ids }, f.snapshot)
    ).toThrow()
  expect(availablePlacementResolutionChoices(f.snapshot, "foreign")).toEqual([])
  const record = planPlacementIncidentResolution(input, f.snapshot)
  expect(() =>
    validatePlacementResolutionRecord({ ...record, placements: [] }, f.actor)
  ).toThrow()
  expect(() => validatePlacementResolutionRecord(record, "foreign")).toThrow()
  expect(() =>
    validatePlacementResolutionRecord(
      { ...record, supersededOperationIds: [f.child.operation.operationId] },
      f.actor
    )
  ).toThrow()
})
