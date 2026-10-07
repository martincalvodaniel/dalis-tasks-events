import type { RankNeighbors } from "@/lib/ordering/rank"

export function adjacentMoveNeighbors(
  ids: readonly string[],
  movedId: string,
  direction: "up" | "down"
): RankNeighbors | null {
  const index = ids.indexOf(movedId)
  const destination = index + (direction === "up" ? -1 : 1)
  if (index < 0 || destination < 0 || destination >= ids.length) return null
  const remaining = ids.filter((id) => id !== movedId)
  return {
    beforeId: remaining[destination] ?? null,
    afterId: remaining[destination - 1] ?? null,
  }
}

export function visibleMoveNeighbors(
  ids: readonly string[],
  visibleIds: readonly string[],
  movedId: string,
  direction: "up" | "down"
): RankNeighbors | null {
  const index = visibleIds.indexOf(movedId)
  if (index < 0 || !ids.includes(movedId)) return null
  const neighbor = visibleIds[index + (direction === "up" ? -1 : 1)]
  if (!neighbor) return null
  const remaining = ids.filter((id) => id !== movedId)
  const neighborIndex = remaining.indexOf(neighbor)
  if (neighborIndex < 0) return null
  const destination = neighborIndex + (direction === "down" ? 1 : 0)
  return {
    beforeId: remaining[destination] ?? null,
    afterId: remaining[destination - 1] ?? null,
  }
}
