import type { z } from "zod"
import type {
  remoteOperationResultV2Schema,
  remotePreferenceOperationOutcomeSchema,
} from "@/schemas/remote-operation-result-v2"

export type RemoteOperationResultV2 = z.infer<
  typeof remoteOperationResultV2Schema
>
export type RemotePreferenceOperationOutcome = z.infer<
  typeof remotePreferenceOperationOutcomeSchema
>
