import { z } from "zod"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import {
  entityIdSchema,
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

const expected = { expectedOccurrenceRevision: revisionSchema }
export const remotePlanOccurrenceCommandSchema = z.discriminatedUnion("type", [
  planOccurrenceCommandSchema.options[0].extend(expected),
  planOccurrenceCommandSchema.options[1].extend(expected),
  planOccurrenceCommandSchema.options[2].extend(expected),
  planOccurrenceCommandSchema.options[3].extend(expected),
])

// baseRevision still belongs to the series; appearance CAS must be explicit.
export const remotePlanOccurrenceOperationSchema = z.strictObject({
  operationId: entityIdSchema,
  protocolVersion: z.literal(1),
  baseRevision: revisionSchema,
  command: remotePlanOccurrenceCommandSchema,
})
export const remotePlanOccurrencePlanningInputSchema = z.strictObject({
  userId: userIdSchema,
  timestamp: timestampSchema,
  operation: remotePlanOccurrenceOperationSchema,
  series: planSchema.nullable(),
  current: planOccurrenceSchema.nullable(),
})
export const remotePlanOccurrencePlanSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("changes"),
    record: planOccurrenceSchema,
    expectedSeriesRevision: revisionSchema,
    expectedOccurrenceRevision: revisionSchema,
    currentExists: z.boolean(),
  }),
  z.strictObject({
    status: z.literal("conflict"),
    series: planSchema,
    current: planOccurrenceSchema.nullable(),
  }),
  z.strictObject({ status: z.literal("unavailable") }),
  z.strictObject({ status: z.literal("invalid_command") }),
])
export type RemotePlanOccurrencePlan = z.infer<
  typeof remotePlanOccurrencePlanSchema
>
