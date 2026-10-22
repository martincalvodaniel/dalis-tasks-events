import { dropMoveNeighbors } from "@/lib/ordering/move-neighbors"
import type { RankNeighbors } from "@/lib/ordering/rank"

export interface OrderDropGroup {
  id: string
  label: string
  peers: readonly string[]
}

export function groupDropNeighbors(
  group: OrderDropGroup,
  sourceGroupId: string,
  movedId: string,
  targetId: string | null,
  side: "before" | "after"
): RankNeighbors | null {
  if (new Set(group.peers).size !== group.peers.length) return null
  if (targetId === movedId) return null
  const remaining = group.peers.filter((id) => id !== movedId)
  if (targetId !== null && !remaining.includes(targetId)) return null
  if (group.id === sourceGroupId) {
    const target = targetId ?? remaining.at(-1)
    return target
      ? dropMoveNeighbors(
          group.peers,
          movedId,
          target,
          targetId === null ? "after" : side
        )
      : null
  }
  const index =
    targetId === null
      ? remaining.length
      : remaining.indexOf(targetId) + (side === "after" ? 1 : 0)
  return {
    beforeId: remaining[index] ?? null,
    afterId: remaining[index - 1] ?? null,
  }
}
