import type { z } from "zod"
import type {
  remoteChangesPageSchema,
  remoteItemChangeSchema,
  remoteOperationResultSchema,
  remotePushResultSchema,
} from "@/schemas/remote-sync"

export type RemoteOperationResult = z.infer<typeof remoteOperationResultSchema>
export type RemoteItemChange = z.infer<typeof remoteItemChangeSchema>

export type RemotePushResult = z.infer<typeof remotePushResultSchema>
export type RemoteChangesPage = z.infer<typeof remoteChangesPageSchema>
