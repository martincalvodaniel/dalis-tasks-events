import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { RemoteOperationResult } from "@/types/remote-sync"

export interface SyncIncident {
  entry: OutboxEntry
  reason: Exclude<RemoteOperationResult["status"], "applied" | "unsupported">
  local: CalendarItem | null
  localAtOutcome: CalendarItem | null
  shadowAtOutcome: CalendarItem | null
  remote: CalendarItem | null
}

export interface SyncIncidentSnapshot extends SyncIncident {
  intentions: OutboxEntry[]
  blockedByRelatedIntentions: boolean
}

export interface PersonalSyncIncidentSnapshot {
  entry: OutboxEntry
  reason: SyncIncident["reason"]
  outcome: LocalPreferenceOutcomeV2
  local: PersonalSnapshot
  localAtOutcome: PersonalSnapshot
  shadowAtOutcome: PersonalSnapshot
  remote: PersonalSnapshot
  intentions: OutboxEntry[]
  tagNames: Record<string, string>
}

export type SyncIncidentOverview =
  | { kind: "item"; incident: SyncIncidentSnapshot }
  | { kind: "preference"; incident: PersonalSyncIncidentSnapshot }
