import { applyUserSettingsCommand } from "@/lib/preferences/user-settings-command"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { revisionSchema } from "@/schemas/primitives"
import { remoteUserSettingsPlanningInputSchema } from "@/schemas/remote-user-settings-planning"
import type { RemoteUserSettingsPlan } from "@/types/remote-user-settings-planning"

// This planner has no connection, executor or active caller. The authenticated server supplies actor and time.
export function planRemoteUserSettingsOperation(
  input: unknown
): RemoteUserSettingsPlan {
  const { userId, timestamp, operation, current } =
    remoteUserSettingsPlanningInputSchema.parse(input)
  if (operation.command.type !== "settings.update")
    return { status: "unsupported" }
  if ((current?.revision ?? 0) !== operation.baseRevision || current?.deletedAt)
    return { status: "conflict", current }
  const nextRevision = revisionSchema
    .min(1)
    .safeParse((current?.revision ?? 0) + 1)
  if (!nextRevision.success) return { status: "invalid_command" }
  const record = applyUserSettingsCommand(
    current,
    operation.command.input,
    userId,
    timestamp
  )
  const bounded = remotePreferenceEffectsSchema.safeParse({
    version: 1,
    userId,
    operationId: operation.operationId,
    sequence: Number.MAX_SAFE_INTEGER,
    effects: [
      { store: "settings", record: { ...record, revision: nextRevision.data } },
    ],
  })
  if (!bounded.success) return { status: "invalid_command" }
  return { status: "changes", effects: bounded.data.effects }
}
