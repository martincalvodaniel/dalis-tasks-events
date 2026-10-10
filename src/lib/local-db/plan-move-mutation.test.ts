import { expect, test } from "bun:test"
import { planLocalPlanMove } from "@/lib/local-db/plan-move-mutation"
import {
  placementSyncCapabilityPolicy,
  planSyncCapabilityPolicy,
} from "@/lib/sync/sync-capabilities"
import { planSchema } from "@/schemas/plan-item"
import { tagSchema, userSettingsSchema } from "@/schemas/preferences"

const owner = "common-move-owner"
const now = "2026-10-10T12:00:00.000Z"
const metadata = {
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
const tag = tagSchema.parse({
  ...metadata,
  id: crypto.randomUUID(),
  userId: owner,
  name: "Own",
  normalizedName: "own",
  color: "#2563eb",
  position: 0,
})
function plan(
  variant: "task" | "event" | "appointment" | "note",
  startDate = "2026-10-10",
  endDateExclusive = "2026-10-11"
) {
  return planSchema.parse({
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: owner,
    kind: "plan",
    variant,
    title: variant,
    description: "",
    schedule: { mode: "all_day", startDate, endDateExclusive },
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
  })
}
function snapshot(items: ReturnType<typeof plan>[]) {
  return {
    items,
    tags: [tag],
    views: items.map((item) => ({
      ...metadata,
      userId: owner,
      itemId: item.id,
      primaryTagId: tag.id,
    })),
    placements: [],
    settings: userSettingsSchema.parse({
      ...metadata,
      userId: owner,
      timeZone: "Europe/Madrid",
      weekStartsOn: 1,
      locale: "es-ES",
    }),
  }
}
function command(
  target: ReturnType<typeof plan>,
  peer: ReturnType<typeof plan>
) {
  return {
    type: "task.move" as const,
    itemId: target.id,
    occurrenceId: null,
    scope: "day" as const,
    date: "2026-10-10",
    tagId: tag.id,
    beforeId: peer.id,
    afterId: null,
  }
}

test("local four-variant movement retains revision zero and mixed chronological peers", () => {
  const items = [plan("task"), plan("event"), plan("appointment"), plan("note")]
  const value = snapshot(items)
  const input = command(items[3], items[0])
  const before = structuredClone(value)
  const result = planLocalPlanMove(value, input, owner, now)
  expect(result.current).toBeNull()
  expect(result.placements).toHaveLength(4)
  expect(result.placements.every((record) => record.revision === 0)).toBe(true)
  const moved = result.placements.find(
    (record) => record.occurrenceId === items[3].id
  )
  const first = result.placements.find(
    (record) => record.occurrenceId === items[0].id
  )
  expect(moved?.position).toBeLessThan(first?.position ?? 0)
  expect(value).toEqual(before)
  expect(planSyncCapabilityPolicy.readCommand(input, items[3]).supported).toBe(
    true
  )
  expect(
    placementSyncCapabilityPolicy.readCommand(input, items[3]).supported
  ).toBe(false)
})

test("local movement accepts interval day and rejects stale civil contexts and inaccessible peers", () => {
  const target = plan("appointment", "2026-10-09", "2026-10-12")
  const peer = plan("event")
  const input = command(target, peer)
  expect(
    planLocalPlanMove(snapshot([target, peer]), input, owner, now).placements
  ).toHaveLength(2)
  for (const invalid of [
    { ...input, date: "2026-10-14" },
    { ...input, tagId: crypto.randomUUID() },
    { ...input, beforeId: crypto.randomUUID() },
    { ...input, occurrenceId: `${target.id}@2026-10-10` },
  ])
    expect(() =>
      planLocalPlanMove(snapshot([target, peer]), invalid, owner, now)
    ).toThrow()
  expect(() =>
    planLocalPlanMove(snapshot([target, peer]), input, "foreign", now)
  ).toThrow()
})

test("overdue movement declares current account day but retains a canonical placement date", () => {
  const target = plan("note", "2026-10-08", "2026-10-09"),
    peer = plan("task", "2026-10-09", "2026-10-10")
  const input = { ...command(target, peer), scope: "overdue" as const }
  const result = planLocalPlanMove(snapshot([target, peer]), input, owner, now)
  expect(result.placements).toHaveLength(2)
  expect(new Set(result.placements.map((record) => record.date)).size).toBe(1)
  expect(result.placements[0].date).not.toBe(input.date)
  expect(() =>
    planLocalPlanMove(
      snapshot([target, peer]),
      { ...input, date: "2026-10-11" },
      owner,
      now
    )
  ).toThrow()
})
