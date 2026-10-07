import { expect, test } from "bun:test"
import {
  adjacentMoveNeighbors,
  dropMoveNeighbors,
  visibleMoveNeighbors,
} from "@/lib/ordering/move-neighbors"
import { compareRank, planRankMove } from "@/lib/ordering/rank"

test("adjacent controls communicate neighbors for the actual resulting order", () => {
  const ids = ["a", "b", "c"]
  expect(adjacentMoveNeighbors(ids, "a", "up")).toBeNull()
  expect(adjacentMoveNeighbors(ids, "c", "down")).toBeNull()
  expect(adjacentMoveNeighbors(ids, "missing", "up")).toBeNull()
  for (const [id, direction, expected] of [
    ["a", "down", ["b", "a", "c"]],
    ["b", "up", ["b", "a", "c"]],
    ["b", "down", ["a", "c", "b"]],
    ["c", "up", ["a", "c", "b"]],
  ] as const) {
    const neighbors = adjacentMoveNeighbors(ids, id, direction)
    expect(neighbors).not.toBeNull()
    if (!neighbors) throw new Error("Expected movement neighbors")
    const rows = ids.map((id, index) => ({ id, position: index * 1024 }))
    const ranks = planRankMove(rows, id, neighbors)
    expect(
      rows
        .map((row) => ({ ...row, position: ranks.get(row.id) ?? row.position }))
        .toSorted(compareRank)
        .map((row) => row.id)
    ).toEqual([...expected])
  }
})

test("drop neighbors ignore unchanged positions and invalid or self targets", () => {
  const ids = ["a", "b", "c", "d"]
  expect(dropMoveNeighbors(ids, "b", "a", "after")).toBeNull()
  expect(dropMoveNeighbors(ids, "b", "c", "before")).toBeNull()
  expect(dropMoveNeighbors(ids, "b", "b", "after")).toBeNull()
  expect(dropMoveNeighbors(ids, "b", "missing", "after")).toBeNull()
  expect(dropMoveNeighbors(ids, "missing", "a", "after")).toBeNull()
  expect(dropMoveNeighbors(ids, "d", "a", "before")).toEqual({
    beforeId: "a",
    afterId: null,
  })
  expect(dropMoveNeighbors(ids, "a", "d", "after")).toEqual({
    beforeId: null,
    afterId: "d",
  })
  expect(dropMoveNeighbors(ids, "d", "b", "after")).toEqual({
    beforeId: "c",
    afterId: "b",
  })
  expect(ids).toEqual(["a", "b", "c", "d"])
})

test("visible group moves jump empty categories while retaining valid full-list neighbors", () => {
  const ids = ["a", "empty", "b"]
  const visible = ["a", "b"]
  expect(visibleMoveNeighbors(ids, visible, "b", "up")).toEqual({
    beforeId: "a",
    afterId: null,
  })
  expect(visibleMoveNeighbors(ids, visible, "a", "down")).toEqual({
    beforeId: null,
    afterId: "b",
  })
  expect(visibleMoveNeighbors(ids, visible, "a", "up")).toBeNull()
  expect(visibleMoveNeighbors(ids, visible, "missing", "down")).toBeNull()
})
