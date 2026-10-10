import { expect, test } from "bun:test"
import { preparePlanSave } from "@/lib/calendar/plan-save"
import type { PlanSaveRequest } from "@/schemas/plan-save"
import { planSaveRequestSchema } from "@/schemas/plan-save"
import type { Tag } from "@/types/preferences"

const userId = "plan-save-test"
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const now = "2026-10-10T12:00:00.000Z"
const tag: Tag = {
  id: id(4),
  userId,
  name: "Personal",
  normalizedName: "personal",
  color: "#123abc",
  position: 1024,
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
const create: PlanSaveRequest = {
  mode: "create",
  itemId: id(1),
  contentOperationId: id(2),
  viewOperationId: id(3),
  now,
  primaryTagId: tag.id,
  input: {
    kind: "plan",
    variant: "task",
    title: "Common content",
    description: "Retained description",
    status: "in_progress",
    checklist: [{ id: id(5), text: "Retained step", completed: true }],
    recurrence: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
  },
}

test("a common save creates plan and category view with matching identity for every variant", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const result = preparePlanSave(
      { ...create, input: { ...create.input, variant } },
      null,
      null,
      tag,
      userId
    )
    expect(result.plan.variant).toBe(variant)
    expect(result.plan.checklist).toEqual(create.input.checklist)
    expect(result.view.primaryTagId).toBe(tag.id)
    expect(result.view.itemId).toBe(result.plan.id)
    expect(result.commands.view.type).toBe("item-view.set")
  }
})

test("update compares both editor snapshots and preserves completion/category semantics", () => {
  const initial = preparePlanSave(create, null, null, tag, userId)
  const update: PlanSaveRequest = {
    ...create,
    mode: "update",
    expectedPlan: initial.plan,
    expectedView: initial.view,
    contentOperationId: id(6),
    viewOperationId: id(7),
    now: "2026-10-10T13:00:00.000Z",
    primaryTagId: null,
    input: { ...create.input, variant: "note", status: "completed" },
  }
  const result = preparePlanSave(
    update,
    initial.plan,
    initial.view,
    null,
    userId
  )
  expect(result.plan.id).toBe(initial.plan.id)
  expect(result.plan.completedAt).toBe(update.now)
  expect(result.plan.checklist).toEqual(initial.plan.checklist)
  expect(result.view.primaryTagId).toBeNull()
  expect(() =>
    preparePlanSave(
      update,
      { ...initial.plan, title: "Other edit" },
      initial.view,
      null,
      userId
    )
  ).toThrow("Plan changed")
  expect(() =>
    preparePlanSave(
      update,
      initial.plan,
      { ...initial.view, primaryTagId: null },
      null,
      userId
    )
  ).toThrow("Plan category changed")
  expect(() =>
    preparePlanSave(update, initial.plan, null, null, userId)
  ).toThrow("Plan category changed")
})

test("save refuses foreign or deleted categories, reused IDs and mismatched snapshots", () => {
  expect(() => preparePlanSave(create, null, null, null, userId)).toThrow(
    "Active category"
  )
  expect(() =>
    preparePlanSave(
      create,
      null,
      null,
      { ...tag, userId: "other-account" },
      userId
    )
  ).toThrow("Active category")
  expect(() =>
    preparePlanSave(create, null, null, { ...tag, deletedAt: now }, userId)
  ).toThrow("Active category")
  expect(
    planSaveRequestSchema.safeParse({
      ...create,
      viewOperationId: create.contentOperationId,
    }).success
  ).toBe(false)
  const initial = preparePlanSave(create, null, null, tag, userId)
  expect(() =>
    preparePlanSave(create, initial.plan, initial.view, tag, userId)
  ).toThrow("reuse")
  expect(
    planSaveRequestSchema.safeParse({
      ...create,
      mode: "update",
      expectedPlan: { ...initial.plan, id: id(9) },
      expectedView: initial.view,
    }).success
  ).toBe(false)
  expect(() =>
    preparePlanSave(
      {
        ...create,
        mode: "update",
        expectedPlan: { ...initial.plan, ownerId: "foreign" },
        expectedView: initial.view,
      },
      initial.plan,
      initial.view,
      tag,
      userId
    )
  ).toThrow("another account")
})
