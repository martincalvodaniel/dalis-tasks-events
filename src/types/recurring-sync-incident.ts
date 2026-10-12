import type { OutboxEntry } from "@/types/local-sync"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { LocalPlanOccurrenceOutcome } from "@/types/remote-recurring-sync"
import type { SyncIncidentOverview } from "@/types/sync-incident"

export interface PlanOccurrenceSyncIncidentSnapshot {
  entry: OutboxEntry
  reason: "conflict" | "unavailable" | "invalid_command" | "identity_reuse"
  outcome: LocalPlanOccurrenceOutcome
  series: Plan
  seriesAtOutcome: Plan | null
  local: PlanOccurrence | null
  localAtOutcome: PlanOccurrence | null
  shadowAtOutcome: PlanOccurrence | null
  remote: PlanOccurrence | null
  intentions: OutboxEntry[]
  blockedByRelatedIntentions: boolean
}

export type RecurringSyncIncidentOverview =
  | SyncIncidentOverview
  | { kind: "plan-occurrence"; incident: PlanOccurrenceSyncIncidentSnapshot }
