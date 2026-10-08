import type { z } from "zod"
import type { localItemOutcomeV2Schema } from "@/schemas/local-item-outcome-v2"

export type LocalItemOutcomeV2 = z.infer<typeof localItemOutcomeV2Schema>
