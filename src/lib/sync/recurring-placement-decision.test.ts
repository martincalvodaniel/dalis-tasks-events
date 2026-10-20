import { expect, test } from "bun:test"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { availableMixedPlacementResolutionChoices } from "@/lib/sync/mixed-placement-decision"
import { captureRecurringPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import {
  availableRecurringPlacementResolutionChoices,
  planRecurringPlacementIncidentResolution,
  validateRecurringPlacementResolutionRecord,
} from "@/lib/sync/recurring-placement-decision"
import { recurringPlacementResolutionFixture } from "@/lib/sync/recurring-placement-resolution-fixture"
import { mixedPlacementResolutionRequestSchema } from "@/schemas/mixed-placement-resolution"
import { recurringPlacementResolutionRequestSchema } from "@/schemas/recurring-placement-resolution"

for (const slot of ["moved", "implicit"] as const)
  for (const scope of ["day", "overdue"] as const)
    test(`recurring ${slot} ${scope} retry preserves exact last intention with independent primary CAS`, () => {
      const f = recurringPlacementResolutionFixture(slot, scope),
        before = JSON.stringify(f.snapshot),
        record = planRecurringPlacementIncidentResolution(f.request, f.snapshot)
      expect(
        availableRecurringPlacementResolutionChoices(f.snapshot, f.simple.actor)
      ).toEqual(["adopt_remote", "retry_latest_move"])
      expect(
        availableMixedPlacementResolutionChoices(f.snapshot, f.simple.actor)
      ).toEqual([])
      expect(() =>
        mixedPlacementResolutionRequestSchema.parse(f.request)
      ).toThrow()
      expect(() =>
        recurringPlacementResolutionRequestSchema.parse({
          ...f.request,
          reviewKind: "mixed_group",
        })
      ).toThrow()
      expect(record.reviewKind).toBe("recurring_primary")
      expect(record.replacement?.command).toEqual(f.child.operation.command)
      expect(record.replacement?.operationId ?? null).toBe(
        f.request.operationId
      )
      expect(record.replacement?.baseRevision).toBe(f.known.revision)
      expect(record.supersededOperationIds).toEqual([
        f.entry.operation.operationId,
        f.child.operation.operationId,
      ])
      const remote = planRemoteRecurringTaskPlacementOperation(
        {
          userId: f.simple.actor,
          timestamp: f.simple.now,
          operation: record.replacement,
          ...f.snapshot.observed,
        },
        false
      )
      expect(remote.status).toBe("changes")
      if (remote.status !== "changes")
        throw new Error("Recurring retry effects missing")
      for (const effect of remote.effects) {
        expect(effect.store).toBe("taskPlacements")
        if (effect.store !== "taskPlacements")
          throw new Error("Unexpected assignment effect")
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
      }
      expect(JSON.stringify(f.snapshot)).toBe(before)
      expect(
        validateRecurringPlacementResolutionRecord(record, f.simple.actor)
      ).toEqual(record)
    })
test("recurring adoption conserves known positions and never creates an ACK", () => {
  const f = recurringPlacementResolutionFixture(),
    record = planRecurringPlacementIncidentResolution(
      { ...f.request, choice: "adopt_remote", operationId: null },
      f.snapshot
    )
  expect(record.replacement).toBeNull()
  expect(record.operationId).toBeNull()
  expect(record.placements).toEqual(f.snapshot.observed.placements)
  expect(record.expected.incident.entry.state).toBe("conflict")
  expect(record.expected.incident.intentions[1].state).toBe("pending")
})
test("stale neighbors or a known position tombstone retain only adoption", () => {
  const f = recurringPlacementResolutionFixture(),
    child = {
      ...f.child,
      operation: {
        ...f.child.operation,
        command: {
          ...f.child.operation.command,
          beforeId: null,
          afterId: f.simple.items[0].id,
        },
      },
    }
  const stale = captureRecurringPlacementResolutionSnapshot({
    ...f.capture,
    entries: [f.entry, child],
    incident: { ...f.capture.incident, intentions: [f.entry, child] },
  })
  expect(
    availableRecurringPlacementResolutionChoices(stale, f.simple.actor)
  ).toEqual(["adopt_remote"])
  const remote = {
      ...f.known,
      revision: f.known.revision + 1,
      deletedAt: f.simple.now,
    },
    deleted = captureRecurringPlacementResolutionSnapshot({
      ...f.capture,
      observed: {
        ...f.capture.observed,
        placements: f.capture.observed.placements.map((value) =>
          value.occurrenceId === f.targetId ? remote : value
        ),
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
  expect(
    availableRecurringPlacementResolutionChoices(deleted, f.simple.actor)
  ).toEqual(["adopt_remote"])
  expect(() =>
    planRecurringPlacementIncidentResolution(
      { ...f.request, expected: deleted },
      deleted
    )
  ).toThrow()
})
test("foreign actor, changed snapshot, colliding IDs and altered record evidence remain rejected", () => {
  const f = recurringPlacementResolutionFixture(),
    record = planRecurringPlacementIncidentResolution(f.request, f.snapshot)
  for (const request of [
    { ...f.request, userId: "foreign" },
    { ...f.request, operationId: f.request.resolutionId },
    { ...f.request, resolutionId: f.child.operation.operationId },
  ])
    expect(() =>
      planRecurringPlacementIncidentResolution(request, f.snapshot)
    ).toThrow()
  expect(
    availableRecurringPlacementResolutionChoices(f.snapshot, "foreign")
  ).toEqual([])
  expect(() =>
    validateRecurringPlacementResolutionRecord(record, "foreign")
  ).toThrow()
  const changed = captureRecurringPlacementResolutionSnapshot({
    ...f.capture,
    local: {
      ...f.capture.local,
      placements: f.capture.local.placements.map((value) =>
        value.occurrenceId === f.simple.items[0].id
          ? { ...value, position: value.position + 1 }
          : value
      ),
    },
  })
  expect(() =>
    planRecurringPlacementIncidentResolution(f.request, changed)
  ).toThrow("changed")
  expect(() =>
    validateRecurringPlacementResolutionRecord(
      { ...record, placements: record.placements.slice(1) },
      f.simple.actor
    )
  ).toThrow("evidence")
  expect(() =>
    validateRecurringPlacementResolutionRecord(
      { ...record, replacement: { ...record.replacement, baseRevision: 0 } },
      f.simple.actor
    )
  ).toThrow("evidence")
})
