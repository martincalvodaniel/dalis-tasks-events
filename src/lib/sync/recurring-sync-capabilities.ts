import { remoteRecurringOperationKind } from "@/lib/sync/remote-recurring-push"
import {
  planSyncCapabilityRegistry,
  type SyncCapabilityPolicy,
  type SyncCommandCapability,
} from "@/lib/sync/sync-capabilities"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { remotePlanOccurrenceKeySchema } from "@/schemas/remote-plan-occurrence-storage"
import { syncCommandSchema } from "@/schemas/sync"

const appearance = Object.freeze({
  store: "occurrences" as const,
  supported: true,
  reason: null,
})
export const recurringSyncCapabilityRegistry = Object.freeze({
  stores: Object.freeze([
    ...planSyncCapabilityRegistry.stores,
    "occurrences",
  ] as const),
  commands: Object.freeze({
    ...planSyncCapabilityRegistry.commands,
    "plan.set-occurrence-status": appearance,
    "plan.set-occurrence-checklist-entry": appearance,
    "plan.update-occurrence": appearance,
    "plan.cancel-occurrence": appearance,
  }),
})

// Local context selects a prepared executor; it cannot establish authorization or a remote commit.
export function readRecurringSyncCommandCapability(
  commandInput: unknown,
  currentInput: unknown = null
): SyncCommandCapability {
  const command = syncCommandSchema.parse(commandInput)
  const current = calendarItemSchema.nullable().parse(currentInput)
  if (current && (!("itemId" in command) || command.itemId !== current.id))
    throw new Error(
      "Recurring capability context does not match its item identity"
    )
  const descriptor = recurringSyncCapabilityRegistry.commands[command.type]
  let reason: SyncCommandCapability["reason"] = descriptor.reason
  const kind = remoteRecurringOperationKind(command)
  if (descriptor.supported) {
    if (current?.kind === "birthday") reason = "birthday_unavailable"
    else if (current?.recurrence && current.kind !== "plan")
      reason = "recurrence_unavailable"
    else if (kind === "plan-occurrence") {
      if (
        !("occurrenceId" in command) ||
        !("itemId" in command) ||
        current?.kind !== "plan" ||
        !remotePlanOccurrenceKeySchema.safeParse({
          seriesId: command.itemId,
          id: command.occurrenceId,
        }).success
      )
        reason = "occurrence_executor_unavailable"
      else if (
        !("expectedOccurrenceRevision" in command) ||
        command.expectedOccurrenceRevision === undefined
      )
        reason = "occurrence_revision_missing"
    } else if (command.type === "task.move") {
      if (current?.kind !== "task" && current?.kind !== "plan")
        reason = "placement_executor_unavailable"
      else if (
        command.occurrenceId !== null &&
        (current.kind !== "plan" ||
          !remotePlanOccurrenceKeySchema.safeParse({
            seriesId: command.itemId,
            id: command.occurrenceId,
          }).success)
      )
        reason = "occurrence_executor_unavailable"
      else if (
        current.kind === "plan" &&
        current.recurrence &&
        command.occurrenceId === null
      )
        reason = "occurrence_executor_unavailable"
    } else if (
      command.type === "task.set-status" ||
      command.type === "task.set-checklist-entry"
    ) {
      if (command.occurrenceId !== null)
        reason = "occurrence_executor_unavailable"
      else if (current?.kind === "plan")
        reason = current.recurrence
          ? "recurrence_unavailable"
          : "plan_executor_unavailable"
    } else if (
      command.type === "plan.set-status" ||
      command.type === "plan.set-checklist-entry"
    ) {
      if (current?.kind !== "plan") reason = "plan_executor_unavailable"
      else if (current.recurrence) reason = "recurrence_unavailable"
    } else if (
      command.type === "item.create" ||
      command.type === "item.update"
    ) {
      if (command.input.kind === "birthday") reason = "birthday_unavailable"
      else if (command.input.recurrence && command.input.kind !== "plan")
        reason = "recurrence_unavailable"
    }
  }
  return {
    kind,
    store: descriptor.store,
    supported: descriptor.supported && reason === null,
    reason,
    contextKnown: current !== null,
    requiresRemoteValidation: true,
  }
}

// Future callers must select this bundle together with recurrent ACK, pull and negotiated transport.
export const recurringSyncCapabilityPolicy: SyncCapabilityPolicy =
  Object.freeze({
    readCommand: readRecurringSyncCommandCapability,
    stores: recurringSyncCapabilityRegistry.stores,
    supportsPlans: true,
    supportsRecurrence: true,
  })
