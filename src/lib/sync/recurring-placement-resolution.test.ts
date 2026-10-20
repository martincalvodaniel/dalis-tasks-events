import { expect, test } from "bun:test"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import {
  reviewPlacementGroup,
  reviewRecurringPlacementGroup,
} from "@/lib/sync/placement-group-review"
import {
  captureMixedPlacementResolutionSnapshot,
  captureRecurringPlacementResolutionSnapshot,
  validateRecurringPlacementResolutionSnapshot,
} from "@/lib/sync/placement-resolution"
import { recurringPlacementResolutionFixture } from "@/lib/sync/recurring-placement-resolution-fixture"
import {
  overduePlacementDate,
  taskPlacementEntityKey,
} from "@/schemas/ordering"
import { planVariantSchema } from "@/schemas/plan-item"

for (const variant of planVariantSchema.options)
  for (const slot of ["moved", "implicit"] as const)
    test(`${variant} ${slot} primary reviews exact slot, parent and independent placement revisions`, () => {
      const f = recurringPlacementResolutionFixture(slot, "day", variant),
        before = JSON.stringify(f.capture),
        snapshot = captureRecurringPlacementResolutionSnapshot(f.capture),
        review = reviewRecurringPlacementGroup({
          userId: f.simple.actor,
          operation: f.entry.operation,
          local: snapshot.local,
          observed: snapshot.observed,
        })
      expect(review.primaryId).toBe(f.targetId)
      expect(review.members).toHaveLength(5)
      expect(
        review.members.find((member) => member.id === f.targetId)
      ).toMatchObject({
        parentId: f.series.id,
        scheduledDate: "2026-10-18",
        variant,
        recurring: true,
      })
      expect(snapshot.incident.entry.entityKey).toBe(
        taskPlacementEntityKey(f.targetId, "day", f.simple.date)
      )
      expect(snapshot.incident.intentions).toEqual([f.entry, f.child])
      expect(
        snapshot.observed.placements.find(
          (value) => value.occurrenceId === f.targetId
        )?.revision
      ).toBe(slot === "moved" ? 4 : 7)
      expect(
        snapshot.observed.items.find((value) => value.id === f.series.id)
          ?.revision
      ).toBe(1)
      expect(
        snapshot.observed.occurrences.some(
          (value) => value.id === f.implicit.id
        )
      ).toBe(false)
      expect(
        validateRecurringPlacementResolutionSnapshot(snapshot, f.simple.actor)
      ).toEqual(snapshot)
      expect(() => captureMixedPlacementResolutionSnapshot(f.capture)).toThrow(
        "simple movement"
      )
      expect(() =>
        reviewPlacementGroup({
          userId: f.simple.actor,
          operation: f.entry.operation,
          local: snapshot.local,
          observed: snapshot.observed,
        })
      ).toThrow("simple primary")
      expect(JSON.stringify(f.capture)).toBe(before)
    })
