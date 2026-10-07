import type { z } from "zod"
import type {
  remoteItemChangeSchema,
  remoteOperationResultSchema,
  remotePushResultSchema,
} from "@/schemas/remote-sync"

export type RemoteOperationResult = z.infer<typeof remoteOperationResultSchema>
export type RemoteItemChange = z.infer<typeof remoteItemChangeSchema>

export type RemotePushResult = z.infer<typeof remotePushResultSchema>
