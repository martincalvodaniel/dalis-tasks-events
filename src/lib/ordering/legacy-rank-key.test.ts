import { describe, expect, test } from "bun:test"
import { legacyRankOrderKey } from "@/lib/ordering/legacy-rank-key"
import { compareRank } from "@/lib/ordering/rank"

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

describe("legacy rank order keys", () => {
  test("preserves extremes, signed zeros and adjacent floating point ranks", () => {
    const positions = [
      -1e12,
      -1,
      -Number.MIN_VALUE,
      -0,
      0,
      Number.MIN_VALUE,
      1,
      1 + Number.EPSILON,
      1e12,
    ]
    const records = positions.flatMap((position) =>
      ["a", "a:0001-01-01", "a:9999-12-31", "b"].map((id) => ({
        id,
        position,
      }))
    )
    for (const left of records)
      for (const right of records)
        expect(
          compareKeys(legacyRankOrderKey(left), legacyRankOrderKey(right))
        ).toBe(Math.sign(compareRank(left, right)))
    expect(legacyRankOrderKey({ id: "same", position: -0 })).toBe(
      legacyRankOrderKey({ id: "same", position: 0 })
    )
  })

  test("matches a numeric oracle for deterministic mixed ranks without mutation", () => {
    let seed = 1729
    const records = Array.from({ length: 2048 }, (_, index) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const position = ((seed / 2 ** 32) * 2 - 1) * 10 ** ((index % 320) - 308)
      return { id: `task-${index}`, position }
    })
    records.push(
      ...records
        .slice(0, 64)
        .map((record) => ({ ...record, id: `${record.id}:slot` }))
    )
    const snapshot = JSON.stringify(records)
    const keyed = records.map((record) => ({
      record,
      key: legacyRankOrderKey(record),
    }))
    expect(
      keyed
        .toSorted((left, right) => compareKeys(left.key, right.key))
        .map(({ record }) => record)
    ).toEqual(records.toSorted(compareRank))
    expect(JSON.stringify(records)).toBe(snapshot)
    expect(keyed.every(({ key }) => /^[0-9a-f]{16}:/.test(key))).toBe(true)
  })

  test("retains binary identity ordering for equal positions", () => {
    const records = ["a", "a:", "A", "a_", "a-", "á", ""].map((id) => ({
      id,
      position: 1024,
    }))
    expect(
      records.toSorted((left, right) =>
        compareKeys(legacyRankOrderKey(left), legacyRankOrderKey(right))
      )
    ).toEqual(records.toSorted(compareRank))
  })

  test("rejects non-finite and out-of-range ranks", () => {
    for (const position of [NaN, Infinity, -Infinity, 1e12 + 1, -1e12 - 1])
      expect(() => legacyRankOrderKey({ id: "task", position })).toThrow()
  })
})
