import { expect, test } from "bun:test"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { reviewCategoryPlacementGroups } from "@/lib/sync/category-placement-review"
import { categoryPlacementReviewFixture } from "@/lib/sync/category-placement-review-fixture"
import {
  reviewPlacementGroup,
  reviewRecurringPlacementGroup,
} from "@/lib/sync/placement-group-review"
import { categoryPlacementReviewInputSchema } from "@/schemas/category-placement-review"
import { placementDate, taskPlacementEntityKey } from "@/schemas/ordering"

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new Error("Category review fixture record missing")
  return value
}

for (const primary of ["simple", "moved", "implicit"] as const)
  for (const scope of ["day", "overdue"] as const)
    for (const variant of ["task", "event", "appointment", "note"] as const)
      test(`category review keeps ${primary} ${scope} ${variant} order and parent scope exact`, () => {
        const f = categoryPlacementReviewFixture(primary, scope, variant),
          before = JSON.stringify(f.input),
          review = reviewCategoryPlacementGroups(f.input)
        expect(review.primaryId).toBe(f.targetId)
        expect(review.parentId).toBe(f.parentId)
        expect(review.assignmentScope).toBe("parent_all_dates")
        expect(review.localTagId).toBe(f.destinationId)
        expect(review.observedTagId).toBe(f.sourceId)
        expect(review.placementDate).toBe(
          placementDate(scope, f.input.operation.command.date)
        )
        expect(review.parentVisibleIds).toContain(f.targetId)
        if (primary !== "simple")
          expect(review.parentVisibleIds.length).toBeGreaterThan(1)
        for (const [catalog, field] of [
          [f.input.local, "localOrder"],
          [f.input.observed, "observedOrder"],
        ] as const) {
          const visible = recurringMovementCatalog(
            catalog.items,
            catalog.occurrences,
            f.actor,
            f.input.operation.command
          )
          for (const group of review.groups) {
            const members = visible.filter((member) =>
              catalog.views.some(
                (view) =>
                  view.itemId === member.parent.id &&
                  view.primaryTagId === group.tagId
              )
            )
            expect(group[field]).toEqual(
              orderPlacedTasks(
                members,
                catalog.placements.filter(
                  (record) =>
                    record.scope === scope &&
                    record.date === review.placementDate
                ),
                group.tagId,
                compareRecurringMovementItems
              ).map((member) => member.id)
            )
          }
        }
        expect(() => reviewPlacementGroup(f.input)).toThrow()
        expect(() => reviewRecurringPlacementGroup(f.input)).toThrow()
        const known = f.input.observed.placements.find(
          (record) => record.occurrenceId === f.targetId
        )
        expect(known).toBeDefined()
        const planned = planRemoteRecurringTaskPlacementOperation({
          userId: f.actor,
          timestamp: f.now,
          ...f.input.observed,
          operation: { ...f.input.operation, baseRevision: known?.revision },
        })
        expect(planned.status).toBe("changes")
        if (planned.status !== "changes")
          throw new Error("Category oracle planning failed")
        const view = planned.effects.find(
          (effect) => effect.store === "itemViews"
        )
        expect(view).toMatchObject({
          store: "itemViews",
          record: {
            itemId: f.parentId,
            primaryTagId: f.destinationId,
            revision: 2,
          },
        })
        expect(
          planned.effects.filter(
            (effect) =>
              effect.store !== "taskPlacements" && effect.store !== "itemViews"
          )
        ).toHaveLength(0)
        expect(JSON.stringify(f.input)).toBe(before)
      })
for (const side of ["source", "destination"] as const)
  test(`category review preserves explicit uncategorized ${side}`, () => {
    const f = categoryPlacementReviewFixture("moved", "day", "note", side),
      review = reviewCategoryPlacementGroups(f.input)
    expect(review.groups.some((group) => group.tagId === null)).toBe(true)
    expect(review.parentVisibleIds).toHaveLength(2)
  })
