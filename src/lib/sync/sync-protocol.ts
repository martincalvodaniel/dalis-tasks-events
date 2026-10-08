import { syncProtocolVersion } from "@/config/sync-protocol"
import { syncProtocolRangeSchema } from "@/schemas/sync-protocol"

export function encodeSyncProtocolRange(): string {
  return JSON.stringify(
    syncProtocolRangeSchema.parse({
      minimum: syncProtocolVersion,
      maximum: syncProtocolVersion,
    })
  )
}

export function acceptsSyncProtocolRange(header: string | null): boolean {
  if (!header || header.length > 128) return false
  try {
    const range = syncProtocolRangeSchema.parse(JSON.parse(header))
    return (
      range.minimum <= syncProtocolVersion &&
      syncProtocolVersion <= range.maximum
    )
  } catch {
    return false
  }
}
