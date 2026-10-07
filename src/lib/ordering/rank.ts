import { positionSchema } from "@/schemas/primitives"

export interface RankedRecord {
  id: string
  position: number
}
export interface RankNeighbors {
  beforeId: string | null
  afterId: string | null
}

const positionStep = 1024

export function compareRank(left: RankedRecord, right: RankedRecord): number {
  return (
    left.position - right.position ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  )
}

export function planRankMove(
  records: readonly RankedRecord[],
  movedId: string,
  { beforeId, afterId }: RankNeighbors
): Map<string, number> {
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw new Error("Ranked records have duplicate identities")
  for (const record of records) positionSchema.parse(record.position)
  if (!records.some((record) => record.id === movedId))
    throw new Error("Moved record is unavailable")
  if (
    beforeId === movedId ||
    afterId === movedId ||
    (beforeId !== null && beforeId === afterId)
  )
    throw new Error("Movement neighbors must have distinct identities")
  const remaining = records
    .filter((record) => record.id !== movedId)
    .toSorted(compareRank)
  const beforeIndex =
    beforeId === null
      ? remaining.length
      : remaining.findIndex((record) => record.id === beforeId)
  const afterIndex =
    afterId === null
      ? -1
      : remaining.findIndex((record) => record.id === afterId)
  if (
    beforeIndex < 0 ||
    (afterId !== null && afterIndex < 0) ||
    afterIndex + 1 !== beforeIndex
  )
    throw new Error("Movement neighbors changed or are not adjacent")
  const before = remaining[beforeIndex]
  const after = remaining[afterIndex]
  const candidate =
    before && after
      ? after.position + (before.position - after.position) / 2
      : before
        ? before.position - positionStep
        : after
          ? after.position + positionStep
          : 0
  if (
    positionSchema.safeParse(candidate).success &&
    (!after || candidate > after.position) &&
    (!before || candidate < before.position)
  )
    return new Map([[movedId, candidate]])

  // Compact only this list; no representable position remains between its neighbors.
  const orderedIds = remaining.map((record) => record.id)
  orderedIds.splice(beforeIndex, 0, movedId)
  const current = new Map(records.map((record) => [record.id, record.position]))
  const changes = new Map<string, number>()
  for (const [index, id] of orderedIds.entries()) {
    const position = positionSchema.parse(
      (index - Math.floor(orderedIds.length / 2)) * positionStep
    )
    if (id === movedId || position !== current.get(id))
      changes.set(id, position)
  }
  return changes
}
