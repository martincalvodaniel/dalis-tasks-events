import { expect, test } from "bun:test"
import { compareRank } from "@/lib/ordering/rank"
import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import type { Tag } from "@/types/preferences"
import type { SyncCommand } from "@/types/sync"

const userId = "remote-tag-test-owner"
const createdAt = "2026-10-07T00:00:00.000Z"
const timestamp = "2026-10-08T00:00:00.000Z"
const ids = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
]
function tag(index = 0): Tag {
  return {
    id: ids[index],
    userId,
    name: `Category ${index}`,
    normalizedName: `category ${index}`,
    color: "#059669",
    position: index * 1024,
    revision: index + 1,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  }
}
function input(command: SyncCommand, tags: Tag[] = [], baseRevision = 0) {
  return {
    userId,
    timestamp,
    tags,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1 as const,
      baseRevision,
      command,
    },
  }
}
function save(tagId = ids[0], name = "Trabajo"): SyncCommand {
  return {
    type: "tag.save",
    tagId,
    input: { name, color: "#ffffff", position: -0.5 },
  }
}

test("remote category planning creates and advances only the requested effects", () => {
  const value = input(save())
  const original = JSON.stringify(value)
  const created = planRemoteTagOperation(value)
  expect(created.status).toBe("changes")
  if (created.status !== "changes") throw new Error("Creation plan missing")
  expect(created.effects).toHaveLength(1)
  const record = created.effects[0].record
  expect(record.revision).toBe(1)
  expect(record.createdAt).toBe(timestamp)
  expect(record.updatedAt).toBe(timestamp)
  expect(JSON.stringify(value)).toBe(original)
  const previous = tag()
  const updated = planRemoteTagOperation(input(save(), [previous], 1))
  expect(updated.status).toBe("changes")
  if (updated.status !== "changes") throw new Error("Update plan missing")
  expect(updated.effects[0].record.revision).toBe(2)
  expect(updated.effects[0].record.createdAt).toBe(createdAt)
  const deleted = planRemoteTagOperation(
    input({ type: "tag.delete", tagId: ids[0] }, [previous], 1)
  )
  expect(deleted.status).toBe("changes")
  if (deleted.status !== "changes") throw new Error("Deletion plan missing")
  expect(deleted.effects[0].record.deletedAt).toBe(timestamp)
  expect(deleted.effects[0].record.revision).toBe(2)
  expect(previous.deletedAt).toBeNull()
})

test("category CAS and tombstones preserve current state without resurrections", () => {
  const current = tag()
  const stale = planRemoteTagOperation(input(save(), [current], 0))
  expect(stale).toEqual({ status: "conflict", current })
  if (stale.status !== "conflict") throw new Error("Conflict plan missing")
  stale.current.name = "Changed caller copy"
  expect(current.name).toBe("Category 0")
  const tombstone = { ...current, deletedAt: createdAt }
  expect(planRemoteTagOperation(input(save(), [tombstone], 1))).toEqual({
    status: "conflict",
    current: tombstone,
  })
  expect(planRemoteTagOperation(input(save(), [], 1))).toEqual({
    status: "unavailable",
  })
  expect(
    planRemoteTagOperation(input({ type: "tag.delete", tagId: ids[0] }))
  ).toEqual({ status: "unavailable" })
})

test("active category normalization rejects collisions but deleted names may be reused", () => {
  const current = { ...tag(), name: "Work", normalizedName: "work" }
  expect(
    planRemoteTagOperation(input(save(ids[1], "ＷＯＲＫ"), [current]))
  ).toEqual({ status: "invalid_command" })
  const deleted = { ...current, deletedAt: createdAt }
  const planned = planRemoteTagOperation(
    input(save(ids[1], "ＷＯＲＫ"), [deleted])
  )
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes" || planned.effects[0].store !== "tags")
    throw new Error("Creation plan missing")
  expect(planned.effects[0].record.normalizedName).toBe("work")
  expect(deleted.deletedAt).toBe(createdAt)
})

test("movement compaction advances each affected revision and preserves other records", () => {
  const tags = [tag(0), { ...tag(1), position: 0 }, tag(2)]
  const deleted = { ...tag(), id: crypto.randomUUID(), deletedAt: createdAt }
  const value = input(
    { type: "tag.move", tagId: ids[2], beforeId: ids[1], afterId: ids[0] },
    [...tags, deleted],
    3
  )
  const original = JSON.stringify(value)
  const planned = planRemoteTagOperation(value)
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes") throw new Error("Movement plan missing")
  expect(planned.effects).toHaveLength(3)
  const records = planned.effects.map((effect) => {
    if (effect.store !== "tags") throw new Error("Non-category effect")
    return effect.record
  })
  expect(records.toSorted(compareRank).map((record) => record.id)).toEqual([
    ids[0],
    ids[2],
    ids[1],
  ])
  expect(records.map((record) => record.revision)).toEqual([2, 3, 4])
  expect(
    records.every(
      (record) =>
        record.createdAt === createdAt && record.updatedAt === timestamp
    )
  ).toBe(true)
  expect(records.some((record) => record.id === deleted.id)).toBe(false)
  expect(JSON.stringify(value)).toBe(original)
  expect(
    planRemoteTagOperation(
      input(
        { type: "tag.move", tagId: ids[2], beforeId: ids[0], afterId: ids[1] },
        tags,
        3
      )
    )
  ).toEqual({ status: "invalid_command" })
})

test("invalid remote snapshots and revision overflow fail before a partial plan", () => {
  const current = tag()
  for (const records of [
    [{ ...current, userId: "other" }],
    [current, current],
    [
      current,
      { ...tag(1), name: current.name, normalizedName: current.normalizedName },
    ],
    [{ ...current, revision: 0 }],
  ])
    expect(() => planRemoteTagOperation(input(save(), records, 1))).toThrow()
  expect(() =>
    planRemoteTagOperation(
      input(
        save(),
        [{ ...current, revision: Number.MAX_SAFE_INTEGER }],
        Number.MAX_SAFE_INTEGER
      )
    )
  ).toThrow()
  const future = input(save())
  future.operation.protocolVersion = 2 as 1
  expect(() => planRemoteTagOperation(future)).toThrow()
  expect(
    planRemoteTagOperation(
      input({
        type: "settings.update",
        input: { timeZone: "Europe/Madrid", weekStartsOn: 1, locale: "es-ES" },
      })
    )
  ).toEqual({ status: "unsupported" })
})

test("a large multirecord compaction cannot truncate its remote effects", () => {
  const tags = Array.from({ length: 1500 }, (_, index) => ({
    ...tag(),
    id: crypto.randomUUID(),
    name: `${index} ${"ñ".repeat(50)}`,
    normalizedName: `${index} ${"ñ".repeat(50)}`,
    position: 0,
  }))
  tags.sort(compareRank)
  const target = tags.at(-1)
  if (!target) throw new Error("Fixture target missing")
  const value = input(
    {
      type: "tag.move",
      tagId: target.id,
      beforeId: tags[1].id,
      afterId: tags[0].id,
    },
    tags,
    1
  )
  const original = JSON.stringify(value)
  expect(planRemoteTagOperation(value)).toEqual({ status: "invalid_command" })
  expect(JSON.stringify(value)).toBe(original)
})