test("overdue appearance recovery uses the declared as-of day and permanent placement date", () => {
  const f = recurringPlacementResolutionFixture("moved", "overdue"),
    snapshot = captureRecurringPlacementResolutionSnapshot(f.capture),
    review = reviewRecurringPlacementGroup({
      userId: f.simple.actor,
      operation: f.entry.operation,
      local: snapshot.local,
      observed: snapshot.observed,
    })
  expect(review.placementDate).toBe(overduePlacementDate)
  expect(review.declaredDate).toBe("2026-10-19")
  expect(review.primaryId).toBe(f.moved.id)
  expect(() =>
    captureRecurringPlacementResolutionSnapshot({
      ...f.capture,
      incident: {
        ...f.capture.incident,
        entry: {
          ...f.entry,
          operation: {
            ...f.entry.operation,
            command: { ...f.entry.operation.command, date: "2026-10-17" },
          },
        },
      },
    })
  ).toThrow()
})
test("foreign actors, uncertain children, another slot and external dependents cannot enter a recurring review", () => {
  const f = recurringPlacementResolutionFixture()
  for (const entry of [
    { ...f.child, attempts: 1 },
    {
      ...f.child,
      lease: { ownerId: crypto.randomUUID(), expiresAt: f.simple.now },
    },
    {
      ...f.child,
      operation: {
        ...f.child.operation,
        command: { ...f.child.operation.command, occurrenceId: f.implicit.id },
      },
    },
  ])
    expect(() =>
      captureRecurringPlacementResolutionSnapshot({
        ...f.capture,
        entries: [f.entry, entry],
        incident: { ...f.capture.incident, intentions: [f.entry, entry] },
      })
    ).toThrow()
  expect(() =>
    captureRecurringPlacementResolutionSnapshot({
      ...f.capture,
      userId: "foreign",
    })
  ).toThrow()
  const other = {
    ...f.child,
    entityKey: taskPlacementEntityKey(f.implicit.id, "day", f.simple.date),
    operation: {
      ...f.child.operation,
      operationId: crypto.randomUUID(),
      command: { ...f.child.operation.command, occurrenceId: f.implicit.id },
    },
  }
  expect(() =>
    captureRecurringPlacementResolutionSnapshot({
      ...f.capture,
      entries: [f.entry, f.child, other],
    })
  ).toThrow()
})
test("cancellation, rule drift, missing assignment or unknown primary preserve recovery guards", () => {
  const f = recurringPlacementResolutionFixture()
  for (const change of [
    { ...f.capture.observed, occurrences: [{ ...f.moved, cancelled: true }] },
    {
      ...f.capture.observed,
      items: f.capture.observed.items.map((item) =>
        item.id === f.series.id ? { ...item, deletedAt: f.simple.now } : item
      ),
    },
    {
      ...f.capture.observed,
      views: f.capture.observed.views.filter(
        (view) => view.itemId !== f.series.id
      ),
    },
    {
      ...f.capture.observed,
      placements: f.capture.observed.placements.filter(
        (record) => record.occurrenceId !== f.targetId
      ),
    },
  ])
    expect(() =>
      captureRecurringPlacementResolutionSnapshot({
        ...f.capture,
        observed: change,
      })
    ).toThrow()
  const cancelled = {
    ...f.capture.observed,
    occurrences: [{ ...f.moved, cancelled: true }],
  }
  expect(() =>
    reviewRecurringPlacementGroup({
      userId: f.simple.actor,
      operation: f.entry.operation,
      local: cancelled,
      observed: cancelled,
    })
  ).toThrow("civil scope")
  const snapshot = captureRecurringPlacementResolutionSnapshot(f.capture)
  expect(() =>
    validateRecurringPlacementResolutionSnapshot(
      {
        ...snapshot,
        incident: {
          ...snapshot.incident,
          outcome: {
            ...f.outcome,
            operation: {
              ...f.entry.operation,
              operationId: crypto.randomUUID(),
            },
          },
        },
      },
      f.simple.actor
    )
  ).toThrow()
})
test("same-parent positions on another day cannot be overwritten by one-slot adoption", () => {
  const f = recurringPlacementResolutionFixture(),
    outside = { ...f.known, date: "2026-10-19", position: 1024 }
  expect(() =>
    reviewRecurringPlacementGroup({
      userId: f.simple.actor,
      operation: f.entry.operation,
      local: {
        ...f.capture.local,
        placements: [
          ...f.capture.local.placements,
          { ...outside, position: 2048 },
        ],
      },
      observed: {
        ...f.capture.observed,
        placements: [...f.capture.observed.placements, outside],
      },
    })
  ).toThrow("external")
})
test("remote planner uses primary slot CAS and preserves parent, slot and assignment", () => {
  const f = recurringPlacementResolutionFixture(),
    snapshot = captureRecurringPlacementResolutionSnapshot(f.capture),
    before = JSON.stringify(snapshot.observed)
  const planned = planRemoteRecurringTaskPlacementOperation(
    {
      userId: f.simple.actor,
      timestamp: f.simple.now,
      ...snapshot.observed,
      operation: { ...f.child.operation, baseRevision: f.known.revision },
    },
    false
  )
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes")
    throw new Error("Recurring primary move missing")
  expect(
    planned.effects.every((effect) => effect.store === "taskPlacements")
  ).toBe(true)
  expect(
    planned.effects.find(
      (effect) =>
        effect.store === "taskPlacements" &&
        effect.record.occurrenceId === f.targetId
    )?.record.revision
  ).toBe(f.known.revision + 1)
  expect(JSON.stringify(snapshot.observed)).toBe(before)
  const stale = planRemoteRecurringTaskPlacementOperation(
    {
      userId: f.simple.actor,
      timestamp: f.simple.now,
      ...snapshot.observed,
      operation: f.entry.operation,
    },
    false
  )
  expect(stale.status).toBe("conflict")
})

