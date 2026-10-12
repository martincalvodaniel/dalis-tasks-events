import {
  readRecurringSyncCommandCapability,
  recurringSyncCapabilityPolicy,
  recurringSyncCapabilityRegistry,
} from "@/lib/sync/recurring-sync-capabilities"
import type {
  SyncCapabilityPolicy,
  SyncCommandCapability,
} from "@/lib/sync/sync-capabilities"
import { syncCommandSchema } from "@/schemas/sync"

export const settingsSyncCapabilityRegistry = Object.freeze({
  stores: Object.freeze([
    ...recurringSyncCapabilityRegistry.stores,
    "settings",
  ] as const),
  commands: Object.freeze({
    ...recurringSyncCapabilityRegistry.commands,
    "settings.update": Object.freeze({
      store: "settings" as const,
      supported: true,
      reason: null,
    }),
  }),
})

export function readSettingsSyncCommandCapability(
  commandInput: unknown,
  currentInput: unknown = null
): SyncCommandCapability {
  const command = syncCommandSchema.parse(commandInput)
  const capability = readRecurringSyncCommandCapability(command, currentInput)
  return command.type === "settings.update"
    ? { ...capability, supported: true, reason: null }
    : capability
}

// Only a future negotiated bundle may select the matching executor, ACK and pull ports.
export const settingsSyncCapabilityPolicy: SyncCapabilityPolicy = Object.freeze(
  {
    ...recurringSyncCapabilityPolicy,
    readCommand: readSettingsSyncCommandCapability,
    stores: settingsSyncCapabilityRegistry.stores,
  }
)
