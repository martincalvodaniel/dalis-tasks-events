import { expect, test } from "bun:test"
import { groupDropNeighbors } from "@/lib/ordering/group-drop"

test("cross-group drops accept first, middle, last and empty destinations even without an order change", () => {
  const target = { id: "b", label: "B", peers: ["first", "last", "moved"] }
  expect(groupDropNeighbors(target, "a", "moved", "first", "before")).toEqual({
    beforeId: "first",
    afterId: null,
  })
  expect(groupDropNeighbors(target, "a", "moved", "first", "after")).toEqual({
    beforeId: "last",
    afterId: "first",
  })
  expect(groupDropNeighbors(target, "a", "moved", "last", "after")).toEqual({
    beforeId: null,
    afterId: "last",
  })
  expect(groupDropNeighbors(target, "a", "moved", null, "after")).toEqual({
    beforeId: null,
    afterId: "last",
  })
  expect(
    groupDropNeighbors(
      { ...target, peers: ["moved"] },
      "a",
      "moved",
      null,
      "after"
    )
  ).toEqual({ beforeId: null, afterId: null })
})
test("group drops reject stale targets and duplicates and retain same-group no-op guards", () => {
  const target = { id: "b", label: "B", peers: ["first", "moved"] }
  expect(
    groupDropNeighbors(target, "a", "moved", "foreign", "before")
  ).toBeNull()
  expect(groupDropNeighbors(target, "a", "moved", "moved", "before")).toBeNull()
  expect(
    groupDropNeighbors(
      { ...target, peers: ["first", "first"] },
      "a",
      "moved",
      null,
      "after"
    )
  ).toBeNull()
  expect(groupDropNeighbors(target, "b", "moved", null, "after")).toBeNull()
  expect(groupDropNeighbors(target, "b", "moved", "first", "before")).toEqual({
    beforeId: "first",
    afterId: null,
  })
})
