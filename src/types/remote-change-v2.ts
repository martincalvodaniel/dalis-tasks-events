import type { z } from "zod"
import type { remoteChangeV2Schema } from "@/schemas/remote-change-v2"

export type RemoteChangeV2 = z.infer<typeof remoteChangeV2Schema>
