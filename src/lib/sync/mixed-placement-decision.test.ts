import { expect, test } from "bun:test"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import {
  availableMixedPlacementResolutionChoices,
  planMixedPlacementIncidentResolution,
  validateMixedPlacementResolutionRecord,
} from "@/lib/sync/mixed-placement-decision"
import { mixedPlacementDecisionFixture } from "@/lib/sync/mixed-placement-decision-fixture"
import { availablePlacementResolutionChoices } from "@/lib/sync/placement-decision"
import { captureMixedPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { placementDate } from "@/schemas/ordering"

for (const scope of ["day", "overdue"] as const)
  test(`mixed ${scope} decision preserves every original, peer and independent revision`, () => {
    const f = mixedPlacementDecisionFixture(undefined, scope),
      before = JSON.stringify(f.snapshot)
    expect(
      availableMixedPlacementResolutionChoices(f.snapshot, f.simple.actor)
    ).toEqual(["adopt_remote", "retry_latest_move"])
    expect(
      availablePlacementResolutionChoices(f.snapshot, f.simple.actor)
    ).toEqual([])
    const record = planMixedPlacementIncidentResolution(f.request, f.snapshot)
    expect(record.supersededOperationIds).toEqual([
      f.simple.entry.operation.operationId,
      f.child.operation.operationId,
    ])
    expect(record.replacement?.command).toEqual(f.child.operation.command)
    expect(record.replacement?.baseRevision).toBe(2)
    expect(record.expected.incident.intentions[0].state).toBe("conflict")
    expect(record.expected.incident.intentions[1].state).toBe("pending")
    const remote = planRemoteRecurringTaskPlacementOperation(
      {
        userId: f.simple.actor,
        timestamp: f.request.createdAt,
        operation: record.replacement,
        ...f.snapshot.observed,
      },
      false
    )
    expect(remote.status).toBe("changes")
    if (remote.status !== "changes")
      throw new Error("Mixed retry effects missing")
    for (const effect of remote.effects) {
      expect(effect.store).toBe("taskPlacements")
      if (effect.store !== "taskPlacements")
        throw new Error("Unexpected view effect")
      const local = record.placements.find(
        (value) =>
          value.occurrenceId === effect.record.occurrenceId &&
          value.scope === effect.record.scope &&
          value.date === effect.record.date
      )
      expect(local).toEqual({
        ...effect.record,
        revision: effect.record.revision - 1,
      })
      expect(local?.date).toBe(placementDate(scope, f.simple.date))
    }
    expect(JSON.stringify(f.snapshot)).toBe(before)
    expect(
      validateMixedPlacementResolutionRecord(record, f.simple.actor)
    ).toEqual(record)
  })
test("mixed adoption conserves known catalog without replacements or fabricated ACK", () => {
  const f = mixedPlacementDecisionFixture()
  const record = planMixedPlacementIncidentResolution(
    { ...f.request, choice: "adopt_remote", operationId: null },
    f.snapshot
  )
  expect(record.placements).toEqual(f.snapshot.observed.placements)
  expect(record.replacement).toBeNull()
  expect(record.expected.acknowledgedDependencies).toEqual([])
})
test("unreviewed commands, contexts, reused identities and altered durable effects are rejected", () => {
  const f = mixedPlacementDecisionFixture(),
    record = planMixedPlacementIncidentResolution(f.request, f.snapshot)
  expect(() =>
    planMixedPlacementIncidentResolution(
      { ...f.request, userId: "foreign" },
      f.snapshot
    )
  ).toThrow()
  expect(() =>
    planMixedPlacementIncidentResolution(
      { ...f.request, resolutionId: f.simple.entry.operation.operationId },
      f.snapshot
    )
  ).toThrow("identities")
  expect(() =>
    planMixedPlacementIncidentResolution(
      { ...f.request, operationId: f.request.resolutionId },
      f.snapshot
    )
  ).toThrow("identities")
  const changed = captureMixedPlacementResolutionSnapshot({
    ...f.capture,
    local: {
      ...f.capture.local,
      placements: f.capture.local.placements.map((value) =>
        value.occurrenceId === f.simple.items[1].id
          ? { ...value, position: value.position + 1 }
          : value
      ),
    },
  })
  expect(() =>
    planMixedPlacementIncidentResolution(f.request, changed)
  ).toThrow("changed")
  expect(() =>
    validateMixedPlacementResolutionRecord(
      { ...record, placements: record.placements.slice(1) },
      f.simple.actor
    )
  ).toThrow("evidence")
  expect(() =>
    validateMixedPlacementResolutionRecord(record, "foreign")
  ).toThrow("account")
})
test("stale anchors or remote tombstone retain only adoption", () => {
  const f = mixedPlacementDecisionFixture()
  const child = {
    ...f.child,
    operation: {
      ...f.child.operation,
      command: {
        ...f.child.operation.command,
        beforeId: null,
        afterId: f.simple.items[2].id,
      },
    },
  }
  const invalid = captureMixedPlacementResolutionSnapshot({
    ...f.capture,
    entries: [f.simple.entry, child],
    incident: { ...f.capture.incident, intentions: [f.simple.entry, child] },
  })
  expect(
    availableMixedPlacementResolutionChoices(invalid, f.simple.actor)
  ).toEqual(["adopt_remote"])
  const tombstone = {
    ...f.snapshot.observed.placements.find(
      (value) => value.occurrenceId === f.simple.items[0].id
    ),
    deletedAt: f.simple.now,
    revision: 3,
  }
  const observed = {
    ...f.capture.observed,
    placements: f.capture.observed.placements.map((value) =>
      value.occurrenceId === f.simple.items[0].id ? tombstone : value
    ),
  }
  const incident = {
    ...f.capture.incident,
    remote: [
      {
        entityKey: f.simple.entry.entityKey,
        record: { store: "taskPlacements", record: tombstone },
      },
    ],
  }
  const deleted = captureMixedPlacementResolutionSnapshot({
    ...f.capture,
    observed,
    incident,
  })
  expect(
    availableMixedPlacementResolutionChoices(deleted, f.simple.actor)
  ).toEqual(["adopt_remote"])
})
test("multiple slots, unknown assignments and uncertain or external operations keep full guards", () => {
  const f = mixedPlacementDecisionFixture()
  for (const capture of [
    { ...f.capture, entries: [f.simple.entry, { ...f.child, attempts: 1 }] },
    { ...f.capture, local: { ...f.capture.local, occurrences: [] } },
    {
      ...f.capture,
      entries: [
        f.simple.entry,
        f.child,
        {
          ...f.child,
          sequence: 3,
          operation: {
            ...f.child.operation,
            operationId: crypto.randomUUID(),
            command: { type: "tag.delete", tagId: crypto.randomUUID() },
          },
        },
      ],
    },
  ])
    expect(() => captureMixedPlacementResolutionSnapshot(capture)).toThrow()
  expect(availableMixedPlacementResolutionChoices({}, f.simple.actor)).toEqual(
    []
  )
})
