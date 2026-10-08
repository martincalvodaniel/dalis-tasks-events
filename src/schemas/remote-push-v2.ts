import { z } from "zod"
import { entityIdSchema } from "@/schemas/primitives"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import {
  remotePushInputSchema,
  remotePushProtocolEnvelopeSchema,
} from "@/schemas/remote-sync"
import { syncProtocolVersionSchema } from "@/schemas/sync-protocol"

export const maximumRemotePushInputV2Bytes = 512 * 1024
export const maximumRemotePushResultV2Bytes = 2 * 1024 * 1024

// Missing transport metadata identifies legacy input, without accepting its commands.
export const remotePushProtocolEnvelopeV2Schema =
  remotePushProtocolEnvelopeSchema.safeExtend({
    transportVersion: syncProtocolVersionSchema.optional(),
  })

export const remotePushInputV2Schema = remotePushInputSchema
  .safeExtend({ transportVersion: z.literal(2) })
  .refine(
    (input) =>
      new TextEncoder().encode(JSON.stringify(input)).byteLength <=
      maximumRemotePushInputV2Bytes,
    "Mixed push input exceeds its byte limit"
  )

export const remotePushResultV2Schema = z
  .discriminatedUnion("status", [
    z.strictObject({
      transportVersion: z.literal(2),
      status: z.literal("complete"),
      results: z.array(remoteOperationResultV2Schema).min(1).max(50),
    }),
    z.strictObject({
      transportVersion: z.literal(2),
      status: z.literal("retry_later"),
      results: z.array(remoteOperationResultV2Schema).max(49),
      failedOperationId: entityIdSchema,
    }),
    ...(
      [
        "unauthorized",
        "invalid_batch",
        "account_changed",
        "update_required",
      ] as const
    ).map((status) =>
      z.strictObject({
        transportVersion: z.literal(2),
        status: z.literal(status),
      })
    ),
  ])
  .refine(
    (result) =>
      !("results" in result) ||
      new Set(result.results.map((entry) => entry.outcome.operationId)).size ===
        result.results.length,
    "Mixed push results contain duplicate operations"
  )
  .refine(
    (result) =>
      new TextEncoder().encode(JSON.stringify(result)).byteLength <=
      maximumRemotePushResultV2Bytes,
    "Mixed push response exceeds its byte limit"
  )
