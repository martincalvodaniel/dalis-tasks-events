import type { z } from "zod"
import type { localSyncResultInputV2Schema } from "@/schemas/local-sync-result-v2"

export type LocalSyncResultInputV2 = z.infer<
  typeof localSyncResultInputV2Schema
>