test("timed primary keeps its original timestamp slot after moving to another time", () => {
  const f = recurringPlacementResolutionFixture(),
    targetId = `${f.series.id}:2026-10-17T09:00`,
    series = {
      ...f.series,
      schedule: {
        mode: "timed" as const,
        localStart: "2026-10-17T09:00",
        localEnd: "2026-10-17T10:00",
        timeZone: "Europe/Madrid",
      },
    },
    moved = {
      ...f.moved,
      id: targetId,
      slotKey: "2026-10-17T09:00",
      schedule: {
        mode: "timed" as const,
        localStart: "2026-10-18T11:30",
        localEnd: "2026-10-18T12:30",
        timeZone: "Europe/Madrid",
      },
    }
  const catalog = {
      ...f.capture.observed,
      items: f.capture.observed.items.map((item) =>
        item.id === series.id ? series : item
      ),
      occurrences: [moved],
      placements: f.capture.observed.placements.map((record) =>
        record.occurrenceId === f.targetId
          ? { ...record, occurrenceId: targetId }
          : record
      ),
    },
    operation = {
      ...f.entry.operation,
      command: { ...f.entry.operation.command, occurrenceId: targetId },
    }
  const review = reviewRecurringPlacementGroup({
    userId: f.simple.actor,
    operation,
    local: catalog,
    observed: catalog,
  })
  expect(review.primaryId).toBe(targetId)
  expect(review.members.find((member) => member.id === targetId)).toMatchObject(
    { start: "2026-10-18T11:30", scheduledDate: "2026-10-18" }
  )
  expect(
    review.members.some(
      (member) => member.id === `${series.id}:2026-10-18T09:00`
    )
  ).toBe(true)
  expect(() =>
    reviewRecurringPlacementGroup({
      userId: f.simple.actor,
      operation: {
        ...operation,
        command: {
          ...operation.command,
          occurrenceId: `${series.id}:2026-10-17T11:30`,
        },
      },
      local: catalog,
      observed: catalog,
    })
  ).toThrow("civil scope")
})
test("dense neighbors rerank each affected placement independently without changing the primary series", () => {
  const f = recurringPlacementResolutionFixture(),
    catalog = {
      ...f.capture.observed,
      placements: f.capture.observed.placements.map((record) => ({
        ...record,
        position:
          record.occurrenceId === f.simple.items[0].id
            ? -1
            : record.occurrenceId === f.simple.items[1].id
              ? 1
              : record.occurrenceId === f.simple.items[2].id
                ? 1 + Number.EPSILON
                : 2,
      })),
    },
    operation = {
      ...f.entry.operation,
      baseRevision: f.known.revision,
      command: {
        ...f.entry.operation.command,
        beforeId: f.simple.items[2].id,
        afterId: f.simple.items[1].id,
      },
    }
  const review = reviewRecurringPlacementGroup({
      userId: f.simple.actor,
      operation,
      local: catalog,
      observed: catalog,
    }),
    planned = planRemoteRecurringTaskPlacementOperation(
      {
        userId: f.simple.actor,
        timestamp: f.simple.now,
        operation,
        ...catalog,
      },
      false
    )
  expect(review.primaryId).toBe(f.targetId)
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes")
    throw new Error("Dense recurring move missing")
  expect(planned.effects).toHaveLength(review.members.length)
  for (const effect of planned.effects) {
    expect(effect.store).toBe("taskPlacements")
    if (effect.store !== "taskPlacements")
      throw new Error("Unexpected assignment change")
    expect(effect.record.revision).toBe(
      (catalog.placements.find(
        (record) => record.occurrenceId === effect.record.occurrenceId
      )?.revision ?? 0) + 1
    )
  }
  expect(catalog.items.find((item) => item.id === f.series.id)).toEqual(
    f.series
  )
  expect(catalog.occurrences).toEqual([f.moved])
})
