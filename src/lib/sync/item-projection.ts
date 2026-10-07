import { itemProjectionInputSchema } from "@/schemas/item-projection"
import type { CalendarItem } from "@/types/calendar-item"

export interface ItemProjection {
  local: CalendarItem | null
  shadow: CalendarItem
  pending: boolean
}

// The local record already contains accumulated intentions; pull never rewrites them.
export function planRemoteItemProjection(input: unknown): ItemProjection {
  const value = itemProjectionInputSchema.parse(input)
  const pending = value.entries.some((entry) => entry.state !== "acknowledged")
  const previous = value.shadow
  let shadow = value.incoming
  if (previous && previous.revision > shadow.revision) shadow = previous
  else if (
    previous &&
    previous.revision === shadow.revision &&
    JSON.stringify(previous) !== JSON.stringify(shadow)
  )
    throw new Error("Remote records disagree at the same revision")
  return { local: pending ? value.local : shadow, shadow, pending }
}
