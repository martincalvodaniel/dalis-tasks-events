import { expect, test } from "bun:test"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { reviewPlacementGroup } from "@/lib/sync/placement-group-review"
import { placementGroupReviewFixture } from "@/lib/sync/placement-group-review-fixture"
import { capturePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import {
  overduePlacementDate,
  taskPlacementEntityKey,
} from "@/schemas/ordering"
import { planVariantSchema } from "@/schemas/plan-item"

for (const variant of planVariantSchema.options)
  test(`mixed ${variant} review identifies moved and implicit slots without materializing records`, () => {
    const f = placementGroupReviewFixture("day", variant),
      before = JSON.stringify(f.input),
      review = reviewPlacementGroup(f.input)
    expect(review.includesRecurringPeers).toBe(true)
    expect(review.members).toHaveLength(5)
    expect(
      review.members
        .filter((member) => member.parentId === f.series.id)
        .map((member) => member.id)
        .toSorted()
    ).toEqual([f.moved.id, f.implicit.id].toSorted())
    expect(review.localOrder).toHaveLength(5)
    expect(review.observedOrder).toHaveLength(5)
    expect(review.changedPlacementKeys).toContain(f.simple.entry.entityKey)
    expect(f.input.observed.occurrences).toHaveLength(1)
    expect(
      f.input.observed.placements.some(
        (record) => record.occurrenceId === f.implicit.id
      )
    ).toBe(false)
    expect(JSON.stringify(f.input)).toBe(before)
  })
test("mixed overdue review uses the command civil day and permanent placement sentinel", () => {
  const f = placementGroupReviewFixture("overdue"),
    review = reviewPlacementGroup(f.input)
  expect(review.declaredDate).toBe("2026-10-19")
  expect(review.placementDate).toBe(overduePlacementDate)
  expect(review.members.filter((member) => member.recurring)).toHaveLength(2)
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      operation: {
        ...f.input.operation,
        command: { ...f.simple.entry.operation.command, date: "2026-10-17" },
      },
    })
  ).toThrow("civil scope")
})
test("the existing active resolver keeps mixed-group protection until integration evidence", () => {
  const f = placementGroupReviewFixture()
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.simple.capture,
      local: f.input.local,
      observed: f.input.observed,
    })
  ).toThrow("recurring")
  expect(reviewPlacementGroup(f.input).includesRecurringPeers).toBe(true)
})
test("context drift, unknown assignments, foreign owners and duplicate catalogs remain protected", () => {
  const f = placementGroupReviewFixture()
  for (const input of [
    { ...f.input, userId: "foreign" },
    {
      ...f.input,
      observed: {
        ...f.input.observed,
        items: [...f.input.observed.items, f.series],
      },
    },
    {
      ...f.input,
      observed: {
        ...f.input.observed,
        items: f.input.observed.items.map((item) => ({
          ...item,
          title: "Changed remotely",
        })),
      },
    },
    { ...f.input, local: { ...f.input.local, occurrences: [] } },
    {
      ...f.input,
      local: { ...f.input.local, views: [] },
      observed: { ...f.input.observed, views: [] },
    },
    {
      ...f.input,
      observed: {
        ...f.input.observed,
        occurrences: [{ ...f.moved, revision: 0 }],
      },
    },
    {
      ...f.input,
      local: {
        ...f.input.local,
        placements: f.input.local.placements.slice(1),
      },
    },
    { ...f.input, unsafe: true },
  ])
    expect(() => reviewPlacementGroup(input)).toThrow()
})
test("recurrent primaries and category changes require a distinct recovery contract", () => {
  const f = placementGroupReviewFixture()
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      operation: {
        ...f.input.operation,
        command: {
          ...f.simple.entry.operation.command,
          itemId: f.series.id,
          occurrenceId: f.moved.id,
        },
      },
    })
  ).toThrow("simple primary")
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      operation: {
        ...f.input.operation,
        command: {
          ...f.simple.entry.operation.command,
          tagId: crypto.randomUUID(),
        },
      },
    })
  ).toThrow("category")
})
test("changed hidden or differently scoped peer placements cannot be folded into this review", () => {
  const f = placementGroupReviewFixture()
  const local = f.input.local.placements.map((record) =>
    record.occurrenceId === f.moved.id ? { ...record, position: 4096 } : record
  )
  const cancelled = { ...f.moved, cancelled: true }
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      local: { ...f.input.local, occurrences: [cancelled], placements: local },
      observed: { ...f.input.observed, occurrences: [cancelled] },
    })
  ).toThrow("inactive")
  const outside = {
    ...f.input.observed.placements[0],
    date: "2026-10-20",
    position: 3072,
  }
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      local: {
        ...f.input.local,
        placements: [
          ...f.input.local.placements,
          { ...outside, position: 4096 },
        ],
      },
      observed: {
        ...f.input.observed,
        placements: [...f.input.observed.placements, outside],
      },
    })
  ).toThrow("external")
})
test("the real remote planner reranks mixed neighbors with independent revisions and preserves parent assignment", () => {
  const f = placementGroupReviewFixture(),
    observed = f.input.observed
  const dense = observed.placements.map((record, index) => ({
    ...record,
    position:
      index === 0 ? -1 : index === 1 ? 1 : index === 2 ? 1 + Number.EPSILON : 2,
  }))
  const input = {
    ...f.input,
    local: { ...f.input.local, placements: dense },
    observed: { ...observed, placements: dense },
  }
  const review = reviewPlacementGroup(input),
    ids = new Set(review.members.map((member) => member.id))
  const command = {
    ...f.simple.entry.operation.command,
    beforeId: f.simple.items[2].id,
    afterId: f.simple.items[1].id,
  }
  const primary = dense.find(
    (record) => record.occurrenceId === f.simple.items[0].id
  )
  if (!primary) throw new Error("Primary missing")
  const planned = planRemoteRecurringTaskPlacementOperation(
    {
      userId: f.input.userId,
      timestamp: f.simple.now,
      operation: {
        ...f.input.operation,
        operationId: crypto.randomUUID(),
        baseRevision: primary.revision,
        command,
      },
      ...input.observed,
    },
    false
  )
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes")
    throw new Error("Expected mixed movement effects")
  expect(planned.effects.length).toBeGreaterThan(1)
  for (const effect of planned.effects) {
    expect(effect.store).toBe("taskPlacements")
    if (effect.store !== "taskPlacements")
      throw new Error("Unexpected assignment change")
    const previous = dense.find(
      (record) => record.occurrenceId === effect.record.occurrenceId
    )
    expect(effect.record.revision).toBe((previous?.revision ?? 0) + 1)
    expect(ids.has(effect.record.occurrenceId)).toBe(true)
    expect(effect.record.tagId).toBeNull()
  }
  expect(
    planned.effects.some(
      (effect) =>
        effect.store === "taskPlacements" &&
        effect.record.occurrenceId === f.implicit.id
    )
  ).toBe(true)
})
test("catalog bounds and contradictory primary identities are rejected without truncation", () => {
  const f = placementGroupReviewFixture()
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      local: {
        ...f.input.local,
        items: Array.from({ length: 10001 }, () => f.series),
      },
    })
  ).toThrow()
  const changed = f.input.local.placements.map((record) =>
    record.occurrenceId === f.simple.items[0].id
      ? { ...record, revision: 999 }
      : record
  )
  expect(() =>
    reviewPlacementGroup({
      ...f.input,
      local: { ...f.input.local, placements: changed },
    })
  ).toThrow("external placement")
  expect(reviewPlacementGroup(f.input).changedPlacementKeys).toContain(
    taskPlacementEntityKey(f.simple.items[0].id, "day", f.simple.date)
  )
})
