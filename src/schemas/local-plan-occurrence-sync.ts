import { z } from "zod"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  entityIdSchema,
  occurrenceIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import { remotePlanOccurrenceResultSchema } from "@/schemas/remote-plan-occurrence-result"
import { remoteShadowV2Schema } from "@/schemas/remote-shadow-v2"

const appearanceKeyPrefix = "plan-occurrence:"
export function planOccurrenceEntityKey(idInput: unknown): string {
  return `${appearanceKeyPrefix}${occurrenceIdSchema.parse(idInput)}`
}
export const remotePlanOccurrenceShadowSchema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal("plan-occurrence"),
    userId: userIdSchema,
    entityKey: z.string(),
    seriesRevision: revisionSchema.min(1),
    record: planOccurrenceSchema.safeExtend({
      revision: revisionSchema.min(1),
    }),
  })
  .refine(
    (value) => value.entityKey === planOccurrenceEntityKey(value.record.id),
    "Appearance shadow identity must match its record"
  )
export const remoteRecurringShadowSchema = z.union([
  remoteShadowV2Schema,
  remotePlanOccurrenceShadowSchema,
])

export const localPlanOccurrenceResultInputSchema = z
  .strictObject({
    operation: remotePlanOccurrenceOperationSchema,
    senderId: entityIdSchema,
    result: remotePlanOccurrenceResultSchema,
  })
  .refine(
    (value) => value.operation.operationId === value.result.outcome.operationId,
    "Appearance result must match its submitted operation"
  )

// The observed base is evidence, not proof of the submitted operation's ancestor.
export const localPlanOccurrenceOutcomeSchema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal("plan-occurrence"),
    key: z.string(),
    operation: remotePlanOccurrenceOperationSchema,
    result: remotePlanOccurrenceResultSchema,
    local: planOccurrenceSchema.nullable(),
    base: planOccurrenceSchema.nullable(),
    series: planSchema.nullable(),
  })
  .refine(
    (value) =>
      value.key === `operation-outcome:${value.operation.operationId}` &&
      value.operation.operationId === value.result.outcome.operationId,
    "Stored appearance outcome must match its operation"
  )
