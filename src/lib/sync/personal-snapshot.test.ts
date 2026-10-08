import { expect, test } from "bun:test"
import { validatePersonalSnapshot } from "@/lib/sync/personal-snapshot"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import type { PersonalSnapshot } from "@/types/personal-snapshot"

const actor = "snapshot-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
function fixture(): PersonalSnapshot {
  const id = crypto.randomUUID()
  return [
    {
      entityKey: `tag:${id}`,
      record: {
        store: "tags",
        record: {
          userId: actor,
          id,
          name: "Local",
          normalizedName: "local",
          color: "#123456",
          position: 1024,
          revision: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        },
      },
    },
    { entityKey: `item-view:${crypto.randomUUID()}`, record: null },
  ]
}

test("personal snapshots preserve optimistic revision zero, absence and cloned tombstones", () => {
  const input = fixture()
  if (!input[0].record) throw new Error("Expected local record")
  input[0].record.record.deletedAt = timestamp
  const before = structuredClone(input)
  const keys = input.map((entry) => entry.entityKey)
  const result = validatePersonalSnapshot(input, actor, keys.toReversed())
  expect(result).toEqual(input)
  if (!result[0].record) throw new Error("Expected observed record")
  expect(result[0].record.record.revision).toBe(0)
  expect(result[1].record).toBeNull()
  result[0].record.record.revision = 9
  expect(input).toEqual(before)
  expect(validatePersonalSnapshot([], actor, [])).toEqual([])
})

test("snapshots require exactly the externally requested identities and their account", () => {
  const input = fixture()
  const keys = input.map((entry) => entry.entityKey)
  for (const invalid of [
    input.slice(0, 1),
    [...input, input[0]],
    [...input, { entityKey: `tag:${crypto.randomUUID()}`, record: null }],
    [{ ...input[0], entityKey: input[1].entityKey }, input[1]],
  ])
    expect(() => validatePersonalSnapshot(invalid, actor, keys)).toThrow()
  expect(() => validatePersonalSnapshot(input, "foreign", keys)).toThrow()
  expect(() =>
    validatePersonalSnapshot(input, actor, [keys[0], keys[0]])
  ).toThrow()
  const absentSettings = [{ entityKey: "settings:foreign", record: null }]
  expect(() =>
    validatePersonalSnapshot(absentSettings, actor, ["settings:foreign"])
  ).toThrow()
  expect(
    validatePersonalSnapshot(
      [{ entityKey: `settings:${actor}`, record: null }],
      actor,
      [`settings:${actor}`]
    )
  ).toEqual([{ entityKey: `settings:${actor}`, record: null }])
})

test("extra, future stores, malformed identities and unsupported data shapes reject", () => {
  const input = fixture()
  const keys = input.map((entry) => entry.entityKey)
  for (const invalid of [
    [{ ...input[0], version: 3 }, input[1]],
    [{ ...input[0], unexpected: true }, input[1]],
    [{ ...input[0], record: { store: "future", record: {} } }, input[1]],
    [{ ...input[0], entityKey: "tag:invalid" }, input[1]],
    { version: 2, records: input },
  ])
    expect(() => validatePersonalSnapshot(invalid, actor, keys)).toThrow()
  expect(() => validatePersonalSnapshot(input, "", keys)).toThrow()
})

test("snapshot UTF8 bounds apply to the complete set rather than its valid documents", () => {
  const records = Array.from({ length: 7000 }, () => {
    const value = fixture()[0]
    if (value.record?.store !== "tags") throw new Error("Expected category")
    value.record.record.name = "漢".repeat(60)
    value.record.record.normalizedName = value.record.record.name
    return value
  })
  expect(personalSnapshotSchema.safeParse(records.slice(0, 1)).success).toBe(
    true
  )
  expect(() =>
    validatePersonalSnapshot(
      records,
      actor,
      records.map((entry) => entry.entityKey)
    )
  ).toThrow("Personal snapshot exceeds its byte limit")
})

test("observed overdue records and their keys retain the same canonical civil date", () => {
  const occurrenceId = crypto.randomUUID()
  const entityKey = taskPlacementEntityKey(
    occurrenceId,
    "overdue",
    "2026-10-08"
  )
  const record = {
    userId: actor,
    occurrenceId,
    scope: "overdue" as const,
    date: "0001-01-01",
    tagId: null,
    position: 1024,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const input: PersonalSnapshot = [
    { entityKey, record: { store: "taskPlacements", record } },
  ]
  expect(validatePersonalSnapshot(input, actor, [entityKey])).toEqual(input)
  expect(() =>
    validatePersonalSnapshot(
      [
        {
          entityKey,
          record: {
            store: "taskPlacements",
            record: { ...record, date: "2026-10-08" },
          },
        },
      ],
      actor,
      [entityKey]
    )
  ).toThrow()
})
