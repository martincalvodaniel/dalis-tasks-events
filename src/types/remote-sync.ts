import type { z } from "zod"
import type {
  remoteItemChangeSchema,
  remoteOperationResultSchema,
} from "@/schemas/remote-sync"

export type RemoteOperationResult = z.infer<typeof remoteOperationResultSchema>
export type RemoteItemChange = z.infer<typeof remoteItemChangeSchema>
