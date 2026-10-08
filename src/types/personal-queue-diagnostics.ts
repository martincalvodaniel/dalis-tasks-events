import type { SyncCommandCapability } from "@/lib/sync/sync-capabilities"
import type { OutboxEntry } from "@/types/local-sync"

export type QueueDiagnosticCategory =
  | "ready"
  | "waiting"
  | "blocked"
  | "unsupported"
  | "settled"
export interface QueueOperationDiagnostic {
  entry: OutboxEntry
  capability: SyncCommandCapability
  category: QueueDiagnosticCategory
  blockingOperationIds: string[]
  waitingOperationIds: string[]
}
export interface PersonalQueueDiagnostics {
  userId: string
  operations: QueueOperationDiagnostic[]
  ready: QueueOperationDiagnostic[]
  waiting: QueueOperationDiagnostic[]
  blocked: QueueOperationDiagnostic[]
  unsupported: QueueOperationDiagnostic[]
  settled: QueueOperationDiagnostic[]
  personalProjectionBlockers: OutboxEntry[]
  personalProjectionBlocked: boolean
}
