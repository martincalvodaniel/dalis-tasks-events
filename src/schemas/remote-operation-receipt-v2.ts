import { z } from "zod"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import {
  maximumRemoteOperationResultBytes,
  remoteOperationResultOwner,
  remoteOperationResultV2Schema,
} from "@/schemas/remote-operation-result-v2"

export const maximumRemoteOperationReceiptBytes =
  maximumRemoteOperationResultBytes

export const remoteOperationReceiptV2Schema = z
  .strictObject({
    version: z.literal(2),
    actorUserId: userIdSchema,
    operationId: entityIdSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    result: remoteOperationResultV2Schema,
    createdAt: timestampSchema,
  })
  .refine(
    (receipt) => receipt.operationId === receipt.result.outcome.operationId,
    "Receipt result identity must match its operation"
  )
  .refine((receipt) => {
    const owner = remoteOperationResultOwner(receipt.result)
    return owner === undefined || owner === receipt.actorUserId
  }, "Receipt data must belong to its actor")
  .refine(
    (receipt) =>
      new TextEncoder().encode(JSON.stringify(receipt)).byteLength <=
      maximumRemoteOperationReceiptBytes,
    "Remote operation receipt exceeds its byte limit"
  )
