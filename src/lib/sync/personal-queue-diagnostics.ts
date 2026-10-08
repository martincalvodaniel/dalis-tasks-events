import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { readSyncCommandCapability } from "@/lib/sync/sync-capabilities"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import type {
  PersonalQueueDiagnostics,
  QueueOperationDiagnostic,
} from "@/types/personal-queue-diagnostics"

// This readonly diagnostic preserves locally recorded states; it cannot establish a receipt or ACK.
export function diagnosePersonalQueue(
  input: unknown
): PersonalQueueDiagnostics {
  const value = personalQueueDiagnosticsInputSchema.parse(input)
  const items = new Map(value.items.map((item) => [item.id, item]))
  const operations: QueueOperationDiagnostic[] = []
  const byId = new Map<string, QueueOperationDiagnostic>()
  for (const entry of value.entries.toSorted(
    (a, b) => a.sequence - b.sequence
  )) {
    const command = entry.operation.command
    const capability = readSyncCommandCapability(
      command,
      "itemId" in command ? (items.get(command.itemId) ?? null) : null
    )
    const blocking = new Set<string>()
    const waiting = new Set<string>()
    if (entry.state !== "acknowledged")
      for (const id of entry.dependencies) {
        const parent = byId.get(id)
        if (!parent)
          throw new Error("Queue diagnostics lost a validated dependency")
        if (parent.entry.state === "acknowledged") continue
        if (
          parent.category === "blocked" ||
          parent.category === "unsupported"
        ) {
          blocking.add(id)
        } else waiting.add(id)
      }
    let category: QueueOperationDiagnostic["category"]
    if (entry.state === "acknowledged") category = "settled"
    else if (
      entry.state === "conflict" ||
      entry.state === "rejected" ||
      entry.state === "superseded"
    )
      category = "blocked"
    else if (!capability.supported) category = "unsupported"
    else if (blocking.size) category = "blocked"
    else if (entry.state === "sending" || waiting.size) category = "waiting"
    else category = "ready"
    // Direct blockers retain the complete graph without duplicating every ancestor for each descendant.
    const diagnostic: QueueOperationDiagnostic = {
      entry,
      capability,
      category,
      blockingOperationIds: [...blocking],
      waitingOperationIds: [...waiting],
    }
    operations.push(diagnostic)
    byId.set(entry.operation.operationId, diagnostic)
  }
  const personalProjectionBlockers = operations
    .filter(
      (operation) =>
        operation.capability.kind === "preference" &&
        isUnresolvedOutboxEntry(operation.entry)
    )
    .map((operation) => operation.entry)
  return {
    userId: value.userId,
    operations,
    ready: operations.filter((operation) => operation.category === "ready"),
    waiting: operations.filter((operation) => operation.category === "waiting"),
    blocked: operations.filter((operation) => operation.category === "blocked"),
    unsupported: operations.filter(
      (operation) => operation.category === "unsupported"
    ),
    settled: operations.filter((operation) => operation.category === "settled"),
    personalProjectionBlockers,
    personalProjectionBlocked: personalProjectionBlockers.length !== 0,
  }
}
