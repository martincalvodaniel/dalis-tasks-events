import {
  applyTagCommand,
  applyTagMoveCommand,
} from "@/lib/preferences/preference-command"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { revisionSchema } from "@/schemas/primitives"
import { remoteTagPlanningInputSchema } from "@/schemas/remote-tag-planning"
import type { Tag } from "@/types/preferences"
import type { RemoteTagPlan } from "@/types/remote-tag-planning"

// The future authenticated executor supplies the actor and server timestamp.
export function planRemoteTagOperation(input: unknown): RemoteTagPlan {
  const { userId, timestamp, operation, tags } =
    remoteTagPlanningInputSchema.parse(input)
  const command = operation.command
  if (
    command.type !== "tag.save" &&
    command.type !== "tag.delete" &&
    command.type !== "tag.move"
  )
    return { status: "unsupported" }
  const current = tags.find((tag) => tag.id === command.tagId)
  if (
    current &&
    (current.deletedAt || current.revision !== operation.baseRevision)
  )
    return { status: "conflict", current }
  if (!current && (command.type !== "tag.save" || operation.baseRevision !== 0))
    return { status: "unavailable" }
  let changed: Tag[]
  try {
    changed =
      command.type === "tag.move"
        ? applyTagMoveCommand(tags, command, userId, timestamp)
        : [applyTagCommand(tags, command, userId, timestamp)]
  } catch {
    return { status: "invalid_command" }
  }
  const previous = new Map(tags.map((tag) => [tag.id, tag]))
  const effects = changed.map((tag) => ({
    store: "tags" as const,
    record: {
      ...tag,
      revision: revisionSchema.parse((previous.get(tag.id)?.revision ?? 0) + 1),
    },
  }))
  // Reserve the largest sequence representation; journal allocation is not a planner effect.
  const bounded = remotePreferenceEffectsSchema.safeParse({
    version: 1,
    userId,
    operationId: operation.operationId,
    sequence: Number.MAX_SAFE_INTEGER,
    effects,
  })
  if (!bounded.success) return { status: "invalid_command" }
  return { status: "changes", effects: bounded.data.effects }
}
