import type { CalendarItem } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"
import type { RemoteOperationResult } from "@/types/remote-sync"

export interface SyncIncident {
  entry: OutboxEntry
  reason: Exclude<RemoteOperationResult["status"], "applied" | "unsupported">
  local: CalendarItem | null
  localAtOutcome: CalendarItem | null
  shadowAtOutcome: CalendarItem | null
  remote: CalendarItem | null
}
