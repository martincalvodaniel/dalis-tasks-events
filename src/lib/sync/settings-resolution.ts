import { applyUserSettingsCommand } from "@/lib/preferences/user-settings-command"
import { validateLocalPreferenceOutcomeV2 } from "@/lib/sync/local-operation-outcome-v2"
import {
  settingsIncidentSnapshotSchema,
  settingsResolutionRecordSchema,
  settingsResolutionRequestSchema,
} from "@/schemas/settings-resolution"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { UserSettings } from "@/types/preferences"
import type {
  SettingsResolutionRecord,
  SettingsResolutionRequest,
} from "@/types/settings-resolution"

function validateComparison(input: unknown, actor: string) {
  const value = settingsIncidentSnapshotSchema.parse(input),
    key = userSettingsEntityKey(actor)
  if (
    value.entry.userId !== actor ||
    value.entry.entityKey !== key ||
    value.entry.operation.command.type !== "settings.update" ||
    value.reason !== "conflict" ||
    value.entry.state !== "conflict" ||
    value.blockedByRelatedIntentions
  )
    throw new Error(
      "Settings resolution requires its own complete conflict chain"
    )
  const outcome = validateLocalPreferenceOutcomeV2(value.outcome, actor)
  if (
    outcome.result.outcome.status !== "conflict" ||
    JSON.stringify(outcome.operation) !==
      JSON.stringify(value.entry.operation) ||
    JSON.stringify(outcome.local) !== JSON.stringify(value.localAtOutcome) ||
    JSON.stringify(outcome.base) !== JSON.stringify(value.shadowAtOutcome)
  )
    throw new Error("Settings comparison does not match its frozen outcome")
  function record(snapshot: typeof value.local): UserSettings | null {
    if (snapshot.length !== 1 || snapshot[0].entityKey !== key)
      throw new Error("Settings comparison requires one exact entity")
    const effect = snapshot[0].record
    if (
      effect &&
      (effect.store !== "settings" || effect.record.userId !== actor)
    )
      throw new Error(
        "Settings comparison is foreign or uses another preference"
      )
    return effect?.store === "settings" ? effect.record : null
  }
  const local = record(value.local),
    remote = record(value.remote)
  record(value.localAtOutcome)
  record(value.shadowAtOutcome)
  if (!remote || remote.deletedAt || remote.revision < 1)
    throw new Error(
      "Settings resolution requires a living committed remote version"
    )
  for (const snapshot of [
    outcome.base,
    [{ entityKey: key, record: outcome.result.outcome.current }],
  ]) {
    const observed = record(snapshot)
    // Only observed remote evidence bounds freshness; local optimistic revisions are not ancestors.
    if (
      observed &&
      (observed.revision > remote.revision ||
        (observed.revision === remote.revision &&
          JSON.stringify(observed) !== JSON.stringify(remote)))
    )
      throw new Error(
        "Settings remote comparison regressed or contradicts observed evidence"
      )
  }
  if (value.intentions.some((entry) => entry.userId !== actor))
    throw new Error("Settings comparison contains foreign intentions")
  const intentions = value.intentions.filter(
      (entry) => entry.entityKey === key
    ),
    ids = new Set<string>(),
    sequences = new Set<number>()
  for (const entry of intentions) {
    if (
      entry.operation.command.type !== "settings.update" ||
      entry.lease !== null ||
      ["acknowledged", "sending", "superseded"].includes(entry.state) ||
      (entry.state === "pending" && entry.attempts > 0) ||
      ids.has(entry.operation.operationId) ||
      sequences.has(entry.sequence)
    )
      throw new Error("Settings chain has unsupported or uncertain intentions")
    ids.add(entry.operation.operationId)
    sequences.add(entry.sequence)
  }
  if (
    !intentions.some(
      (entry) => JSON.stringify(entry) === JSON.stringify(value.entry)
    )
  )
    throw new Error("Settings chain is missing its incident")
  return { value, local, remote, intentions, ids }
}
export function availableSettingsResolutionChoices(
  input: unknown
): SettingsResolutionRequest["choice"][] {
  try {
    const parsed = settingsIncidentSnapshotSchema.parse(input),
      { local } = validateComparison(parsed, parsed.entry.userId)
    return local && !local.deletedAt
      ? ["adopt_remote", "retry_local"]
      : ["adopt_remote"]
  } catch {
    return []
  }
}
export function planSettingsIncidentResolution(
  input: unknown,
  currentInput: unknown
): SettingsResolutionRecord {
  const request = settingsResolutionRequestSchema.parse(input),
    current = settingsIncidentSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Settings comparison changed after it was opened")
  const { local, remote, intentions, ids } = validateComparison(
    current,
    request.userId
  )
  if (
    request.resolutionId === request.operationId ||
    ids.has(request.resolutionId) ||
    (request.operationId && ids.has(request.operationId))
  )
    throw new Error("Settings decision identities must be new and distinct")
  if (request.choice === "retry_local" && (!local || local.deletedAt))
    throw new Error("Settings retry requires a living local value")
  const replacement =
    request.choice === "retry_local" && local
      ? {
          operationId: request.operationId,
          protocolVersion: 1,
          baseRevision: remote.revision,
          command: {
            type: "settings.update",
            input: {
              timeZone: local.timeZone,
              weekStartsOn: local.weekStartsOn,
              locale: local.locale,
            },
          },
        }
      : null
  return settingsResolutionRecordSchema.parse({
    ...request,
    key: `settings-resolution:${request.resolutionId}`,
    replacement,
    local: replacement
      ? applyUserSettingsCommand(
          remote,
          replacement.command.input,
          request.userId,
          request.createdAt
        )
      : remote,
    supersededOperationIds: intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}

export function validateSettingsResolutionRecord(
  input: unknown,
  actor: string
): SettingsResolutionRecord {
  const record = settingsResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Settings decision belongs to another account")
  const request = {
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    choice: record.choice,
    createdAt: record.createdAt,
    expected: record.expected,
  }
  const planned = planSettingsIncidentResolution(request, record.expected)
  if (JSON.stringify(record) !== JSON.stringify(planned))
    throw new Error(
      "Stored settings decision contradicts its reviewed evidence"
    )
  return record
}
