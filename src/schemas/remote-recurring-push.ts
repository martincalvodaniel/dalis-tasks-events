import { z } from "zod"
import { entityIdSchema } from "@/schemas/primitives"
import { remoteRecurringOperationResultSchema } from "@/schemas/remote-plan-occurrence-result"
import { maximumRemotePushResultV2Bytes } from "@/schemas/remote-push-v2"

// Negotiation is independent of intention and evidence versions. No active route uses this contract.
export const remoteRecurringPushResultSchema = z
  .discriminatedUnion("status", [
    z.strictObject({
      transportVersion: z.literal(2),
      status: z.literal("complete"),
      results: z.array(remoteRecurringOperationResultSchema).min(1).max(50),
    }),
    z.strictObject({
      transportVersion: z.literal(2),
      status: z.literal("retry_later"),
      results: z.array(remoteRecurringOperationResultSchema).max(49),
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
    "Recurring push results contain duplicate operations"
  )
  .refine(
    (result) =>
      new TextEncoder().encode(JSON.stringify(result)).byteLength <=
      maximumRemotePushResultV2Bytes,
    "Recurring push response exceeds its byte limit"
  )
