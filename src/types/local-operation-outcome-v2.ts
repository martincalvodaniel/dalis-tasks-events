import type { z } from "zod"
import type { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import type { LocalItemOutcomeV2 } from "@/types/local-item-outcome-v2"

export type LocalPreferenceOutcomeV2 = z.infer<
  typeof localPreferenceOutcomeV2Schema
>
export type LocalOperationOutcomeV2 =
  | LocalItemOutcomeV2
  | LocalPreferenceOutcomeV2
