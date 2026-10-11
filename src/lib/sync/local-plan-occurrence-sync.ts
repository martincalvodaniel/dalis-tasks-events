import {
  decodeRemoteShadow,
  validateRemoteShadowV2,
} from "@/lib/sync/remote-shadow-v2"
import {
  localPlanOccurrenceOutcomeSchema,
  localPlanOccurrenceResultInputSchema,
  remotePlanOccurrenceShadowSchema,
} from "@/schemas/local-plan-occurrence-sync"
import { userIdSchema } from "@/schemas/primitives"
import type {
  LocalPlanOccurrenceOutcome,
  LocalPlanOccurrenceResultInput,
  RemoteRecurringShadow,
} from "@/types/remote-recurring-sync"

// Correspondence cannot establish a sender lease, a remote commit or a durable local ACK.
function validateCorrespondence(
  value: Pick<LocalPlanOccurrenceResultInput, "operation" | "result">,
  actor: string
) {
  const { operation, result } = value
  const command = operation.command,
    outcome = result.outcome
  if (result.userId !== actor)
    throw new Error("Appearance result belongs to another account")
  if (outcome.status === "conflict") {
    if (
      outcome.series.id !== command.itemId ||
      (outcome.current && outcome.current.id !== command.occurrenceId)
    )
      throw new Error("Appearance conflict targets another series or slot")
  }
  if (outcome.status !== "applied") return
  const record = outcome.occurrence
  if (
    record.seriesId !== command.itemId ||
    record.id !== command.occurrenceId ||
    outcome.seriesRevision !== operation.baseRevision ||
    record.revision !== command.expectedOccurrenceRevision + 1
  )
    throw new Error(
      "Appearance result does not match its submitted revisions or identity"
    )
  switch (command.type) {
    case "plan.set-occurrence-status":
      if (record.status !== command.status || record.cancelled)
        throw new Error("Appearance status result does not match its command")
      break
    case "plan.set-occurrence-checklist-entry":
      if (
        record.cancelled ||
        !record.checklist.some(
          (entry) =>
            entry.id === command.entryId &&
            entry.completed === command.completed
        )
      )
        throw new Error(
          "Appearance checklist result does not match its command"
        )
      break
    case "plan.cancel-occurrence":
      if (!record.cancelled)
        throw new Error(
          "Appearance cancellation result does not match its command"
        )
      break
    case "plan.update-occurrence":
      if (
        record.cancelled ||
        record.content?.title !== command.input.title ||
        record.content.description !== command.input.description ||
        JSON.stringify(record.schedule) !==
          JSON.stringify(command.input.schedule) ||
        JSON.stringify(
          record.checklist.map(({ id, text }) => ({ id, text }))
        ) !== JSON.stringify(command.input.checklist)
      )
        throw new Error("Appearance edit result does not match its command")
  }
}
export function validateLocalPlanOccurrenceResultInput(
  input: unknown,
  expectedUserIdInput: unknown
): LocalPlanOccurrenceResultInput {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const value = localPlanOccurrenceResultInputSchema.parse(input)
  validateCorrespondence(value, actor)
  return value
}
export function validateLocalPlanOccurrenceOutcome(
  input: unknown,
  expectedUserIdInput: unknown
): LocalPlanOccurrenceOutcome {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const value = localPlanOccurrenceOutcomeSchema.parse(input)
  validateCorrespondence(value, actor)
  const command = value.operation.command
  for (const record of [value.local, value.base])
    if (
      record &&
      (record.seriesId !== command.itemId || record.id !== command.occurrenceId)
    )
      throw new Error("Appearance evidence targets another series or slot")
  if (
    value.series &&
    (value.series.ownerId !== actor || value.series.id !== command.itemId)
  )
    throw new Error(
      "Appearance evidence parent belongs to another account or series"
    )
  return value
}
export function decodeRemoteRecurringShadow(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteRecurringShadow {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const appearance = remotePlanOccurrenceShadowSchema.safeParse(input)
  if (!appearance.success) return decodeRemoteShadow(input, actor)
  if (appearance.data.userId !== actor)
    throw new Error("Appearance shadow belongs to another account")
  return appearance.data
}
export function validateRemoteRecurringShadow(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteRecurringShadow {
  const appearance = remotePlanOccurrenceShadowSchema.safeParse(input)
  if (appearance.success)
    return decodeRemoteRecurringShadow(appearance.data, expectedUserIdInput)
  return validateRemoteShadowV2(input, expectedUserIdInput)
}
