import { z } from "zod"
import { localChangesPageInputV2Schema } from "@/schemas/local-changes-page-v2"
import { preferenceProjectionInputSchema } from "@/schemas/preference-projection"

export const localPersonalChangesPageSchema = z.strictObject({
  state: preferenceProjectionInputSchema.safeExtend({ incoming: z.null() }),
  receipt: localChangesPageInputV2Schema,
})
