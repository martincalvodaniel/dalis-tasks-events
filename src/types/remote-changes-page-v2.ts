import type { z } from "zod"
import type { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"

export type RemoteChangesPageV2 = z.infer<typeof remoteChangesPageV2Schema>
