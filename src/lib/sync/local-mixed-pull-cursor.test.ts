import { expect, test } from "bun:test"
import { planLocalMixedPullCursor } from "@/lib/sync/local-mixed-pull-cursor"

const userId = "mixed-cursor-owner"
const now = "2026-10-08T00:00:00.000Z"
function cursor(after = 0, through: number | null = null) {
  return { key: "pull-cursor" as const, after, through }
}
function receipt(after = 0, through = 2, count = 1, frozen = false) {
  const changes = Array.from({ length: count }, (_, index) => {
    const operationId = crypto.randomUUID()
    const sequence = after + index + 1
    return {
      version: 2 as const,
      kind: "preference" as const,
      recipientUserId: userId,
      operationId,
      sequence,
      effects: {
        version: 1 as const,
        userId,
        operationId,
        sequence,
        effects: [
          {
            store: "tags" as const,
            record: {
              id: crypto.randomUUID(),
              userId,
              name: "Category",
              normalizedName: "category",
              color: "#123456",
              position: 0,
              revision: 1,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            },
          },
        ],
      },
    }
  })
  return {
    query: { after, through: frozen ? through : null, limit: 2 },
    page: {
      version: 2,
      changes,
      nextAfter: after + count,
      through,
      hasMore: after + count < through,
    },
  }
}

test("mixed cursor freezes the first checkpoint and releases it only after the final page", () => {
  const first = planLocalMixedPullCursor(receipt(), cursor(), userId)
  expect(first.status).toBe("applied")
  expect(first.cursor).toEqual(cursor(1, 2))
  const last = planLocalMixedPullCursor(
    receipt(1, 2, 1, true),
    first.cursor,
    userId
  )
  expect(last.status).toBe("applied")
  expect(last.cursor).toEqual(cursor(2))
  const empty = planLocalMixedPullCursor(receipt(2, 2, 0), last.cursor, userId)
  expect(empty.status).toBe("applied")
  expect(empty.cursor).toEqual(cursor(2))
})

test("mixed cursor ignores only fully overtaken pages and never rewinds a frozen checkpoint", () => {
  const input = receipt(0, 2, 2)
  const current = cursor(3, 5)
  const before = structuredClone({ input, current })
  const result = planLocalMixedPullCursor(input, current, userId)
  expect(result.status).toBe("ignored")
  expect(result.cursor).toEqual(current)
  result.cursor.after = 0
  result.receipt.page.changes[0].recipientUserId = "modified-clone"
  expect({ input, current }).toEqual(before)
  expect(planLocalMixedPullCursor(input, cursor(2), userId).status).toBe(
    "ignored"
  )
  expect(() =>
    planLocalMixedPullCursor(receipt(1, 4, 2), cursor(2, 4), userId)
  ).toThrow("changed")
  expect(() =>
    planLocalMixedPullCursor(receipt(3, 4, 1), cursor(2), userId)
  ).toThrow("changed")
})

test("mixed cursor requires the full query checkpoint to match the current stored checkpoint", () => {
  for (const [input, current] of [
    [receipt(1, 2, 1), cursor(1, 2)],
    [receipt(1, 2, 1, true), cursor(1)],
    [receipt(1, 3, 1, true), cursor(1, 2)],
  ] as const)
    expect(() => planLocalMixedPullCursor(input, current, userId)).toThrow(
      "changed"
    )
  const input = receipt()
  const before = structuredClone(input)
  const result = planLocalMixedPullCursor(input, cursor(), userId)
  result.receipt.query.after = 9
  result.cursor.through = 9
  expect(input).toEqual(before)
})

test("even overtaken mixed pages reject unsupported effects, corrupt records and invalid stored cursors", () => {
  const input = receipt(0, 2, 2)
  const first = input.page.changes[0]
  const last = input.page.changes[1]
  const unsupported = structuredClone(input)
  const effects = unsupported.page.changes[1].effects
  const settings = {
    ...last.effects.effects[0].record,
    timeZone: "Europe/Madrid",
    weekStartsOn: 1,
    locale: "es-ES",
  }
  const { id, name, normalizedName, color, position, ...record } = settings
  const withUnsupported = {
    ...unsupported,
    page: {
      ...unsupported.page,
      changes: [
        first,
        {
          ...last,
          effects: {
            ...effects,
            effects: [...effects.effects, { store: "settings", record }],
          },
        },
      ],
    },
  }
  expect(() =>
    planLocalMixedPullCursor(withUnsupported, cursor(2), userId)
  ).toThrow("personal store")
  const before = structuredClone(input)
  for (const invalid of [
    { ...input, page: { ...input.page, version: 3 } },
    { ...input, query: { ...input.query, limit: 1 } },
    { ...input, page: { ...input.page, changes: [first, first] } },
  ])
    expect(() => planLocalMixedPullCursor(invalid, cursor(2), userId)).toThrow()
  for (const invalid of [
    cursor(-1),
    cursor(2, 2),
    { ...cursor(2), extra: true },
    { ...cursor(2), key: "other" },
  ])
    expect(() => planLocalMixedPullCursor(input, invalid, userId)).toThrow()
  expect(() => planLocalMixedPullCursor(input, cursor(2), "other")).toThrow()
  expect(input).toEqual(before)
})
