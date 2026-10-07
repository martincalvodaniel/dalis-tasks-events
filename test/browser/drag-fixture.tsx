import { useState } from "react"
import { DragOrderHandle } from "@/components/ui/drag-order-handle"
import type { RankNeighbors } from "@/lib/ordering/rank"

export function DragFixture({
  onDrop,
  blockedId,
}: {
  onDrop: (neighbors: RankNeighbors) => void
  blockedId?: string
}) {
  const [ids, setIds] = useState(["a", "b", "c"])
  return (
    <ul data-order-list style={{ margin: 20 }}>
      {ids.map((id) => (
        <li
          key={id}
          data-order-item={id}
          data-order-label={id}
          style={{ padding: 20, border: "1px solid", minHeight: 280 }}
        >
          <span>{id}</span>
          <DragOrderHandle
            itemId={id}
            label={id}
            peers={ids.filter((peer) => peer !== blockedId)}
            busy={false}
            onDrop={(neighbors) => {
              onDrop(neighbors)
              const remaining = ids.filter((peer) => peer !== id)
              const index = neighbors.beforeId
                ? remaining.indexOf(neighbors.beforeId)
                : remaining.length
              remaining.splice(index, 0, id)
              setIds(remaining)
            }}
          />
        </li>
      ))}
    </ul>
  )
}
