import type { z } from "zod"
import type { remoteRecurringPushResultSchema } from "@/schemas/remote-recurring-push"

export type RemoteRecurringPushResult = z.infer<
  typeof remoteRecurringPushResultSchema
>
