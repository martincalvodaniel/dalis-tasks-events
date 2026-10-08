import { syncProtocolVersion } from "@/config/sync-protocol"
import {
  syncProtocolRangeSchema,
  syncProtocolVersionSchema,
} from "@/schemas/sync-protocol"

export function encodeSyncProtocolRange(
  versionInput: unknown = syncProtocolVersion
): string {
  const version = syncProtocolVersionSchema.parse(versionInput)
  return JSON.stringify(
    syncProtocolRangeSchema.parse({
      minimum: version,
      maximum: version,
    })
  )
}

export function acceptsSyncProtocolRange(
  header: string | null,
  versionInput: unknown = syncProtocolVersion
): boolean {
  const version = syncProtocolVersionSchema.safeParse(versionInput)
  if (!version.success) return false
  if (!header || header.length > 128) return false
  try {
    const range = syncProtocolRangeSchema.parse(JSON.parse(header))
    return range.minimum <= version.data && version.data <= range.maximum
  } catch {
    return false
  }
}
