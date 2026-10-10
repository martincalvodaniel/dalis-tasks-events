import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { syncCommandSchema } from "@/schemas/sync"
import type { SyncCommand } from "@/types/sync"

type SyncStore = "items" | "tags" | "itemViews" | "taskPlacements" | "settings"
type UnsupportedReason =
  | "placement_executor_unavailable"
  | "settings_executor_unavailable"
  | "occurrence_executor_unavailable"
  | "recurrence_unavailable"
  | "birthday_unavailable"
  | "plan_executor_unavailable"
interface CommandCapability {
  store: SyncStore
  supported: boolean
  reason: UnsupportedReason | null
}

// This registry describes prepared executors, not active transport or access rights.
export const syncCapabilityRegistry = {
  stores: ["items", "tags", "itemViews"] as const,
  commands: {
    "plan.set-status": {
      store: "items",
      supported: false,
      reason: "plan_executor_unavailable",
    },
    "plan.set-checklist-entry": {
      store: "items",
      supported: false,
      reason: "plan_executor_unavailable",
    },
    "item.create": { store: "items", supported: true, reason: null },
    "item.update": { store: "items", supported: true, reason: null },
    "item.delete": { store: "items", supported: true, reason: null },
    "task.set-status": { store: "items", supported: true, reason: null },
    "task.set-checklist-entry": {
      store: "items",
      supported: true,
      reason: null,
    },
    "tag.save": { store: "tags", supported: true, reason: null },
    "tag.delete": { store: "tags", supported: true, reason: null },
    "tag.move": { store: "tags", supported: true, reason: null },
    "item-view.set": { store: "itemViews", supported: true, reason: null },
    "task.move": {
      store: "taskPlacements",
      supported: false,
      reason: "placement_executor_unavailable",
    },
    "settings.update": {
      store: "settings",
      supported: false,
      reason: "settings_executor_unavailable",
    },
    "task.update-occurrence": {
      store: "items",
      supported: false,
      reason: "occurrence_executor_unavailable",
    },
    "task.cancel-occurrence": {
      store: "items",
      supported: false,
      reason: "occurrence_executor_unavailable",
    },
  } satisfies Record<SyncCommand["type"], CommandCapability>,
}
for (const descriptor of Object.values(syncCapabilityRegistry.commands))
  Object.freeze(descriptor)
Object.freeze(syncCapabilityRegistry.commands)
Object.freeze(syncCapabilityRegistry.stores)
Object.freeze(syncCapabilityRegistry)

// Prepared generation-three policy only; existing callers retain the generation-two registry.
export const placementSyncCapabilityRegistry = Object.freeze({
  stores: Object.freeze([
    ...syncCapabilityRegistry.stores,
    "taskPlacements",
  ] as const),
  commands: Object.freeze({
    ...syncCapabilityRegistry.commands,
    "task.move": Object.freeze({
      store: "taskPlacements" as const,
      supported: true,
      reason: null,
    }),
  }),
})

export interface SyncCommandCapability extends CommandCapability {
  kind: "item" | "preference"
  contextKnown: boolean
  requiresRemoteValidation: true
}

function readCommandCapability(
  commandInput: unknown,
  currentItemInput: unknown,
  registry: { commands: Record<SyncCommand["type"], CommandCapability> },
  allowPlans = false
): SyncCommandCapability {
  const command = syncCommandSchema.parse(commandInput)
  const current = calendarItemSchema.nullable().parse(currentItemInput)
  if (current && (!("itemId" in command) || command.itemId !== current.id))
    throw new Error("Sync capability context does not match its item identity")
  const descriptor = registry.commands[command.type]
  let reason: UnsupportedReason | null = descriptor.reason
  if (descriptor.supported) {
    if (
      (command.type === "task.set-status" ||
        command.type === "task.set-checklist-entry" ||
        command.type === "task.move") &&
      command.occurrenceId !== null
    )
      reason = "occurrence_executor_unavailable"
    else if (current?.kind === "plan" && !allowPlans)
      reason = "plan_executor_unavailable"
    else if (current?.kind === "birthday") reason = "birthday_unavailable"
    else if (current?.recurrence) reason = "recurrence_unavailable"
    else if (command.type === "task.move" && current?.kind !== "task")
      reason = "placement_executor_unavailable"
    else if (command.type === "item.create" || command.type === "item.update") {
      if (command.input.kind === "plan" && !allowPlans)
        reason = "plan_executor_unavailable"
      else if (command.input.kind === "birthday")
        reason = "birthday_unavailable"
      else if (command.input.recurrence) reason = "recurrence_unavailable"
    }
  }
  // Missing local context cannot establish ownership, simple content, or server acceptance.
  return {
    kind: remoteOperationKind(command),
    store: descriptor.store,
    supported: descriptor.supported && reason === null,
    reason,
    contextKnown: current !== null,
    requiresRemoteValidation: true,
  }
}

export function readSyncCommandCapability(
  commandInput: unknown,
  currentItemInput: unknown = null
): SyncCommandCapability {
  return readCommandCapability(
    commandInput,
    currentItemInput,
    syncCapabilityRegistry
  )
}

export function readPlacementSyncCommandCapability(
  commandInput: unknown,
  currentItemInput: unknown = null
): SyncCommandCapability {
  return readCommandCapability(
    commandInput,
    currentItemInput,
    placementSyncCapabilityRegistry
  )
}

export interface SyncCapabilityPolicy {
  readonly readCommand: typeof readSyncCommandCapability
  readonly supportsPlans?: boolean
  readonly stores: readonly SyncStore[]
}
export const syncCapabilityPolicy: SyncCapabilityPolicy = Object.freeze({
  readCommand: readSyncCommandCapability,
  stores: syncCapabilityRegistry.stores,
})
export const placementSyncCapabilityPolicy: SyncCapabilityPolicy =
  Object.freeze({
    readCommand: readPlacementSyncCommandCapability,
    stores: placementSyncCapabilityRegistry.stores,
  })

// Generation four has common content support; recurring parents and plan ordering remain separately gated.
export const planSyncCapabilityRegistry = Object.freeze({
  stores: placementSyncCapabilityRegistry.stores,
  commands: Object.freeze({
    ...placementSyncCapabilityRegistry.commands,
    "plan.set-status": Object.freeze({
      store: "items" as const,
      supported: true,
      reason: null,
    }),
    "plan.set-checklist-entry": Object.freeze({
      store: "items" as const,
      supported: true,
      reason: null,
    }),
  }),
})
export function readPlanSyncCommandCapability(
  commandInput: unknown,
  currentItemInput: unknown = null
): SyncCommandCapability {
  return readCommandCapability(
    commandInput,
    currentItemInput,
    planSyncCapabilityRegistry,
    true
  )
}
export const planSyncCapabilityPolicy: SyncCapabilityPolicy = Object.freeze({
  readCommand: readPlanSyncCommandCapability,
  stores: planSyncCapabilityRegistry.stores,
  supportsPlans: true,
})
