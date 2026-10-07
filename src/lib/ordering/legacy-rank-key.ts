import type { RankedRecord } from "@/lib/ordering/rank"
import { positionSchema } from "@/schemas/primitives"

// Candidate adapter only: compare keys with < and >, never localeCompare.
export function legacyRankOrderKey({ id, position }: RankedRecord): string {
  const value = positionSchema.parse(position)
  const bytes = new DataView(new ArrayBuffer(8))
  // Numeric ranks treat both signed zeros as equal before comparing identities.
  bytes.setFloat64(0, value === 0 ? 0 : value, false)
  let high = bytes.getUint32(0, false)
  let low = bytes.getUint32(4, false)
  if (value < 0) {
    high = ~high >>> 0
    low = ~low >>> 0
  } else {
    high = (high ^ 0x80000000) >>> 0
  }
  return `${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}:${id}`
}
