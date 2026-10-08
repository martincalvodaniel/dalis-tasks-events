import { z } from "zod"
import { entityIdSchema } from "@/schemas/primitives"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import { syncOperationSchema } from "@/schemas/sync"

export const localSyncResultInputV2Schema = z
  .strictObject({
    operation: syncOperationSchema,
    senderId: entityIdSchema,
    result: remoteOperationResultV2Schema,
  })
  .refine(
    (input) => input.operation.operationId === input.result.outcome.operationId,
    "Mixed sync result must match its submitted operation"
  )
