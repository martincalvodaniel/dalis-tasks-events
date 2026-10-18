import { applyTagCommand } from "@/lib/preferences/preference-command"
import { validateLocalPreferenceOutcomeV2 } from "@/lib/sync/local-operation-outcome-v2"
import {
  tagIncidentSnapshotSchema,
  tagResolutionRecordSchema,
  tagResolutionRequestSchema,
} from "@/schemas/tag-resolution"
import type { Tag } from "@/types/preferences"
import type {
  TagResolutionRecord,
  TagResolutionRequest,
} from "@/types/tag-resolution"

function validateComparison(input: unknown, actor: string) {
  const value = tagIncidentSnapshotSchema.parse(input),
    key = (() => {
      const command = value.entry.operation.command
      if (command.type !== "tag.save")
        throw new Error("Category resolution requires a save conflict")
      return `tag:${command.tagId}`
    })()
  if (
    value.entry.userId !== actor ||
    value.entry.entityKey !== key ||
    value.entry.operation.command.type !== "tag.save" ||
    value.reason !== "conflict" ||
    value.entry.state !== "conflict" ||
    value.blockedByRelatedIntentions
  )
    throw new Error(
      "Category resolution requires its own complete conflict chain"
    )
  const outcome = validateLocalPreferenceOutcomeV2(value.outcome, actor)
  if (
    outcome.result.outcome.status !== "conflict" ||
    JSON.stringify(outcome.operation) !==
      JSON.stringify(value.entry.operation) ||
    JSON.stringify(outcome.local) !== JSON.stringify(value.localAtOutcome) ||
    JSON.stringify(outcome.base) !== JSON.stringify(value.shadowAtOutcome)
  )
    throw new Error("Category comparison does not match its frozen outcome")
  function record(snapshot: typeof value.local): Tag | null {
    if (snapshot.length !== 1 || snapshot[0].entityKey !== key)
      throw new Error("Category comparison requires one exact entity")
    const effect = snapshot[0].record
    if (
      effect &&
      (effect.store !== "tags" ||
        effect.record.userId !== actor ||
        `tag:${effect.record.id}` !== key)
    )
      throw new Error(
        "Category comparison is foreign or uses another preference"
      )
    return effect?.store === "tags" ? effect.record : null
  }
  const local = record(value.local),
    remote = record(value.remote)
  record(value.localAtOutcome)
  record(value.shadowAtOutcome)
  if (!remote || remote.deletedAt || remote.revision < 1)
    throw new Error(
      "Category resolution requires a living committed remote version"
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
        "Category remote comparison regressed or contradicts observed evidence"
      )
  }
  if (value.intentions.some((entry) => entry.userId !== actor))
    throw new Error("Category comparison contains foreign intentions")
  const intentions = value.intentions.filter(
      (entry) => entry.entityKey === key
    ),
    ids = new Set<string>(),
    sequences = new Set<number>()
  for (const entry of intentions) {
    if (
      entry.operation.command.type !== "tag.save" ||
      `tag:${entry.operation.command.tagId}` !== key ||
      entry.lease !== null ||
      ["acknowledged", "sending", "superseded"].includes(entry.state) ||
      (entry.state === "pending" && entry.attempts > 0) ||
      ids.has(entry.operation.operationId) ||
      sequences.has(entry.sequence)
    )
      throw new Error("Category chain has unsupported or uncertain intentions")
    ids.add(entry.operation.operationId)
    sequences.add(entry.sequence)
  }
  if (
    !intentions.some(
      (entry) => JSON.stringify(entry) === JSON.stringify(value.entry)
    )
  )
    throw new Error("Category chain is missing its incident")
  return { value, local, remote, intentions, ids }
}
export function availableTagResolutionChoices(
  input: unknown
): TagResolutionRequest["choice"][] {
  try {
    const parsed = tagIncidentSnapshotSchema.parse(input),
      { local } = validateComparison(parsed, parsed.entry.userId)
    return local &&
      !local.deletedAt &&
      !Object.entries(parsed.tagNames).some(
        ([id, name]) =>
          id !== local.id &&
          name.normalize("NFKC").toLowerCase() === local.normalizedName
      )
      ? ["adopt_remote", "retry_local"]
      : ["adopt_remote"]
  } catch {
    return []
  }
}
export function planTagIncidentResolution(
  input: unknown,
  currentInput: unknown
): TagResolutionRecord {
  const request = tagResolutionRequestSchema.parse(input),
    current = tagIncidentSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Category comparison changed after it was opened")
  const { local, remote, intentions } = validateComparison(
    current,
    request.userId
  )
  if (
    request.resolutionId === request.operationId ||
    current.intentions.some(
      (entry) =>
        entry.operation.operationId === request.resolutionId ||
        entry.operation.operationId === request.operationId
    )
  )
    throw new Error("Category decision identities must be new and distinct")
  if (request.choice === "retry_local" && (!local || local.deletedAt))
    throw new Error("Category retry requires a living local value")
  if (
    request.choice === "retry_local" &&
    local &&
    Object.entries(current.tagNames).some(
      ([id, name]) =>
        id !== local.id &&
        name.normalize("NFKC").toLowerCase() === local.normalizedName
    )
  )
    throw new Error("Category retry duplicates another catalog name")
  const replacement =
    request.choice === "retry_local" && local
      ? {
          operationId: request.operationId,
          protocolVersion: 1,
          baseRevision: remote.revision,
          command: {
            type: "tag.save" as const,
            tagId: remote.id,
            input: {
              name: local.name,
              color: local.color,
              position: remote.position,
            },
          },
        }
      : null
  return tagResolutionRecordSchema.parse({
    ...request,
    key: `tag-resolution:${request.resolutionId}`,
    replacement,
    local: replacement
      ? applyTagCommand(
          [remote],
          replacement.command,
          request.userId,
          request.createdAt
        )
      : remote,
    supersededOperationIds: intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}

export function validateTagResolutionRecord(
  input: unknown,
  actor: string
): TagResolutionRecord {
  const record = tagResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Category decision belongs to another account")
  const request = {
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    choice: record.choice,
    createdAt: record.createdAt,
    expected: record.expected,
  }
  const planned = planTagIncidentResolution(request, record.expected)
  if (JSON.stringify(record) !== JSON.stringify(planned))
    throw new Error(
      "Stored category decision contradicts its reviewed evidence"
    )
  return record
}
