import { describe, expect, test } from "bun:test"
import { applyPlanCommand } from "@/lib/calendar/plan-command"
import {
  planDraftSchema,
  planSchema,
  planVariantSchema,
} from "@/schemas/plan-item"
import type { PlanDraft } from "@/types/plan-item"

const id = "b2d10a29-73af-4b53-a753-53e4dba1b110"
const stepId = "b2d10a29-73af-4b53-a753-53e4dba1b111"
const now = "2026-10-10T09:00:00.000Z"
const later = "2026-10-10T10:00:00.000Z"
const draft: PlanDraft = {
  kind: "plan",
  variant: "task",
  title: "Common plan",
  description: "Description",
  schedule: {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-11",
  },
  status: "not_started",
  checklist: [{ id: stepId, text: "First step", completed: false }],
  recurrence: null,
}
const create = (input: PlanDraft = draft) =>
  applyPlanCommand(
    null,
    { type: "item.create", itemId: id, input },
    "owner",
    now
  )

describe("common plan mutations", () => {
  for (const variant of planVariantSchema.options) {
    test(`${variant} supports identical options and progress`, () => {
      const initial = create({ ...draft, variant })
      const started = applyPlanCommand(
        initial,
        { type: "plan.set-status", itemId: id, status: "in_progress" },
        "owner",
        later
      )
      const checked = applyPlanCommand(
        started,
        {
          type: "plan.set-checklist-entry",
          itemId: id,
          entryId: stepId,
          completed: true,
        },
        "owner",
        later
      )
      const completed = applyPlanCommand(
        checked,
        { type: "plan.set-status", itemId: id, status: "completed" },
        "owner",
        later
      )
      expect(completed.variant).toBe(variant)
      expect(completed.checklist[0].completed).toBe(true)
      expect(completed.completedAt).toBe(later)
      const repeated = applyPlanCommand(
        completed,
        { type: "plan.set-status", itemId: id, status: "completed" },
        "owner",
        "2026-10-10T11:00:00.000Z"
      )
      expect(repeated.completedAt).toBe(later)
      const reopened = applyPlanCommand(
        repeated,
        { type: "plan.set-status", itemId: id, status: "not_started" },
        "owner",
        later
      )
      expect(reopened.completedAt).toBeNull()
      expect(initial.checklist[0].completed).toBe(false)
    })
    test(`${variant} validates common schedule and recurrence`, () => {
      const input = {
        ...draft,
        variant,
        recurrence: {
          frequency: "daily",
          anchorDate: "2026-10-10",
          timeZone: "Europe/Madrid",
          interval: 1,
          end: { type: "never" },
        },
      }
      expect(planDraftSchema.safeParse(input).success).toBe(true)
      expect(
        planDraftSchema.safeParse({
          ...input,
          recurrence: { ...input.recurrence, anchorDate: "2026-10-11" },
        }).success
      ).toBe(false)
      const timed = {
        ...input,
        schedule: {
          mode: "timed",
          localStart: "2026-10-10T10:00",
          localEnd: "2026-10-10T11:00",
          timeZone: "Europe/Madrid",
        },
      }
      expect(planDraftSchema.safeParse(timed).success).toBe(true)
      expect(
        planDraftSchema.safeParse({
          ...timed,
          recurrence: { ...input.recurrence, timeZone: "UTC" },
        }).success
      ).toBe(false)
    })
  }
  test("changing presentation preserves identity, timestamps, progress and options", () => {
    let current = create({ ...draft, status: "completed" })
    for (const variant of planVariantSchema.options) {
      current = applyPlanCommand(
        current,
        {
          type: "item.update",
          itemId: id,
          input: { ...draft, variant, status: "completed" },
        },
        "owner",
        later
      )
      expect(current.id).toBe(id)
      expect(current.createdAt).toBe(now)
      expect(current.completedAt).toBe(now)
      expect(current.checklist).toEqual(draft.checklist)
      expect(current.schedule).toEqual(draft.schedule)
    }
  })
  test("rejects missing, foreign, deleted, duplicate and malformed mutations", () => {
    const initial = create()
    const remove = { type: "item.delete", itemId: id }
    expect(() => applyPlanCommand(null, remove, "owner", later)).toThrow()
    expect(() => applyPlanCommand(initial, remove, "foreign", later)).toThrow()
    expect(() =>
      applyPlanCommand(
        initial,
        { type: "item.create", itemId: id, input: draft },
        "owner",
        later
      )
    ).toThrow()
    const deleted = applyPlanCommand(initial, remove, "owner", later)
    expect(deleted.deletedAt).toBe(later)
    expect(() => applyPlanCommand(deleted, remove, "owner", later)).toThrow()
    expect(() =>
      applyPlanCommand(
        initial,
        {
          type: "plan.set-checklist-entry",
          itemId: id,
          entryId: id,
          completed: true,
        },
        "owner",
        later
      )
    ).toThrow()
    expect(
      planDraftSchema.safeParse({ ...draft, ownerId: "foreign" }).success
    ).toBe(false)
    expect(
      planDraftSchema.safeParse({
        ...draft,
        checklist: [...draft.checklist, ...draft.checklist],
      }).success
    ).toBe(false)
    expect(planSchema.safeParse({ ...initial, completedAt: now }).success).toBe(
      false
    )
    expect(() =>
      create({
        ...draft,
        schedule: {
          mode: "timed",
          localStart: "2026-03-29T02:30",
          localEnd: null,
          timeZone: "Europe/Madrid",
        },
      })
    ).toThrow()
    expect(() =>
      create({
        ...draft,
        schedule: {
          mode: "timed",
          localStart: "2026-10-25T02:30",
          localEnd: null,
          timeZone: "Europe/Madrid",
        },
      })
    ).toThrow()
  })
  test("recurring parents accept content but require occurrence progress", () => {
    const parent = create({
      ...draft,
      recurrence: {
        frequency: "daily",
        anchorDate: "2026-10-10",
        timeZone: "Europe/Madrid",
        interval: 1,
        end: { type: "never" },
      },
    })
    expect(() =>
      applyPlanCommand(
        parent,
        { type: "plan.set-status", itemId: id, status: "completed" },
        "owner",
        later
      )
    ).toThrow("occurrence")
    expect(() =>
      applyPlanCommand(
        parent,
        {
          type: "plan.set-checklist-entry",
          itemId: id,
          entryId: stepId,
          completed: true,
        },
        "owner",
        later
      )
    ).toThrow("occurrence")
  })
})
