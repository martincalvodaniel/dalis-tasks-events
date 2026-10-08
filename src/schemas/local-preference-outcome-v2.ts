import { z } from "zod"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import {
  maximumRemoteOperationResultBytes,
  remotePreferenceOperationOutcomeSchema,
} from "@/schemas/remote-operation-result-v2"
import { syncOperationSchema } from "@/schemas/sync"

// Both snapshots, the complete result, intention and wrapper share this conservative ceiling.
export const maximumLocalOperationOutcomeBytes = 5 * 1024 * 1024

export const localPreferenceOutcomeV2Schema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal("preference"),
    key: z.string(),
    operation: syncOperationSchema,
    result: z
      .strictObject({
        kind: z.literal("preference"),
        outcome: remotePreferenceOperationOutcomeSchema,
      })
      .refine(
        (result) =>
          new TextEncoder().encode(JSON.stringify(result)).byteLength <=
          maximumRemoteOperationResultBytes,
        "Stored preference result exceeds its byte limit"
      ),
    local: personalSnapshotSchema,
    base: personalSnapshotSchema,
  })
  .refine(
    (value) =>
      value.key === `operation-outcome:${value.operation.operationId}` &&
      value.operation.operationId === value.result.outcome.operationId,
    "Stored preference outcome must match its operation"
  )
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Stored preference outcome exceeds its byte limit"
  )