test("historical primary rank category differs from current parent category without removing the plan", () => {
  const f = categoryPlacementReviewFixture("moved"),
    value = structuredClone(f.input)
  const record = value.observed.placements.find(
    (record) => record.occurrenceId === f.targetId
  )
  if (!record) throw new Error("Missing fixture rank")
  record.tagId = f.tags[2].id
  const review = reviewCategoryPlacementGroups(value)
  expect(review.observedPositionTagId).toBe(f.tags[2].id)
  expect(review.observedTagId).toBe(f.sourceId)
  expect(
    review.groups.find((group) => group.tagId === f.sourceId)?.observedOrder
  ).toContain(f.targetId)
})
test("known positions on other dates remain unchanged while parent assignment covers them", () => {
  const f = categoryPlacementReviewFixture("moved"),
    value = structuredClone(f.input),
    record = {
      ...value.observed.placements[0],
      date: "2026-10-20",
      position: 4000,
    }
  value.local.placements.push(structuredClone(record))
  value.observed.placements.push(structuredClone(record))
  const review = reviewCategoryPlacementGroups(value),
    external = taskPlacementEntityKey(
      record.occurrenceId,
      record.scope,
      record.date
    )
  expect(review.changedPlacementKeys).not.toContain(external)
  required(value.local.placements.at(-1)).position++
  expect(() => reviewCategoryPlacementGroups(value)).toThrow()
})
test("same parent siblings can have independently reviewed category ranks", () => {
  const f = categoryPlacementReviewFixture("implicit"),
    value = structuredClone(f.input),
    sibling = value.local.placements.find(
      (record) => record.occurrenceId === f.f.moved.id
    )
  if (!sibling) throw new Error("Sibling fixture rank missing")
  sibling.tagId = f.destinationId
  sibling.position++
  const review = reviewCategoryPlacementGroups(value)
  expect(review.changedPlacementKeys).toContain(
    taskPlacementEntityKey(sibling.occurrenceId, sibling.scope, sibling.date)
  )
  expect(review.parentVisibleIds).toContain(sibling.occurrenceId)
})
test("category review rejects partial, foreign, stale, deleted and unrelated catalogs", () => {
  const f = categoryPlacementReviewFixture("moved")
  const mutations: ((value: typeof f.input) => void)[] = [
    (value) => {
      value.userId = "foreign"
    },
    (value) => {
      value.local.items[0].title += " changed"
    },
    (value) => {
      value.local.occurrences[0].revision++
    },
    (value) => {
      value.local.tags[0].color = "#000000"
    },
    (value) => {
      value.local.views[0].updatedAt = "invalid"
    },
    (value) => {
      value.local.views.pop()
    },
    (value) => {
      required(
        value.observed.views.find((view) => view.itemId === f.parentId)
      ).deletedAt = f.now
    },
    (value) => {
      required(
        value.local.views.find((view) => view.itemId === f.parentId)
      ).revision = 10
    },
    (value) => {
      required(value.local.views.find((view) => view.itemId !== f.parentId))
        .revision++
    },
    (value) => {
      value.observed.placements.pop()
    },
    (value) => {
      value.local.placements[0].revision = 0
    },
    (value) => {
      value.local.placements[0].createdAt = "2000-01-01T00:00:00.000Z"
    },
    (value) => {
      required(
        value.local.placements.find(
          (record) => record.occurrenceId === f.targetId
        )
      ).tagId = f.sourceId
    },
    (value) => {
      for (const catalog of [value.local, value.observed])
        required(
          catalog.tags.find((tag) => tag.id === f.destinationId)
        ).deletedAt = f.now
    },
    (value) => {
      value.operation.command.occurrenceId = `${crypto.randomUUID()}:2026-10-17`
    },
    (value) => {
      value.operation.command.date = "2026-10-25"
    },
    (value) => {
      required(
        value.local.views.find((view) => view.itemId === f.parentId)
      ).primaryTagId = f.sourceId
    },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(f.input)
    mutate(value)
    expect(() => reviewCategoryPlacementGroups(value)).toThrow()
  }
})
test("category review refuses a changed position from an unrelated category", () => {
  const f = categoryPlacementReviewFixture("simple"),
    value = structuredClone(f.input),
    peer = f.f.simple.items[1].id
  for (const catalog of [value.local, value.observed]) {
    required(catalog.views.find((view) => view.itemId === peer)).primaryTagId =
      f.tags[2].id
    required(
      catalog.placements.find((record) => record.occurrenceId === peer)
    ).tagId = f.tags[2].id
  }
  required(
    value.local.placements.find((record) => record.occurrenceId === peer)
  ).position++
  expect(() => reviewCategoryPlacementGroups(value)).toThrow()
})
test("category review input rejects excess catalogs, duplicate identities and extra fields", () => {
  const f = categoryPlacementReviewFixture()
  expect(() =>
    reviewCategoryPlacementGroups({ ...f.input, permission: true })
  ).toThrow()
  expect(
    categoryPlacementReviewInputSchema.safeParse({
      ...f.input,
      local: {
        ...f.input.local,
        items: Array(10001).fill(f.input.local.items[0]),
      },
    }).success
  ).toBe(false)
  expect(() =>
    reviewCategoryPlacementGroups({
      ...f.input,
      observed: {
        ...f.input.observed,
        placements: [
          ...f.input.observed.placements,
          f.input.observed.placements[0],
        ],
      },
    })
  ).toThrow()
})
