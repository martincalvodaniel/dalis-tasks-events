import { z } from "zod"

export const syncProtocolVersionSchema = z.number().int().min(1).max(1000000)
export const syncProtocolRangeSchema = z
  .strictObject({
    minimum: syncProtocolVersionSchema,
    maximum: syncProtocolVersionSchema,
  })
  .refine((range) => range.minimum <= range.maximum, "Invalid protocol range")
