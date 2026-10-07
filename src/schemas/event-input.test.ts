import { expect, test } from "bun:test"
import { applyLocalItemCommand } from "@/lib/local-db/item-mutation"
import { eventDraftSchema, eventSchema } from "@/schemas/calendar-item"
import { eventInputSchema } from "@/schemas/event-input"

const input = {
  kind: "event" as const,
  title: "Test event",
  description: "",
  recurrence: null,
  schedule: {
    mode: "timed" as const,
    localStart: "2026-10-07T23:30",
    localEnd: "2026-10-08T00:30",
    timeZone: "Europe/Madrid",
  },
}
const id = "692f7605-e039-460d-96e8-cf38a665d0e1"
const now = "2026-10-07T09:00:00.000Z"

test("event input validates exact time while stored schemas keep historical schedules readable", () => {
  expect(eventInputSchema.safeParse(input).success).toBe(true)
  for (const localStart of ["2026-03-29T02:30", "2026-10-25T02:30"]) {
    const invalid = {
      ...input,
      schedule: { ...input.schedule, localStart, localEnd: null },
    }
    expect(eventDraftSchema.safeParse(invalid).success).toBe(true)
    const validation = eventInputSchema.safeParse(invalid)
    expect(validation.success).toBe(false)
    if (!validation.success)
      expect(validation.error.issues[0].path).toEqual(["schedule"])
    expect(() =>
      applyLocalItemCommand(
        null,
        { type: "item.create", itemId: id, input: invalid },
        "owner",
        now
      )
    ).toThrow()
  }
  expect(
    eventInputSchema.safeParse({
      ...input,
      schedule: { ...input.schedule, localEnd: "2026-10-07T22:00" },
    }).success
  ).toBe(false)
  expect(
    eventInputSchema.safeParse({
      ...input,
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-07",
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      },
    }).success
  ).toBe(false)
})

test("event mutations preserve revision, metadata and historical deletion without task fields", () => {
  const created = applyLocalItemCommand(
    null,
    { type: "item.create", itemId: id, input },
    "owner",
    now
  )
  expect(created).not.toHaveProperty("status")
  expect(created).not.toHaveProperty("checklist")
  expect(created).not.toHaveProperty("completedAt")
  const legacy = eventSchema.parse({
    ...created,
    revision: 7,
    schedule: {
      ...input.schedule,
      localStart: "2026-10-25T02:30",
      localEnd: null,
    },
  })
  const updated = applyLocalItemCommand(
    legacy,
    {
      type: "item.update",
      itemId: id,
      input: { ...input, title: "Edited event" },
    },
    "owner",
    now
  )
  expect(updated.revision).toBe(7)
  expect(updated.createdAt).toBe(now)
  expect(updated.title).toBe("Edited event")
  expect(legacy.schedule).toMatchObject({ localStart: "2026-10-25T02:30" })
  const deleted = applyLocalItemCommand(
    legacy,
    { type: "item.delete", itemId: id },
    "owner",
    now
  )
  expect(deleted.deletedAt).toBe(now)
  expect(deleted).toMatchObject({ schedule: legacy.schedule, revision: 7 })
  expect(() =>
    applyLocalItemCommand(
      legacy,
      { type: "item.update", itemId: id, input },
      "other",
      now
    )
  ).toThrow()
})
