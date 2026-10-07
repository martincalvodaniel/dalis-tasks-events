import { describe, expect, test } from "bun:test"
import { compareRank, planRankMove } from "@/lib/ordering/rank"

const records = [
  { id: "a", position: 0 },
  { id: "b", position: 1024 },
  { id: "c", position: 2048 },
]
function reordered(beforeId: string | null, afterId: string | null) {
  const positions = planRankMove(records, "c", { beforeId, afterId })
  return records
    .map((record) => ({
      ...record,
      position: positions.get(record.id) ?? record.position,
    }))
    .toSorted(compareRank)
    .map((record) => record.id)
}

describe("personal ranking", () => {
  test("moves to the beginning, middle and end without mutating its input", () => {
    const snapshot = JSON.stringify(records)
    expect(reordered("a", null)).toEqual(["c", "a", "b"])
    expect(reordered("b", "a")).toEqual(["a", "c", "b"])
    expect(reordered(null, "b")).toEqual(["a", "b", "c"])
    expect(JSON.stringify(records)).toBe(snapshot)
    expect([
      ...planRankMove([records[0]], "a", { beforeId: null, afterId: null }),
    ]).toEqual([["a", 0]])
  })
  test("rejects missing, non-adjacent, self and duplicate neighbors", () => {
    for (const neighbors of [
      { beforeId: null, afterId: null },
      { beforeId: "b", afterId: null },
      { beforeId: "a", afterId: "b" },
      { beforeId: "missing", afterId: null },
      { beforeId: null, afterId: "missing" },
      { beforeId: "c", afterId: null },
      { beforeId: "a", afterId: "a" },
    ])
      expect(() => planRankMove(records, "c", neighbors)).toThrow()
    expect(() =>
      planRankMove(records, "missing", { beforeId: "a", afterId: null })
    ).toThrow()
    expect(() =>
      planRankMove([records[0], records[0]], "a", {
        beforeId: null,
        afterId: null,
      })
    ).toThrow()
  })
  test("compacts equal or adjacent floating point positions deterministically", () => {
    for (const gap of [0, Number.EPSILON]) {
      const exhausted = [
        { id: "a", position: 1 },
        { id: "b", position: 1 + gap },
        { id: "c", position: 20 },
      ]
      const changes = planRankMove(exhausted, "c", {
        beforeId: "b",
        afterId: "a",
      })
      expect([...changes]).toEqual([
        ["a", -1024],
        ["c", 0],
        ["b", 1024],
      ])
      expect([
        ...planRankMove(exhausted.toReversed(), "c", {
          beforeId: "b",
          afterId: "a",
        }),
      ]).toEqual([...changes])
    }
  })
  test("compacts both range boundaries and rejects corrupt positions", () => {
    for (const limit of [-1e12, 1e12]) {
      const neighbor = { id: "a", position: limit }
      const changes = planRankMove([neighbor, records[1]], "b", {
        beforeId: limit < 0 ? "a" : null,
        afterId: limit > 0 ? "a" : null,
      })
      const ordered = [neighbor, records[1]]
        .map((record) => ({ ...record, position: changes.get(record.id) ?? 0 }))
        .toSorted(compareRank)
      expect(ordered.map((record) => record.id)).toEqual(
        limit < 0 ? ["b", "a"] : ["a", "b"]
      )
      expect(ordered.every((record) => Math.abs(record.position) <= 1e12)).toBe(
        true
      )
    }
    expect(() =>
      planRankMove([{ id: "a", position: Number.NaN }], "a", {
        beforeId: null,
        afterId: null,
      })
    ).toThrow()
  })
})
