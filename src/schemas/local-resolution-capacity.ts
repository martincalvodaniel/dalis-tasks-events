import { z } from "zod"

export const localResolutionCapacitySchema = z
  .strictObject({
    outboxCount: z.number().int().min(0).max(10000),
    metadataCount: z.number().int().min(0).max(10000),
    replacementCount: z.number().int().min(0).max(10000),
  })
  .refine(
    (value) => value.outboxCount + value.replacementCount <= 10000,
    "Resolution would exceed the complete queue limit"
  )
  .refine(
    (value) => value.metadataCount + 1 <= 10000,
    "Resolution would exceed the complete metadata limit"
  )
