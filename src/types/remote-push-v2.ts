import type { z } from "zod"
import type {
  remotePushInputV2Schema,
  remotePushResultV2Schema,
} from "@/schemas/remote-push-v2"

export type RemotePushInputV2 = z.infer<typeof remotePushInputV2Schema>
export type RemotePushResultV2 = z.infer<typeof remotePushResultV2Schema>
