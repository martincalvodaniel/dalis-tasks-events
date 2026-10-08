import { z } from "zod"
import { localOperationOutcomeSchema } from "@/schemas/local-sync"
import { remoteOperationResultSchema } from "@/schemas/remote-sync"

export const localItemOutcomeV2Schema = z
  .strictObject({
    ...localOperationOutcomeSchema.shape,
    version: z.literal(2),
    kind: z.literal("item"),
    result: z.strictObject({
      kind: z.literal("item"),
      outcome: remoteOperationResultSchema,
    }),
  })
  .refine(
    (value) =>
      value.key === `operation-outcome:${value.operation.operationId}` &&
      value.operation.operationId === value.result.outcome.operationId,
    "Stored item outcome must match its operation"
  )
